/**
 * 【原型】榜单中心五方案组件的展示上下文：
 * 宿主负责筛选状态、榜单与成员卡的加载（真实接口竞速 + 示例数据兜底），
 * 方案组件只做呈现。自定义时间范围（custom）在原型中省略，评审重点是字体/图标/布局。
 */
import type { TeamBoardEntry, TeamLeaderboard, TeamMemberCard } from '@/api/team'
import type { TimeRangeKey } from '../adapter'

export interface LeaderboardCtx {
  /** 当前维度 key */
  dimension: string
  /** 切换维度 */
  setDimension: (key: string) => void
  /** 当前模式（null = 全部） */
  mode: string | null
  /** 切换模式 */
  setMode: (mode: string | null) => void
  /** 当前时间范围 key */
  rangeKey: TimeRangeKey
  /** 切换时间范围 */
  setRange: (key: TimeRangeKey) => void
  /** 榜单数据（真实或示例） */
  leaderboard: TeamLeaderboard
  /** 当前维度中文名 */
  dimensionLabel: string
  /** 绝活榜按英雄分组（其他维度为 null，平铺展示） */
  signatureGroups: { champion: string; items: TeamBoardEntry[] }[] | null
  /** 当前选中成员（成员卡联动） */
  selectedEntry: TeamBoardEntry | null
  /** 选中成员（触发成员卡刷新） */
  selectMember: (entry: TeamBoardEntry) => void
  /** 成员卡数据 */
  memberCard: TeamMemberCard | null
  /** 成员卡加载中 */
  cardLoading: boolean
  /** 跳转回主页 */
  goHome: () => void
}
