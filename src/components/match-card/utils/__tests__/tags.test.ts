/**
 * tags 多杀去重测试（任务 8 TDD）
 * 对齐原版 LeagueAkari `match-card/utils/tags.tsx` 的 computeMultikillTags：
 * - 签名与原版一致：`computeMultikillTags({ participant }, t)`
 * - 原版 PlayerTag 无 `type` 字段，故按 label（i18n key）/ priority 断言
 * - 去重口径：LCU 统计为包含式（一次五杀同时计入 quadra/triple/double），
 *   故高等级击杀数需逐级减去（quadra -= penta；triple -= quadra + penta；double -= 三者之和）
 */
import { describe, expect, it } from 'vitest'

import type { MatchCardParticipant } from '@/views/match-detail/adapter/types'
import { computeMultikillTags, type TagContext } from '../tags'

/** t stub：直接回显 key，使标签 label 即 i18n key（count=1 时原版 times() 不走翻译） */
const t = (key: string): string => key

/** 构造最小 TagContext：computeMultikillTags 只消费 participant 的连杀字段，其余置空 */
function makeContext(
  overrides: Partial<
    Pick<MatchCardParticipant, 'doubleKills' | 'tripleKills' | 'quadraKills' | 'pentaKills'>
  >
): TagContext {
  return {
    participant: {
      doubleKills: 0,
      tripleKills: 0,
      quadraKills: 0,
      pentaKills: 0,
      ...overrides
    } as MatchCardParticipant,
    team: {} as TagContext['team'],
    teams: {} as TagContext['teams'],
    basicInfo: {} as TagContext['basicInfo']
  }
}

describe('computeMultikillTags（对齐原版去重逻辑）', () => {
  it('五杀优先于四杀：1 五杀 + 1 四杀只显示五杀', () => {
    const tags = computeMultikillTags(
      makeContext({ pentaKills: 1, quadraKills: 1, tripleKills: 0, doubleKills: 2 }),
      t
    )
    // 四杀计数被五杀吃掉（quadra -= penta = 0），只剩五杀与 1 双杀
    expect(tags.filter((tag) => tag.label === 'matchCard.tags.multiKill.penta')).toHaveLength(1)
    expect(tags.filter((tag) => tag.label === 'matchCard.tags.multiKill.quadra')).toHaveLength(0)
  })

  it('三杀减去（去重后四杀 + 五杀）：2 三杀被 1 四杀 + 1 五杀吃掉 1 次', () => {
    const tags = computeMultikillTags(
      makeContext({ pentaKills: 1, quadraKills: 1, tripleKills: 2, doubleKills: 0 }),
      t
    )
    // 原版先执行 quadra -= penta（四杀归零），三杀再减「去重后四杀 + 五杀」= 0 + 1，
    // 即 2 - 1 = 1 枚三杀（priority = 300 + 1 × 15）；双杀 = 0 - (1 + 0 + 1) < 0 不展示
    const triples = tags.filter((tag) => tag.label === 'matchCard.tags.multiKill.triple')
    expect(triples).toHaveLength(1)
    expect(triples[0].priority).toBe(315)
    expect(tags.filter((tag) => tag.label === 'matchCard.tags.multiKill.double')).toHaveLength(0)
  })

  it('按 priority 排序：quadra > triple > double（penta 优先展示）', () => {
    const tags = computeMultikillTags(
      makeContext({ pentaKills: 0, quadraKills: 1, tripleKills: 2, doubleKills: 3 }),
      t
    )
    // 去重后各剩 1 枚：quadra=1-0、triple=2-1、double=3-1-1
    const order = tags.map((tag) => tag.label)
    expect(order.indexOf('matchCard.tags.multiKill.quadra')).toBeLessThan(
      order.indexOf('matchCard.tags.multiKill.triple')
    )
    expect(order.indexOf('matchCard.tags.multiKill.triple')).toBeLessThan(
      order.indexOf('matchCard.tags.multiKill.double')
    )
    // 优先级数值也应当严格递减
    const priorities = tags.map((tag) => tag.priority)
    expect(priorities).toEqual([...priorities].sort((a, b) => (b ?? 0) - (a ?? 0)))
  })
})
