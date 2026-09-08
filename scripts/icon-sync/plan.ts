/**
 * 图标同步「清单 → 下载计划」纯函数（ADR 0004 图标本地化）：
 * 把 CDragon / gtimg 各资源清单 JSON（原始形状）转换为下载计划条目
 * （远程 URL → 本地路径）。本地路径约定复用 icon-url.ts 的常量与构造函数，
 * 保证同步脚本产出与运行时 CdnImage 消费走同一套命名规则——
 * 两侧任意一方改约定，另一方立即失配（本地永远缺图、永远走 CDN 兜底）。
 *
 * 本模块为纯函数（无网络、无文件 IO），是同步脚本的被测接缝；
 * 网络下载与目录写盘在 scripts/sync-icons.ts（边缘，不测）。
 */
import { resolveAssetUrl, toIdMap } from '@/utils/game-resource'
import {
  augmentIconLocalUrl,
  championIconSources,
  itemIconUrl,
  perkIconLocalUrl,
  perkstyleIconLocalUrl,
  spellIconLocalUrl
} from '@/utils/icon-url'

/** 下载计划条目：远程 URL 下载后写入本地路径（站点相对路径，如 /icons/champion/103.png） */
export interface SyncEntry {
  localPath: string
  remoteUrl: string
}

/** champion-summary.json 记录（与 game-resource.ChampionSummary 同形） */
interface ChampionSummary {
  id: number
  name?: string
  description?: string
}

/**
 * 英雄头像下载计划：champion-summary 全量正 id → CDragon champion-icons URL
 * （与运行时 championIconSources 同链同命名约定，本地路径取链首源）
 */
export function buildChampionEntries(payload: unknown): SyncEntry[] {
  const champions = toIdMap<ChampionSummary>(payload, 'data')
  const entries: SyncEntry[] = []
  for (const [id] of champions) {
    // 非英雄记录（id ≤ 0，如 -1 "无"）不镜像
    if (id <= 0) continue
    const [localPath, cdnUrl] = championIconSources(id)
    entries.push({ localPath, remoteUrl: cdnUrl })
  }
  return entries
}

/** items.json 记录（与 game-resource.Item 同形，仅需 id） */
interface ItemRecord {
  name?: string
}

/**
 * 装备图标下载计划：items.json 全量 → DDragon 版本化 URL。
 * 版本号由调用方探测后传入（探测失败回退兜底版本，与运行时降级语义一致）
 */
export function buildItemEntries(payload: unknown, ddDragonVersion: string): SyncEntry[] {
  const items = toIdMap<ItemRecord>(payload, 'data')
  const entries: SyncEntry[] = []
  for (const [id, item] of items) {
    // 未知物品（name 缺失的老数据）不镜像
    if (!item.name) continue
    entries.push({ localPath: `/icons/item/${id}.png`, remoteUrl: itemIconUrl(id, ddDragonVersion) })
  }
  return entries
}

/** summoner-spells.json 记录（与 game-resource.SummonerSpell 同形） */
interface SpellRecord {
  name?: string
  iconPath?: string
}

/**
 * 技能图标下载计划：iconPath → CDragon URL，本地按 spell/{id} 命名。
 * iconPath 缺失的记录跳过（运行时由 CdnImage 链直接走 CDragon）
 */
export function buildSpellEntries(payload: unknown): SyncEntry[] {
  const spells = toIdMap<SpellRecord>(payload, 'data')
  const entries: SyncEntry[] = []
  for (const [id, spell] of spells) {
    const remoteUrl = spell.iconPath ? resolveAssetUrl(spell.iconPath) : null
    if (!spell.name || !remoteUrl) continue
    entries.push({ localPath: spellIconLocalUrl(id), remoteUrl })
  }
  return entries
}

/** perks.json 记录（与 game-resource.Perk 同形） */
interface PerkRecord {
  name?: string
  iconPath?: string
}

/**
 * 符文图标下载计划：iconPath → CDragon URL，本地按 perk/{id} 命名
 */
