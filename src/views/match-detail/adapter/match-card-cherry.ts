/**
 * CHERRY 竞技场辅助函数（任务 10 移植自原版 @shared/data-adapter/match-history/cherry.ts）
 * 原版仅被 MatchCardOverview 消费（获胜子队展示），web 端只移植用到的 getCherryWinningTeamCount；
 * getCherryTeamCount / isCherryPlacementWin 无组件消费，暂不移植
 */

/**
 * 获胜子队数量：前一半名次的子队获胜（8 队制前 4 获胜，4 队制前 2 获胜）
 * @param teamCount 子队总数
 * @returns 获胜子队数量（向下取整）
 */
export function getCherryWinningTeamCount(teamCount: number): number {
  return Math.floor(teamCount / 2)
}
