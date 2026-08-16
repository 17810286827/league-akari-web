/**
 * match-card 体系的中文文案常量模块
 * key 与 i18next 一致（如 match-card.win），文案取自原版
 * src/shared/i18n/zh-CN/renderer/match-card.yaml、main.yaml 与 common.yaml
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
  'gameAssets.summonerSpell.levelRequirement': '等级需求：{{level}}',
  // 对局结果（match-card.yaml result 段；text.ts 的 tWithDefault 未命中时回显 result 原值）
  'matchCard.result.win': '胜利',
  'matchCard.result.loss': '失败',
  'matchCard.result.remake': '重开',
  'matchCard.result.abort': '被终止',
  'matchCard.result.surrender': '投降',
  // 队伍名（common.yaml teams 段；text.ts useTeamName 消费）
  'teams.TEAM-100': '蓝队',
  'teams.TEAM-200': '红队',
  // 对线位置（match-card.yaml position 段；text.ts usePosition 消费，未命中回显原值）
  'matchCard.position.TOP': '上路',
  'matchCard.position.JUNGLE': '打野',
  'matchCard.position.MIDDLE': '中路',
  'matchCard.position.BOTTOM': '下路',
  'matchCard.position.UTILITY': '辅助',
  // TeamTable 表头（match-card.yaml teamTable 段）
  'matchCard.teamTable.objectives.tower': '防御塔',
  'matchCard.teamTable.objectives.inhibitor': '水晶',
  'matchCard.teamTable.objectives.dragon': '巨龙',
  'matchCard.teamTable.objectives.baron': '纳什男爵',
  'matchCard.teamTable.objectives.voidGrub': '虚空巢虫',
  'matchCard.teamTable.objectives.riftHerald': '峡谷先锋',
  'matchCard.teamTable.objectives.atakhan': '厄塔汗',
  'matchCard.teamTable.bans': '禁用',
  'matchCard.teamTable.perMinuteSuffix': '/ 分钟',
  'matchCard.teamTable.cs': '补兵',
  // 伤害构成（DamageBarWithPopover 悬浮卡，match-card.yaml damageMetrics 段）
  'matchCard.damageMetrics.total': '伤害总计',
  'matchCard.damageMetrics.physical': '物理伤害',
  'matchCard.damageMetrics.magic': '魔法伤害',
  'matchCard.damageMetrics.true': '真实伤害',
  // 雷达图（RadarChart 标签，match-card.yaml radar 段）
  'matchCard.radar.damage': '伤害 ({{value}})',
  'matchCard.radar.taken': '承伤 ({{value}})',
  'matchCard.radar.gold': '金币 ({{value}})',
  'matchCard.radar.cs': '补兵 ({{value}})',
  'matchCard.radar.kda': 'KDA ({{value}})',
  'matchCard.radar.kp': '击杀参与率 ({{value}}%)',
  'matchCard.radar.heal': '治疗 ({{value}})',
  'matchCard.radar.teamAvg': '队伍平均',
  // 击杀伤害明细（VictimDamageDetails，match-card.yaml eventsTab.victimDamageDetails 段）
  'matchCard.eventsTab.victimDamageDetails.received': '受到伤害',
  'matchCard.eventsTab.victimDamageDetails.dealt': '造成伤害',
  'matchCard.eventsTab.victimDamageDetails.damageDealerNames.champion': '英雄',
  'matchCard.eventsTab.victimDamageDetails.damageDealerNames.tower': '防御塔',
  'matchCard.eventsTab.victimDamageDetails.damageDealerNames.minion': '小兵',
  'matchCard.eventsTab.victimDamageDetails.damageDealerNames.monster': '野怪',
  'matchCard.eventsTab.victimDamageDetails.damageDealerNames.other': '其他',
  // 玩家标签（usePlayerTags/tags.tsx 消费，match-card.yaml tags 段）
  'matchCard.tags.times': '{{label}}×{{count}}',
  'matchCard.tags.multiKill.penta': '五杀',
  'matchCard.tags.multiKill.quadra': '四杀',
  'matchCard.tags.multiKill.triple': '三杀',
  'matchCard.tags.multiKill.double': '双杀',
  'matchCard.tags.damage.bestLabel': '★ 伤害',
  'matchCard.tags.damage.teamLabel': '伤害',
  'matchCard.tags.damage.bestContent': '全场最高伤害：{{value}}，占队伍伤害的 {{rate}}%',
  'matchCard.tags.damage.teamContent': '队伍最高伤害：{{value}}，占队伍伤害的 {{rate}}%',
  'matchCard.tags.taken.bestLabel': '★ 承伤',
  'matchCard.tags.taken.teamLabel': '承伤',
  'matchCard.tags.taken.bestContent': '全场最高承伤：{{value}}，占队伍承伤的 {{rate}}%',
  'matchCard.tags.taken.teamContent': '队伍最高承伤：{{value}}，占队伍承伤的 {{rate}}%',
  'matchCard.tags.heal.bestLabel': '★ 治疗',
  'matchCard.tags.heal.teamLabel': '治疗',
  'matchCard.tags.heal.bestContent': '全场最高治疗：{{value}}，占队伍治疗的 {{rate}}%',
  'matchCard.tags.heal.teamContent': '队伍最高治疗：{{value}}，占队伍治疗的 {{rate}}%',
  'matchCard.tags.tower.bestLabel': '★ 拆塔',
  'matchCard.tags.tower.teamLabel': '拆塔',
  'matchCard.tags.tower.bestContent': '全场最高对塔伤害：{{value}}，占队伍对塔伤害的 {{rate}}%',
  'matchCard.tags.tower.teamContent': '队伍最高对塔伤害：{{value}}，占队伍对塔伤害的 {{rate}}%',
  'matchCard.tags.shield.bestLabel': '★ 护盾',
  'matchCard.tags.shield.teamLabel': '护盾',
  'matchCard.tags.shield.bestContent': '全场最高护盾：{{value}}，占队伍护盾的 {{rate}}%',
  'matchCard.tags.shield.teamContent': '队伍最高护盾：{{value}}，占队伍护盾的 {{rate}}%',
  'matchCard.tags.solo.label': '单杀',
  'matchCard.tags.solo.content': '造成了 {{value}} 次单杀',
  'matchCard.tags.gold.bestLabel': '★ 金币',
  'matchCard.tags.gold.teamLabel': '金币',
  'matchCard.tags.gold.bestContent': '全场最高经济：{{value}}，占队伍经济的 {{rate}}%',
  'matchCard.tags.gold.teamContent': '队伍最高经济：{{value}}，占队伍经济的 {{rate}}%',
  'matchCard.tags.damageGoldEfficiency.bestLabel': '★ 伤转率',
  'matchCard.tags.damageGoldEfficiency.teamLabel': '伤转率',
  'matchCard.tags.damageGoldEfficiency.bestContent': '最高伤转率：{{rate}}%',
  'matchCard.tags.damageGoldEfficiency.teamContent': '队内最高伤转率：{{rate}}%',
  'matchCard.tags.cs.bestLabel': '★ 补兵',
  'matchCard.tags.cs.bestContent': '全场最高补兵：{{value}}',
  'matchCard.tags.csAdvantage.label': '压刀',
  'matchCard.tags.csAdvantage.content': '同路补刀压制对手最多 {{value}} 个',
  'matchCard.tags.kills.bestLabel': '★ 击杀',
  'matchCard.tags.kills.teamLabel': '击杀',
  'matchCard.tags.kills.bestContent': '全场最多击杀：{{value}}',
  'matchCard.tags.kills.teamContent': '队伍最多击杀：{{value}}',
  'matchCard.tags.kp.bestLabel': '★ 参团',
  'matchCard.tags.kp.teamLabel': '参团',
  'matchCard.tags.kp.bestContent': '全场最高参团率：{{value}}%',
  'matchCard.tags.kp.teamContent': '队伍最高参团率：{{value}}%',
  'matchCard.tags.knockUp.label': '好钩',
  'matchCard.tags.knockUp.content': '将敌方英雄击飞或拉入我方并击杀 {{value}} 次',
  'matchCard.tags.cc.bestLabel': '★ 控制',
  'matchCard.tags.cc.teamLabel': '控制',
  'matchCard.tags.cc.bestContent': '全场最久控制，控制了敌方英雄 {{value}} 秒',
  'matchCard.tags.cc.teamContent': '队伍最久控制，控制了敌方英雄 {{value}} 秒',
  'matchCard.tags.towerKill.diveLabel': '越塔',
  'matchCard.tags.towerKill.underLabel': '塔之子',
  'matchCard.tags.towerKill.diveContent': '在敌方塔下击杀 {{value}} 次',
  'matchCard.tags.towerKill.underContent': '在己方塔下击杀 {{value}} 次'
  // 后续任务按组件 t() 调用逐步补充，缺失 key 回显本身
}

/** 按 key 取中文文案；缺失回显 key；支持 i18next 的 {{name}} 插值语法 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = zh[key] ?? key
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? `{{${name}}}`))
}
