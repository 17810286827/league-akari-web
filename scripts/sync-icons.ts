/**
 * 图标同步脚本（ADR 0004 图标本地化）：npm run sync:icons
 *
 * 从 CDragon / DDragon / gtimg 批量拉取小体积游戏图标到 public/icons/：
 * 英雄头像（champion-summary 全量正 id）、装备（items 全量，DDragon 版本化 URL）、
 * 召唤师技能（summoner-spells）、符文（perks）、符文页样式（perkstyles）、
 * 海克斯强化（cherry-augments，CDragon 优先 + gtimg 补漏）。
 *
 * 清单 → 下载计划的转换在 icon-sync/plan.ts（纯函数，有测试）；
 * 本文件只做网络下载与写盘（IO 边缘，不测）。
 * 游戏版本更新后手动跑一次；图标目录不进 git，Docker 构建期执行本脚本注入。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildAugmentEntries,
  buildChampionEntries,
  buildItemEntries,
  buildPerkEntries,
  buildPerkstyleEntries,
  buildSpellEntries,
  type SyncEntry
} from './icon-sync/plan'
import { FALLBACK_DD_DRAGON_VERSION } from '../src/utils/icon-url'

// ---- 常量（与 game-resource.ts 的数据源保持一致）----

/** CommunityDragon 数据根（zh_cn 优先、default 兜底由 fetchJson 自动降级） */
const CDRAGON_GAME_DATA_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'
/** Data Dragon 版本列表（首元素即最新版本） */
const DD_DRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
/** gtimg 海克斯强化清单（中文描述 + 图标直链兜底） */
const GTIMG_AUGMENTS_URL = 'https://game.gtimg.cn/images/lol/act/img/js/kiwi/kiwi_augments.json'
/** 图标输出目录（Vite 静态资源根下的 icons/，即运行时的 /icons/ 路径） */
const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'icons'
)
/** 下载并发数（CDragon 对高并发限流，16 为实测安全值） */
const CONCURRENCY = 16
/** 单请求超时（毫秒）：CDragon 偶发慢响应，超时按失败计并计入重试 */
const FETCH_TIMEOUT_MS = 30_000
/** 下载失败重试次数 */
const MAX_RETRIES = 3

// ---- IO 工具 ----

/**
 * 拉取 JSON：zh_cn 优先、失败降级 default。
 * 与 game-resource.fetchGameDataJson 同语义但独立实现：脚本版必须带超时
 * （Docker 构建不能无限等待），浏览器版无此约束，二者不共用
 */
async function fetchGameDataJson<T>(file: string): Promise<T> {
  try {
    return await fetchJson<T>(`${CDRAGON_GAME_DATA_BASE}/zh_cn/v1/${file}`)
  } catch (error) {
    console.warn(`[sync-icons] 本地化 ${file} 拉取失败，降级 default:`, error)
    return fetchJson<T>(`${CDRAGON_GAME_DATA_BASE}/default/v1/${file}`)
  }
}

/** 拉取任意 JSON（带超时与非 2xx 抛错） */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`请求失败: ${url} (${response.status})`)
  }
  return (await response.json()) as T
}

/** 下载单个图标并写盘（带重试）；成功返回 true */
async function downloadEntry(entry: SyncEntry): Promise<boolean> {
  // localPath 以 /icons/ 开头，去掉前两段得到子目录结构（如 item/226668.png）
  const relative = entry.localPath.replace(/^\/icons\//, '')
  const outputPath = join(OUTPUT_DIR, relative)
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(entry.remoteUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, buffer)
      return true
    } catch (error) {
      console.warn(
        `[sync-icons] 下载失败（${attempt}/${MAX_RETRIES}） ${entry.remoteUrl}:`,
        error instanceof Error ? error.message : error
      )
    }
  }
  // 重试耗尽：记为缺失（运行时由 CdnImage 降级链回退 CDN，不阻塞整体）
  console.error(`[sync-icons] 放弃下载（运行时走 CDN 兜底）: ${entry.remoteUrl}`)
  return false
}

