// 英雄头像 / 出装图标 / 召唤师技能图标 CDN 地址工具
// 统一在此维护图片源，组件只调用函数获取地址，避免路径散落各处

/**
 * 英雄头像 CDN：CommunityDragon 官方镜像（已验证可达）
 * @param championId 英雄 ID，如 1（安妮）
 * @returns 头像 PNG 完整地址
 */
export function championIconUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`
}

// Data Dragon 固定版本：出装与技能图标源（已验证可达）
// 注意：CommunityDragon 的 items 路径当前已失效（404），故主源直接用 Data Dragon；
// 版本号过旧时图标可能缺失，可在此升级为最新版本（https://ddragon.leagueoflegends.com/api/versions.json）
const DD_DRAGON_VERSION = '16.16.1'

/**
 * 出装图标 CDN 地址（Data Dragon，已验证可达）
 * @param itemId 物品 ID，如 6653
 * @returns 图标 PNG 完整地址
 */
export function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_DRAGON_VERSION}/img/item/${itemId}.png`
}

/**
 * 召唤师头像 CDN 地址（Data Dragon，与出装同源）
 * @param profileIconId 召唤师头像 ID（statsJson 的 profileIcon），如 948
 * @returns 头像 PNG 完整地址；ID 非法时返回空串（消费方按占位处理）
 */
export function profileIconUrl(profileIconId?: number | null): string {
  if (!profileIconId || profileIconId <= 0) {
    return ''
  }
  return `https://ddragon.leagueoflegends.com/cdn/${DD_DRAGON_VERSION}/img/profileicon/${profileIconId}.png`
}

/**
 * 出装图标 CDN 降级地址（与主源同源，保留函数签名供错误降级逻辑使用）
 * @param itemId 物品 ID，如 6653
 * @returns 图标 PNG 完整地址
 */
export function itemIconFallbackUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_DRAGON_VERSION}/img/item/${itemId}.png`
}
