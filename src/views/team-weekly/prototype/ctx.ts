/**
 * 【原型】车队周报五方案组件的展示上下文：
 * 宿主负责数据加载与周切换状态，方案组件只做呈现（字体/图标/布局差异所在）。
 */
import type { TeamWeeklyReport } from '@/api/team'

export interface WeeklyCtx {
  /** 周报数据（真实接口或内置示例） */
  report: TeamWeeklyReport
  /** 当前周锚点（该周内任意一天 ISO 日期，供周切换计算） */
  weekDate: string
  /** 是否为内置示例数据（切换条标注用） */
  usingMock: boolean
  /** 周偏移（-1 上一周 / 1 下一周） */
  shiftWeek: (weeks: number) => void
  /** 跳转回主页 */
  goHome: () => void
  /** 生成分享图（沿用现有 canvas 生成器） */
  share: () => void
}
