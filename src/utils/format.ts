/**
 * 数值格式化工具：车队页面对外展示的评分/比率/伤害类数值统一保留两位小数
 * （后端已四舍五入到两位，前端再做一次兜底展示，避免浮点尾巴如 7.166666666666667）
 */

/** 数值保留两位小数；null/undefined/NaN 返回占位符 */
export function format2(value: number | null | undefined, placeholder = '—'): string {
  if (value == null || Number.isNaN(value)) {
    return placeholder
  }
  return value.toFixed(2)
}
