import { describe, expect, it } from 'vitest'
import { t } from '../match-card-i18n'

describe('match-card-i18n', () => {
  it('已知 key 返回中文文案', () => {
    expect(t('match-card.win')).toBe('胜利')
  })
  it('未知 key 回显 key 本身（不崩溃）', () => {
    expect(t('match-card.not-exist-key')).toBe('match-card.not-exist-key')
  })
  it('支持 {{name}} 占位符插值（i18next 语法，组件照搬后原样工作）', () => {
    expect(t('match-card.hello', { name: 'Akari' })).toBe('你好 Akari')
  })
  it('gameAssets 系列（任务 7 widgets 组件消费）返回原版中文文案', () => {
    expect(t('gameAssets.item.combinePrice', { gold: 1200 })).toBe('合成 1200 G')
    expect(t('gameAssets.augment.gold')).toBe('黄金阶')
    expect(t('gameAssets.summonerSpell.cooldown', { time: 300 })).toBe('冷却时间：300 秒')
    expect(t('gameAssets.summonerSpell.levelRequirement', { level: 8 })).toBe('等级需求：8')
  })
})