/** 并发受限地执行全部下载（分批满发，等待整批完成再发下一批） */
async function downloadAll(entries: SyncEntry[]): Promise<{ ok: number; fail: number }> {
  let ok = 0
  let fail = 0
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((entry) => downloadEntry(entry)))
    ok += results.filter(Boolean).length
    fail += results.filter((r) => !r).length
    console.log(`[sync-icons] 进度 ${Math.min(i + CONCURRENCY, entries.length)}/${entries.length}`)
  }
  return { ok, fail }
}

// ---- 主流程 ----

/** 探测 DDragon 最新版本（失败回退写死版本，与运行时降级语义一致） */
async function probeDdDragonVersion(): Promise<string> {
  try {
    const versions = await fetchJson<string[]>(DD_DRAGON_VERSIONS_URL)
    if (Array.isArray(versions) && typeof versions[0] === 'string') {
      console.log(`[sync-icons] Data Dragon 版本: ${versions[0]}`)
      return versions[0]
    }
    throw new Error('versions.json 响应形状异常')
  } catch (error) {
    console.warn(
      `[sync-icons] 版本探测失败，回退写死版本 ${FALLBACK_DD_DRAGON_VERSION}:`,
      error instanceof Error ? error.message : error
    )
    return FALLBACK_DD_DRAGON_VERSION
  }
}

/**
 * 主流程：清单并行拉取 → 纯函数生成下载计划 → 并发受限下载写盘。
 * 退出码语义：清单拉取失败（无计划可产）exit 1 让构建期暴露；
 * 单个图标下载失败不退出非 0（运行时有 CDN 兜底，不应阻塞 Docker 构建）
 */
async function main(): Promise<void> {
  console.log(`[sync-icons] 输出目录: ${OUTPUT_DIR}`)
  // 六类清单并行拉取（互不阻塞）；版本探测独立进行
  const [ddVersion, champions, items, spells, perks, perkstyles, augments, gtimgAugments] =
    await Promise.all([
      probeDdDragonVersion(),
      fetchGameDataJson<unknown>('champion-summary.json'),
      fetchGameDataJson<unknown>('items.json'),
      fetchGameDataJson<unknown>('summoner-spells.json'),
      fetchGameDataJson<unknown>('perks.json'),
      fetchGameDataJson<unknown>('perkstyles.json'),
      fetchGameDataJson<unknown>('cherry-augments.json'),
      fetchJson<unknown>(GTIMG_AUGMENTS_URL).catch((error) => {
        // gtimg 仅作补漏数据源：失败降级为空清单，不阻塞整体同步
        console.warn('[sync-icons] gtimg 海克斯清单拉取失败（跳过补漏）:', error)
        return { data: [] }
      })
    ])

  // 清单 → 下载计划（纯函数，被测接缝）
  const entries: SyncEntry[] = [
    ...buildChampionEntries(champions),
    ...buildItemEntries(items, ddVersion),
    ...buildSpellEntries(spells),
    ...buildPerkEntries(perks),
    ...buildPerkstyleEntries(perkstyles),
    ...buildAugmentEntries(augments, gtimgAugments)
  ]
  // 本地路径去重（同一文件多来源时保留首个）
  const deduped = [...new Map(entries.map((e) => [e.localPath, e])).values()]
  console.log(`[sync-icons] 下载计划: ${deduped.length} 个图标（去重前 ${entries.length}）`)

  const { ok, fail } = await downloadAll(deduped)
  console.log(`[sync-icons] 完成: 成功 ${ok}，失败 ${fail}（失败项运行时走 CDN 兜底）`)
  if (fail > 0) {
    // 有失败也退出 0：图标缺失有 CDN 兜底，不应阻塞 Docker 构建
    console.warn('[sync-icons] 存在失败项，建议网络恢复后重跑（增量覆盖已有文件无需清理）')
  }
}

main().catch((error) => {
  // 清单拉取失败属于致命错误（无清单无法产出计划）：退出非 0 让构建期立即暴露
  console.error('[sync-icons] 同步失败:', error)
  process.exit(1)
})
