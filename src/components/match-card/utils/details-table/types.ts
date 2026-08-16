/**
 * 统计明细表类型定义（任务 11 移植自原版 LeagueAkari `match-card/utils/details-table/types.ts`）
 * 原版 key 联合类型引用 @shared 的 SGP/LCU 类型（web 端无这两个类型源）；
 * web 端统计键统一由 groups.ts 的字符串字面量声明（与 statsJson 键名一致），故简化为 string
 */
import type { VNodeChild } from 'vue'

export type RenderGroupOptions = {
  /** 统计键（与 statsJson 键名一致，LCU 平铺 / SGP 透传同名字段） */
  key: string

  /** 是否忽略这个字段 */
  hide?: boolean

  /** 各自渲染方式：数字、文本、自定义 */
  render?:
    | 'float'
    | 'akari-score'
    | 'integer'
    | 'text'
    | 'compat'
    | 'boolean'
    | 'game-time'
    | 'percentage'
    | 'position'
    | 'selectedRole'
    | 'auto'
    | ((value: any) => VNodeChild)
}

export type RenderGroup = {
  group: string
  items: RenderGroupOptions[]
}
