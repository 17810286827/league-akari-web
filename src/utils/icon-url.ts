// 英雄头像 / 出装图标 / 召唤师技能图标 CDN 地址工具
// 统一在此维护图片源，组件只调用函数获取地址，避免路径散落各处
//
// 双源策略（详见 web docs/adr/0001）：
// - 主源：Data Dragon，版本号动态探测（写死版本会随官方新版本落后，导致新装备图标 404，
//   实例：16.17.1 新增的 ARAM 装备 226668 终极九头蛇在写死 16.16.1 下无图标）
// - 兜底：CommunityDragon 资源地址（由 game-resource 的 items iconPath 解析，见 ItemDisplayResource.fallbackIconUrl）
import { createLogger } from '@/utils/logger'

const logger = createLogger('IconUrl')

/**
 * 英雄头像 CDN：CommunityDragon 官方镜像（已验证可达）
 * @param championId 英雄 ID，如 1（安妮）
 * @returns 头像 PNG 完整地址
 */
export function championIconUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`
}

// ---- Data Dragon 版本动态探测 ----

// 写死兜底版本：仅作探测失败时的回退值（探测成功后立即切换为最新版本）
const FALLBACK_DD_DRAGON_VERSION = '16.16.1'
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
 * @returns 图标 PNG 完整地址
 */
export function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddDragonVersion}/img/item/${itemId}.png`
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
