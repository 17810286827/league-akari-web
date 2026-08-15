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
})
