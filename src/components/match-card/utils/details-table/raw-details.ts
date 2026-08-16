/**
 * 原始统计明细组合式（任务 11 改写核心，移植自原版 details-table/raw-details.ts）
 *
 * 改写点：原版从 LCU participant 对象（嵌套 stats/challenges/missions/perks）平铺字段；
 * web 端输入为 statsJson（LCU stats 平铺 / SGP 整体透传，双源字段名一致），
 * 字段直接读取 statsJson[key]，嵌套对象（challenges/missions/pings）从 statsJson.challenges 等键
 * 平铺展开，缺失键由 DetailsTab 的 undefined 判定跳过该行。
 * 身份/英雄名/队伍标识不再自行推导，取自适配层 participants（context 已组装，按 puuid 对齐）。
 * web 端无 akari-score 数据层，不产出 akariScore 字段（对应渲染器保留但恒不触发）。
 */
import { noZero } from '@/utils/numbers'
import { computed } from 'vue'

import { parseStatsJson } from '@/views/match-detail/adapter/match-card-participants'

import { useMatchCard } from '../../context'

/** 判断是否为可平铺的嵌套对象（challenges/missions 等，非对象/数组/null 不展开） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function useRawDetails() {
  const { summary, participants } = useMatchCard()

  return computed(() => {
    // 身份索引：适配层 participants 与 summary 同一数据源、一一对应，按 puuid 对齐更稳健
    const byPuuid = new Map(participants.value.map((p) => [p.puuid, p]))

    // 按队伍标识排序（对齐原版 sgp 分支按 teamId 排序的口径）：
    // DetailsTab 表头直接遍历 rawStats，而行单元格按队伍排序——两处必须同一顺序，列才能对齐；
    // 排序键用 teamIdentifier（CHERRY 子队 ≤9 时与数字顺序一致，与原版表现相同）
    return summary.value.participants
      .map((mp) => {
        // 双源同一解析口径（缺失/非法 JSON 返回空对象，字段缺失行由 DetailsTab 跳过）
        const stats = parseStatsJson(mp.statsJson)
        const adapted = byPuuid.get(mp.puuid)

        // SGP 整体透传时 challenges 等嵌套对象需与统计同层平铺（对齐原版 {...rest, ...challenges} 口径）；
        // LCU 平铺 statsJson 无嵌套对象，展开为空对象不影响字段读取
        const { challenges, ...rest } = stats

        return {
          ...rest,
          ...(isPlainObject(challenges) ? challenges : {}),
          // 附加计算字段（原版 addUp：总伤害 / noZero(金币)，双源统一；总伤害缺失则该行跳过）
          damageGoldEfficiency:
            stats.totalDamageDealtToChampions !== undefined
              ? stats.totalDamageDealtToChampions / noZero(stats.goldEarned ?? 0)
              : undefined,
          // 身份/英雄名/队伍标识：适配层已按 CHERRY 子队等规则组装，直接复用（缺失回退顶层直显字段）
          championId: mp.championId,
          participantId: adapted?.participantId ?? 0,
          identity: {
            puuid: mp.puuid,
            gameName: adapted?.gameName ?? mp.summonerName,
            tagLine: adapted?.tagLine ?? '',
            teamIdentifier: adapted?.teamIdentifier ?? `TEAM-${mp.teamId}`
          }
        }
      })
      .toSorted(
        (a: { identity: { teamIdentifier: string } }, b: { identity: { teamIdentifier: string } }) =>
          a.identity.teamIdentifier.localeCompare(b.identity.teamIdentifier)
      )
  })
}
