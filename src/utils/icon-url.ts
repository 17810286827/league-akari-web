// 英雄头像 / 出装图标 / 召唤师技能图标 CDN 地址工具
// 统一在此维护图片源，组件只调用函数获取地址，避免路径散落各处
//
// 双源策略（详见 web docs/adr/0001）：
// - 主源：Data Dragon，版本号动态探测（写死版本会随官方新版本落后，导致新装备图标 404，
//   实例：16.17.1 新增的 ARAM 装备 226668 终极九头蛇在写死 16.16.1 下无图标）
// - 兜底：CommunityDragon 资源地址（由 game-resource 的 items iconPath 解析，见 ItemDisplayResource.fallbackIconUrl）
// 相对导入 logger（同目录）：本模块被同步脚本在 Docker 构建期加载，
// 该环境无 vite.config 的 @ 别名，别名导入会模块缺失
import { createLogger } from './logger'

const logger = createLogger('IconUrl')

/**
 * 本地化图标 URL 前缀（ADR 0004 图标本地化）：
 * 同步脚本把图标下载到 public/icons/，构建后由 nginx 以 /icons/ 路径直出。
 * 以本前缀开头的地址是站点相对路径，CdnImage 直接渲染、不转 CDN
 */
export const LOCAL_ICON_PREFIX = '/icons/'

/**
 * 判断地址是否为本地化图标（站点相对路径，直接渲染不走 CDN 转换）
 */
export function isLocalIconUrl(url: string): boolean {
  return url.startsWith(LOCAL_ICON_PREFIX)
}

/**
 * 英雄头像 CDN：CommunityDragon 官方镜像（已验证可达）
 * @param championId 英雄 ID，如 1（安妮）
 * @returns 头像 PNG 完整地址
 */
export function championIconUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`
}

// ---- Data Dragon 版本动态探测 ----

// 写死兜底版本：仅作探测失败时的回退值（探测成功后立即切换为最新版本）；
// 导出供同步脚本复用同一兜底语义
export const FALLBACK_DD_DRAGON_VERSION = '16.16.1'
// 版本列表数据源：首元素即最新版本（官方稳定接口，CORS 已放开）
const DD_DRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'

/** 当前生效版本（模块级状态：探测成功后更新，itemIconUrl / profileIconUrl 共用） */
let ddDragonVersion = FALLBACK_DD_DRAGON_VERSION
/** 在途探测 Promise（去重：并发调用只发一次请求；失败时重置以便下次重试） */
let versionPromise: Promise<string> | null = null

/**
 * 确保 Data Dragon 版本已探测到最新（仅首次调用发起网络请求）
 * @returns 最新版本号（如 '16.17.1'）；探测失败时错误上抛且版本保持兜底值，
 *          再次调用会重新发起探测（失败不清空可重试性）
 */
export function ensureDdDragonVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = fetch(DD_DRAGON_VERSIONS_URL)
      .then((response) => {
        // 非 2xx 一律抛错，走统一的失败回退分支
        if (!response.ok) {
          throw new Error(`versions.json 请求失败: ${response.status}`)
        }
        return response.json() as Promise<unknown>
      })
      .then((versions) => {
        // 形状守卫：首元素为字符串才视为有效版本列表（防御上游数据结构变更）
        if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
          throw new Error('versions.json 响应形状异常')
        }
        ddDragonVersion = versions[0]
        logger.info('Data Dragon 版本探测完成', { version: ddDragonVersion })
        return ddDragonVersion
      })
      .catch((error) => {
        // 关键降级点：失败重置缓存 Promise 以允许重试；版本保持兜底值不受污染
        versionPromise = null
        logger.warn('Data Dragon 版本探测失败，回退写死版本', {
          fallback: FALLBACK_DD_DRAGON_VERSION,
          error
        })
        throw error
      })
  }
  return versionPromise
}

/**
 * 出装图标 CDN 地址（Data Dragon 主源，版本号为动态探测值）
 * @param itemId 物品 ID，如 6653
 * @param version 可选显式版本（同步脚本探测后传入）；缺省用模块内当前生效版本
 * @returns 图标 PNG 完整地址
 */
export function itemIconUrl(itemId: number, version: string = ddDragonVersion): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`
}

/**
 * 召唤师头像 CDN 地址（Data Dragon，与出装同源同版本）
 * @param profileIconId 召唤师头像 ID（statsJson 的 profileIcon），如 948
 * @returns 头像 PNG 完整地址；ID 非法时返回空串（消费方按占位处理）
 */
export function profileIconUrl(profileIconId?: number | null): string {
  if (!profileIconId || profileIconId <= 0) {
    return ''
  }
  return `https://ddragon.leagueoflegends.com/cdn/${ddDragonVersion}/img/profileicon/${profileIconId}.png`
}

// ---- 本地化图标多源构造（ADR 0004 图标本地化）----
//
// 各构造函数返回「本地 → CDN」降级链：本地路径由同步脚本批量下载到 public/icons/
//（按类型 + ID 命名），本地缺图（未同步的新英雄/新装备）时 CdnImage 自动回退 CDN。
// 装备保持 DDragon → CDragon 双源语义（ADR 0003），前置本地后为三级链。

/** 本地化图标类型（目录名，字面量联合防止拼写错位——脚本/运行时失配即永久缺图） */
export type IconKind = 'champion' | 'item' | 'spell' | 'perk' | 'perkstyle' | 'augment'

/** 按类型 + ID 拼本地化图标路径（同步脚本与运行时共用的命名约定） */
function localIconUrl(kind: IconKind, id: number): string {
  return `${LOCAL_ICON_PREFIX}${kind}/${id}.png`
}

/**
 * 英雄头像降级链：本地 → CDragon（二级）
 * @param championId 英雄 ID，如 103（阿狸）
 */
export function championIconSources(championId: number): string[] {
  return [localIconUrl('champion', championId), championIconUrl(championId)]
}

/**
 * 装备图标完整降级链：本地 → DDragon → CDragon（ADR 0004 本地化 + ADR 0003 双源叠加）
 * @param itemId 物品 ID，如 6653
 * @param cdragonIconPath 可选的 LCU iconPath（CDragon 兜底源）；缺失时链为前两级
 */
export function itemIconSources(itemId: number, cdragonIconPath?: string): string[] {
  const chain = [localIconUrl('item', itemId), itemIconUrl(itemId)]
  if (cdragonIconPath && cdragonIconPath.startsWith('/')) {
    chain.push(cdragonIconPath)
  }
  return chain
}

/** 召唤师技能图标本地路径（CDragon iconPath 无 ID 规律可循，本地化按 spell/{id} 命名） */
export function spellIconLocalUrl(spellId: number): string {
  return localIconUrl('spell', spellId)
}

/** 符文图标本地路径 */
export function perkIconLocalUrl(perkId: number): string {
  return localIconUrl('perk', perkId)
}

/** 符文页样式图标本地路径 */
export function perkstyleIconLocalUrl(styleId: number): string {
  return localIconUrl('perkstyle', styleId)
}

/** 海克斯强化图标本地路径 */
export function augmentIconLocalUrl(augmentId: number): string {
  return localIconUrl('augment', augmentId)
}
