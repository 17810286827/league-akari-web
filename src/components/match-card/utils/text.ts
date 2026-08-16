/**
 * 文案工厂（任务 8 移植自原版 LeagueAkari `match-card/utils/text.ts`）
 * 函数签名与返回形状逐字对齐原版；与 web 的差异：
 * - 原版 i18next 的 useTranslation / i18next.exists → @/utils/match-card-i18n 的 t
 *   （缺失 key 回显本身），defaultValue 语义用回显判断复刻（见 tWithDefault）
 * - 原版 @shared/i18n 的 formatI18nOrdinal → 本地复刻（web 无 shared 模块）
 */
import { t } from '@/utils/match-card-i18n'

/** 中文数字一到九（formatI18nOrdinal 用，复刻原版 @shared/i18n） */
const chineseNumber = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 序数格式化（原版位于 @shared/i18n，此处本地复刻）：
 * 中文 locale 输出「第X名」，其余 locale 输出英文序数后缀（1st/2nd/3rd…）
 * @param n 名次（从 1 开始）
 * @param locale 语言标识（zh 开头走中文分支）
 * @param simplified 中文下仅返回数字（不带「第/名」）
 */
function formatI18nOrdinal(n: number, locale: string, simplified = false) {
  if (locale.startsWith('zh')) {
    return simplified ? chineseNumber[n - 1] || ' ? ' : `第${chineseNumber[n - 1] || ' ? '}名`
  } else {
    const suffix = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0])
  }
}

/**
 * 带默认值的翻译：key 缺失时返回 fallback（复刻原版 i18next t(key, { defaultValue }) 语义）
 * web 的 t 缺失时回显 key 本身，据此判断是否命中文案表
 */
function tWithDefault(key: string, fallback: string): string {
  const translated = t(key)
  return translated === key ? fallback : translated
}

/** 对局结果名：子队名次优先，其次投降文案，最后按 result key 翻译（缺失回显 result 原值） */
export function useGameResultName() {
  return (subteamPlacement: number | null, result: string, isSurrender = false, locale: string) => {
    if (subteamPlacement !== null && subteamPlacement !== 0) {
      return formatI18nOrdinal(subteamPlacement, locale)
    }

    if (isSurrender && result !== 'remake') {
      return t('matchCard.result.surrender')
    }

    return tWithDefault(`matchCard.result.${result}`, result)
  }
}

/**
 * 队伍名：teams.{teamIdentifier} 命中翻译表则翻译（如 TEAM-100 → 蓝队），
 * 否则原样返回队伍标识（对齐原版 i18next.exists + common ns 语义）
 */
export function useTeamName() {
  return (teamIdentifier: string) => {
    const key = `teams.${teamIdentifier}`
    return tWithDefault(key, teamIdentifier)
  }
}

/** 时间线事件类型文案（缺失回显 type 原值） */
export function useFrameEventType() {
  return (type: string) => {
    return tWithDefault(`matchCard.frameEventType.${type}`, type)
  }
}

/** 建筑类型文案（缺失回显 type 原值） */
export function useBuildingType() {
  return (type: string) => {
    return tWithDefault(`matchCard.buildingType.${type}`, type)
  }
}

/** 防御塔类型文案（缺失回显 type 原值） */
export function useTowerType() {
  return (type: string) => {
    return tWithDefault(`matchCard.towerType.${type}`, type)
  }
}

/** 分路类型文案（缺失回显 type 原值） */
export function useLaneType() {
  return (type: string) => {
    return tWithDefault(`matchCard.laneType.${type}`, type)
  }
}

/** 位置文案（缺失回显 position 原值） */
export function usePosition() {
  return (position: string) => {
    return tWithDefault(`matchCard.position.${position}`, position)
  }
}
