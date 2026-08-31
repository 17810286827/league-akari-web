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

/**
 * 统计值展示：整数口径（场数/次数等，不可能出现小数）直接展示整数，
 * 小数口径（场均值/比率）保留两位小数；null/undefined/NaN 返回占位符
 */
export function formatStat(value: number | null | undefined, placeholder = '—'): string {
  if (value == null || Number.isNaN(value)) {
    return placeholder
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * 取整展示：场均类数值（op 评分/分均伤害/基线等）按整数口径四舍五入，
 * 去掉小数尾巴让榜单与英雄基线更清爽；null/undefined/NaN 返回占位符
 */
export function formatInt(value: number | null | undefined, placeholder = '—'): string {
  if (value == null || Number.isNaN(value)) {
    return placeholder
  }
  return String(Math.round(value))
}
