/**
 * 数字工具（任务 9 移植自原版 composables/useNumberFormatter 与 @shared/data-adapter/utils）
 * web 端无 locale 设置（仅中文），故固定使用 zh-CN 紧凑格式化
 */

/** 除零保护：0 时返回 1（口径与原版 @shared/data-adapter/utils 的 noZero 一致） */
export function noZero(value: number): number {
  return value || 1
}

/** 中文紧凑数字格式化（如 1.2万/3.4亿），对齐原版 zh-CN formatter */
const compactFormatterZhCN = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
  notation: 'compact',
  compactDisplay: 'short'
})

/**
 * 极端数值格式化（对齐原版 useNumberFormatter.formatExtremeNumber）：
 * 低于阈值用千分位 toLocaleString，超过阈值用紧凑格式（避免超长数字撑爆布局）
 * @param value 原始数值
 * @param threshold 紧凑格式触发阈值，默认 10000000
 */
export function formatExtremeNumber(value: number, threshold = 10000000): string {
  if (Math.abs(value) < threshold) {
    return value.toLocaleString()
  }

  return compactFormatterZhCN.format(value)
}

/**
 * 数字格式化组合式（web 版无设置项，固定中文；保留原版 useNumberFormatter 调用形态，
 * 照搬组件直接解构 formatExtremeNumber/formatNumber 使用）
 */
export function useNumberFormatter() {
  return {
    formatExtremeNumber,
    formatNumber: (value: number) => compactFormatterZhCN.format(value)
  }
}
