// 英雄头像 / 出装图标 CDN 地址工具
// 统一在此维护图片源，组件只调用函数获取地址，避免路径散落各处

/**
 * 英雄头像 CDN：CommunityDragon 官方镜像（已验证可达）
 * @param championId 英雄 ID，如 1（安妮）
 * @returns 头像 PNG 完整地址
 */
export function championIconUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`
}

// Data Dragon 固定版本：出装图标降级源
// 注意：CommunityDragon 的 items 路径当前已失效（404），故以此为降级；
// 版本号过旧时图标可能缺失，可在此升级为最新版本（https://ddragon.leagueoflegends.com/api/versions.json）
const DD_DRAGON_VERSION = '16.16.1'

/**
 * 出装图标 CDN 主地址：CommunityDragon（任务简报指定路径）
 * @param itemId 物品 ID，如 6653
 * @returns 图标 PNG 完整地址
 */
export function itemIconUrl(itemId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items/${itemId}.png`
}

/**
 * 出装图标 CDN 降级地址：Data Dragon（CommunityDragon items 路径失效时的备选）
 * @param itemId 物品 ID，如 6653
 * @returns 图标 PNG 完整地址
 */
export function itemIconFallbackUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_DRAGON_VERSION}/img/item/${itemId}.png`
}
