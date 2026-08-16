/**
 * match-card 体系的中文文案常量模块
 * key 与 i18next 一致（如 match-card.win），文案取自原版
 * src/shared/i18n/zh-CN/renderer/match-card.yaml 与 main.yaml
 */
const zh: Record<string, string> = {
  'match-card.win': '胜利',
  'match-card.hello': '你好 {{name}}',
  // gameAssets 系列（取自原版 src/shared/i18n/zh-CN/renderer/game-assets.yaml，
  // 供任务 7 照搬的 widgets 组件 t() 调用消费）
  'gameAssets.item.combinePrice': '合成 {{gold}} G',
  'gameAssets.augment.bronze': '青铜阶',
  'gameAssets.augment.silver': '白银阶',
  'gameAssets.augment.eventChoice': '事件选择',
  'gameAssets.augment.gold': '黄金阶',
  'gameAssets.augment.prismatic': '棱彩阶',
  'gameAssets.augment.rarity': '{{rarity}}',
  'gameAssets.summonerSpell.cooldown': '冷却时间：{{time}} 秒',
  'gameAssets.summonerSpell.levelRequirement': '等级需求：{{level}}'
  // 后续任务按组件 t() 调用逐步补充，缺失 key 回显本身
}

/** 按 key 取中文文案；缺失回显 key；支持 i18next 的 {{name}} 插值语法 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = zh[key] ?? key
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? `{{${name}}}`))
}
