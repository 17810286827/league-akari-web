/**
 * 主题样式工具（任务 8 移植自原版 LeagueAkari `match-card/utils/theme.tsx`）
 * 纯函数 / 纯 computed 部分逐字照搬原版；与 web 的差异：
 * - useWinResultStyleType / useCardBorderClass 依赖 useMatchCard context
 *   （web 由任务 10 组装），本任务暂不移植，保留恢复点注释
 * - 原版无 naive-ui 依赖（简报提及的 useThemeVars 在原版中不存在，按实际文件为准）
 */
import { MaybeRefOrGetter, computed, toValue } from 'vue'

/**
 * 玩家图表颜色数组
 * 用于图表中区分不同玩家的数据线
 * 共16种颜色，确保在图表中有良好的区分度
 */
export const playerColors = [
  '#FF6384', // 红色
  '#36A2EB', // 蓝色
  '#FFCE56', // 黄色
  '#4BC0C0', // 青色
  '#9966FF', // 紫色
  '#FF9F40', // 橙色
  '#FF6B9D', // 粉红色
  '#C9CBCF', // 灰色
  '#54C6EB', // 天蓝色
  '#FFB84D', // 浅橙色
  '#C5A3FF', // 淡紫色
  '#4ECDC4', // 青绿色
  '#95E1D3', // 薄荷绿
  '#FF8A80', // 浅红色
  '#81C784', // 绿色
  '#64B5F6' // 浅蓝色
]

/** 技能键位（Q/W/E/R/A/P/?）对应的亮暗主题 class（逐字照搬原版） */
const skillKeyColors: Record<
  string,
  {
    light: string
    dark: string
  }
> = {
  A: {
    light: 'bg-slate-500/40 border-slate-500',
    dark: 'dark:bg-slate-400/20 dark:border-slate-300/60'
  },
  P: {
    light: 'bg-amber-500/40 border-amber-500',
    dark: 'dark:bg-amber-400/20 dark:border-amber-300/60'
  },
  Q: {
    light: 'bg-sky-500/40 border-sky-500',
    dark: 'dark:bg-sky-600/20 dark:border-sky-400/60'
  },
  W: {
    light: 'bg-emerald-500/40 border-emerald-500',
    dark: 'dark:bg-emerald-400/20 dark:border-emerald-400/60'
  },
  E: {
    light: 'bg-violet-500/40 border-violet-500',
    dark: 'dark:bg-violet-400/20 dark:border-violet-400/60'
  },
  R: {
    light: 'bg-orange-500/40 border-orange-500',
    dark: 'dark:bg-orange-400/20 dark:border-orange-400/60'
  },
  '?': {
    light: 'bg-gray-300/40 border-gray-400',
    dark: 'dark:bg-gray-500/20 dark:border-gray-400/60'
  }
}

/** 按技能键位取边框主题 class（未知键位回退 '?'） */
export function getClassBySkillKey(key: string) {
  const base = 'border border-solid'
  const theme = skillKeyColors[key.toUpperCase()] ?? skillKeyColors['?']
  return `${base} ${theme.light} ${theme.dark}`
}

/** 按技能槽位（1-4 → Q/W/E/R）取边框主题 class，未知槽位回退 '?' */
export function getClassBySkillSlot(slot: number) {
  const map: Record<number, 'Q' | 'W' | 'E' | 'R'> = {
    1: 'Q',
    2: 'W',
    3: 'E',
    4: 'R'
  }

  const key = map[slot] ?? '?'
  return getClassBySkillKey(key)
}

/** 胜负标签 class：win 蓝 / loss 红 / 其余灰（纯 computed，不依赖 context） */
export function useWinResultTagClass(result: MaybeRefOrGetter<string | undefined>) {
  return computed(() => {
    const r = toValue(result)

    const commonPart = 'text-xs px-1 py-0.5 rounded'

    if (r === 'win') {
      return `dark:bg-white/20 bg-blue-700/80 dark:text-white text-white ${commonPart}`
    } else if (r === 'loss') {
      return `dark:bg-white/20 bg-red-700/80 dark:text-white text-white ${commonPart}`
    }

    return `dark:bg-white/20 bg-black/60 dark:text-white text-white ${commonPart}`
  })
}

/** 胜负 Tab 切换 class（纯 computed，不依赖 context） */
export function useWinResultTabSwitchClass(result: MaybeRefOrGetter<string | undefined>) {
  return computed(() => {
    const r = toValue(result)

    if (r === 'win') {
      return {
        selected: 'dark:bg-white/20 bg-blue-700/80 dark:text-white text-white',
        unselected: 'dark:text-white/60 text-black/80 hover:dark:bg-white/10 hover:bg-blue-600/20'
      }
    } else if (r === 'loss' || r === 'surrender') {
      return {
        selected: 'dark:bg-white/20 bg-red-700/80 dark:text-white text-white',
        unselected: 'dark:text-white/60 text-black/80 hover:dark:bg-white/10 hover:bg-red-700/20'
      }
    }

    return {
      selected: 'dark:bg-white/20 bg-black/60 dark:text-white text-white',
      unselected: 'dark:text-white/60 text-black/80 hover:dark:bg-white/10 hover:bg-black/10'
    }
  })
}

/**
 * 队伍主题色：TEAM-100 蓝 / TEAM-200 红 / CHERRY-* 按子队序号轮询 playerColors
 * @param teamIdentifier 队伍标识（TEAM-100 / TEAM-200 / CHERRY-N）
 * @returns 十六进制颜色
 */
export function getTeamColor(teamIdentifier?: string) {
  if (!teamIdentifier) return '#9CA3AF'

  if (teamIdentifier === 'TEAM-100') return '#3B82F6'
  if (teamIdentifier === 'TEAM-200') return '#EF4444'

  if (teamIdentifier.startsWith('CHERRY-')) {
    const id = Number(teamIdentifier.split('-')[1])
    if (!isNaN(id)) {
      return playerColors[(id - 1) % playerColors.length]
    }
  }

  return '#9CA3AF'
}

/** 伤害类型文本颜色：物理橙 / 魔法蓝 / 真实灰白（未知回退物理色） */
export function getDamageTextColorClass(type: 'physical' | 'magic' | 'true' | (string & {})) {
  if (type === 'physical') return 'text-[#e07856] dark:text-[#f08a6a]'
  if (type === 'magic') return 'text-[#5b9fd7] dark:text-[#6fb0e6]'
  if (type === 'true') return 'text-[#a8a8a8] dark:text-white'

  return 'text-[#e07856] dark:text-[#f08a6a]'
}

/**
 * 原版 useWinResultStyleType / useCardBorderClass 依赖 useMatchCard context
 * （读取 basicInfo.gameMode 与 team.winResult 判定胜负样式），
 * 任务 10 移植 context.ts 后从原版恢复，函数体无需改动。
 */
