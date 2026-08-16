/**
 * 队伍适配层（任务 6）：teamsJson（后端存储的 LCU Team 结构快照）解析
 * 输出对齐原版 data-adapter/match-history/teams.ts 的 teamStatMap（key 为字符串 teamId），
 * 供照搬组件零改动消费；voidGrubKills/atakhanKills 为新增字段，老数据缺失按 0
 */
import { createLogger } from '@/utils/logger'

const logger = createLogger('MatchCardTeams')

/** teamsJson 内的原始队伍结构（LCU Team 平铺字段，统计字段可能缺失） */
interface RawTeam {
  teamId?: number
  /** LCU 的 win 为 'Win'/'Fail' 字符串，SGP 为布尔（原样透传） */
  win?: boolean | string
  towerKills?: number
  inhibitorKills?: number
  dragonKills?: number
  baronKills?: number
  riftHeraldKills?: number
  /** 巢虫击杀数（14.10 新资源，老数据缺失按 0） */
  voidGrubKills?: number
  /** 阿塔坎击杀数（15.1 新资源，老数据缺失按 0） */
  atakhanKills?: number
  firstBlood?: boolean
}

/** 单队统计：字段名对应 LCU Team 结构，数字字段缺失按 0（组件侧 ?? 兜底） */
export interface MatchCardTeamStats {
  teamId: number
  win: boolean | string
  towerKills: number
  inhibitorKills: number
  dragonKills: number
  baronKills: number
  riftHeraldKills: number
  voidGrubKills: number
  atakhanKills: number
  firstBlood: boolean
}

/** 队伍适配结果：teamStatMap 以字符串 teamId 为 key（对齐原版，便于组件按队查询） */
export interface MatchCardTeams {
  teamStatMap: Record<string, MatchCardTeamStats>
}

/** 数值兜底：undefined/null 统一转 0（老数据缺失字段不阻塞展示） */
function num(value: number | undefined): number {
  return typeof value === 'number' ? value : 0
}

/** 布尔兜底：undefined/null 统一转 false */
function bool(value: boolean | undefined): boolean {
  return value ?? false
}

/**
 * 解析 teamsJson（后端存储的队伍统计数组，容错模式复用旧 adapter 的 parseTeamsJson）：
 * 输入为空 / 非法 JSON / 非数组均返回空数组并记 warn（不阻塞展示）
 */
function parseTeamsJson(teamsJson: string | null): RawTeam[] {
  if (!teamsJson) {
    return []
  }
  try {
    const parsed = JSON.parse(teamsJson) as RawTeam[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logger.warn('Failed to parse teamsJson', { teamsJson, error })
    return []
  }
}

/**
 * 把 teamsJson 转换为 MatchCardTeams：
 * 逐队映射 LCU Team 结构字段（win 原样透传），统计字段缺失按 0
 * @param teamsJson 后端存储的队伍统计数组 JSON 字符串，可能为 null
 * @returns teamStatMap（key 为字符串 teamId）；解析失败返回空 map
 */
export function toTeams(teamsJson: string | null): MatchCardTeams {
  const teamStatMap: Record<string, MatchCardTeamStats> = {}
  for (const raw of parseTeamsJson(teamsJson)) {
    const teamId = num(raw.teamId)
    teamStatMap[String(teamId)] = {
      teamId,
      win: raw.win ?? false,
      towerKills: num(raw.towerKills),
      inhibitorKills: num(raw.inhibitorKills),
      dragonKills: num(raw.dragonKills),
      baronKills: num(raw.baronKills),
      riftHeraldKills: num(raw.riftHeraldKills),
      voidGrubKills: num(raw.voidGrubKills),
      atakhanKills: num(raw.atakhanKills),
      firstBlood: bool(raw.firstBlood)
    }
  }
  return { teamStatMap }
}
