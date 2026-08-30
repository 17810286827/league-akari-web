/**
 * 榜单中心页数据适配层：时间范围/模式的筛选参数计算（纯函数，单元测试覆盖）
 */
/** 时间范围选项 key */
export type TimeRangeKey = 'all' | 'season' | 'last30d' | 'custom'

/** 时间范围下拉选项 */
export const TIME_RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: 'all', label: '全部时间' },
  { key: 'season', label: '本赛季' },
  { key: 'last30d', label: '近 30 天' },
  { key: 'custom', label: '自定义' }
]

/** 模式下拉选项（null = 不筛选） */
export const MODE_OPTIONS: { label: string; value: string | null }[] = [
  { label: '全部模式', value: null },
  { label: '极限闪击', value: 'KIWI' },
  { label: '召唤师峡谷', value: 'CLASSIC' },
  { label: '极地大乱斗', value: 'ARAM' }
]

/** ISO 日期（yyyy-MM-dd）→ 当天 00:00 本地时区毫秒时间戳 */
export function isoToStartMs(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00`).getTime()
}

/**
 * 时间范围 → 后端 start/end 毫秒参数（纯函数）：
 * all → 不限；season → 本自然年 1 月 1 日起；last30d → 30 天前起；
 * custom → 自定义起止（开始缺省不限、结束缺省不限）
 */
export function rangeToParams(
  rangeKey: TimeRangeKey,
  customStartIso?: string,
  customEndIso?: string
): { start?: number; end?: number } {
  if (rangeKey === 'season') {
    const now = new Date()
    return { start: new Date(now.getFullYear(), 0, 1).getTime() }
  }
  if (rangeKey === 'last30d') {
    const now = Date.now()
    return { start: now - 30 * 24 * 3600 * 1000 }
  }
  if (rangeKey === 'custom') {
    return {
      start: customStartIso ? isoToStartMs(customStartIso) : undefined,
      end: customEndIso ? isoToStartMs(customEndIso) : undefined
    }
  }
  return {}
}