export function buildPerkEntries(payload: unknown): SyncEntry[] {
  const perks = toIdMap<PerkRecord>(payload, 'data')
  const entries: SyncEntry[] = []
  for (const [id, perk] of perks) {
    const remoteUrl = perk.iconPath ? resolveAssetUrl(perk.iconPath) : null
    if (!perk.name || !remoteUrl) continue
    entries.push({ localPath: perkIconLocalUrl(id), remoteUrl })
  }
  return entries
}

/** perkstyles.json 的 styles 元素（与 game-resource.Perkstyle 同形） */
interface PerkstyleRecord {
  name?: string
  iconPath?: string
}

/**
 * 符文页样式图标下载计划：取 styles 子字段，本地按 perkstyle/{id} 命名
 */
export function buildPerkstyleEntries(payload: unknown): SyncEntry[] {
  const styles = toIdMap<PerkstyleRecord>(payload, 'styles', 'data')
  const entries: SyncEntry[] = []
  for (const [id, style] of styles) {
    const remoteUrl = style.iconPath ? resolveAssetUrl(style.iconPath) : null
    if (!style.name || !remoteUrl) continue
    entries.push({ localPath: perkstyleIconLocalUrl(id), remoteUrl })
  }
  return entries
}

/** cherry-augments.json 记录（与 game-resource.Augment 同形） */
interface AugmentRecord {
  nameTRA?: string
  name?: string
  augmentSmallIconPath?: string
  iconPath?: string
}

/** gtimg kiwi_augments.json 记录（与 game-resource.GtimgAugment 的 iconUrl 同源） */
interface GtimgRecord {
  name_cn?: string
  large_Icon?: string
  small_Icon?: string
}

/** 规范化 gtimg 图标直链：协议相对地址（//开头）补 https，非法值归一为 null */
function normalizeGtimgIconUrl(record: GtimgRecord): string | null {
  const raw = record.large_Icon ?? record.small_Icon
  if (!raw || !raw.startsWith('//')) {
    return null
  }
  return `https:${raw}`
}

/**
 * 海克斯强化图标下载计划：CDragon 优先（小图标路径 → CDragon URL），
 * gtimg 仅补 CDragon 缺失的 id（图标直链规范化为 https）；
 * 两源均无图标的 id 不产出条目（运行时由 CdnImage 链兜底）
 */
export function buildAugmentEntries(cdragonPayload: unknown, gtimgPayload: unknown): SyncEntry[] {
  const augments = toIdMap<AugmentRecord>(cdragonPayload, 'data')
  // gtimg 键值对象形状的键可能是数组索引，真实键为记录内 augmentID（同 game-resource 语义）；
  // 数组形状同样取记录内 augmentID（toIdMap 只认 id 字段，gtimg 记录没有）
  const gtimgMap = toIdMap<GtimgRecord>(gtimgPayload, 'data')
  const gtimgWrapper = gtimgPayload as Record<string, unknown> | null
  const gtimgSource =
    gtimgWrapper && typeof gtimgWrapper === 'object' && !Array.isArray(gtimgWrapper)
      ? gtimgWrapper.data
      : gtimgPayload
  if (Array.isArray(gtimgSource)) {
    for (const raw of gtimgSource) {
      const record = raw as Record<string, unknown>
      if (typeof record.augmentID === 'number') {
        gtimgMap.set(record.augmentID, record as unknown as GtimgRecord)
      }
    }
  }
  const entries: SyncEntry[] = []
  for (const [id, augment] of augments) {
    const iconPath = augment.augmentSmallIconPath ?? augment.iconPath
    const remoteUrl = iconPath ? resolveAssetUrl(iconPath) : null
    if (!remoteUrl) continue
    entries.push({ localPath: augmentIconLocalUrl(id), remoteUrl })
  }
  for (const [id, gtimg] of gtimgMap) {
    // CDragon 已镜像的 id 跳过；gtimg 直链缺失的也跳过
    if (augments.has(id)) continue
    const remoteUrl = normalizeGtimgIconUrl(gtimg)
    if (!remoteUrl) continue
    entries.push({ localPath: augmentIconLocalUrl(id), remoteUrl })
  }
  return entries
}
