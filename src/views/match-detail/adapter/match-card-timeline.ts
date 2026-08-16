/**
 * 时间线适配层（任务 6/15）：frames 透传 + 事件/构建/图表序列数据转换
 * 对齐原版 data-adapter/match-history/frames.ts 的 toFrames（LCU 取 data.frames、SGP 取 data.json.frames），
 * web 端后端直接返回 frames 数组，结构一致，透传即可；
 * 任务 15 补充三组转换函数，供 Events/Builds/Timeline 三个 Tab 消费：
 * - toMatchCardTimelineSeries：原始帧 → web 本地类型帧（事件字段校验，缺失字段事件跳过）
 * - toMatchCardEvents：抽取 Events Tab 渲染的四种事件（击杀/特殊击杀/拆塔/镀层）
 * - toMatchCardBuilds：抽取 Builds Tab 的技能加点序列 + 购买序列（含 30s 间隔分割与锻炉计数）
 */
import type {
  MatchCardBuildsResult,
  MatchCardChampionKillEvent,
  MatchCardDamageDetail,
  MatchCardItemSpacerEvent,
  MatchCardTimelineBuildingKillEvent,
  MatchCardTimelineChampionStats,
  MatchCardTimelineDamageStats,
  MatchCardTimelineEvent,
  MatchCardTimelineFrame,
  MatchCardTimelineGameEndEvent,
  MatchCardTimelineItemPurchasedEvent,
  MatchCardTimelineParticipantFrame,
  MatchCardTimelinePosition,
  MatchCardTimelineSkillLevelUpEvent,
  MatchCardTimelineSpecialKillEvent,
  MatchCardTimelineTurretPlateDestroyedEvent
} from './types'

/** 对象形状判定：非 null 非数组对象（帧/事件/坐标等结构校验共用） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 数字判定：typeof number 且非 NaN（时间戳/编号等数值字段校验） */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 坐标判定：x/y 均为有限数字（MapPosition 消费，缺失字段事件跳过用） */
function isPosition(value: unknown): value is MatchCardTimelinePosition {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

/**
 * 透传时间线 frames 数组（供 context.details 与 Timeline Tab 消费）
 * @param frames 后端返回的帧数组；异常数据（非数组）返回空数组防御
 * @returns 原样帧数组；非数组输入返回空数组
 */
export function toMatchCardFrames(frames: unknown): unknown[] {
  return Array.isArray(frames) ? frames : []
}

/**
 * 原始帧 → web 本地类型帧（任务 15）：
 * 逐帧校验 timestamp，逐事件按类型校验必需字段（缺失字段事件跳过，不阻塞展示），
 * participantFrames 数值字段缺失兜底为 0（图表不产生 undefined 数据点）
 * @param frames 后端返回的原始帧数组（unknown 透传形状）
 * @returns 带类型的帧数组；非数组输入返回空数组
 */
export function toMatchCardTimelineSeries(frames: unknown): MatchCardTimelineFrame[] {
  if (!Array.isArray(frames)) {
    return []
  }

  const series: MatchCardTimelineFrame[] = []
  for (const rawFrame of frames) {
    if (!isRecord(rawFrame) || !isFiniteNumber(rawFrame.timestamp)) {
      // 帧缺少时间戳：firstAndEndTime 与图表 x 轴都无法消费，整帧跳过
      continue
    }

    series.push({
      timestamp: rawFrame.timestamp,
      // 逐事件校验，缺失必需字段的事件跳过（字段缺失事件跳过规则）
      events: Array.isArray(rawFrame.events) ? normalizeEvents(rawFrame.events) : [],
      participantFrames: normalizeParticipantFrames(rawFrame.participantFrames)
    })
  }
  return series
}

/**
 * 逐事件校验并归一化：按事件类型校验必需字段，缺失字段事件跳过；
 * 未建模类型仅保留 type/timestamp 透传（组件不消费，不丢弃数据）
 */
function normalizeEvents(rawEvents: unknown[]): MatchCardTimelineEvent[] {
  const events: MatchCardTimelineEvent[] = []
  for (const raw of rawEvents) {
    if (!isRecord(raw) || typeof raw.type !== 'string' || !isFiniteNumber(raw.timestamp)) {
      // 事件缺少类型或时间戳：任何消费方都无法使用，跳过
      continue
    }

    switch (raw.type) {
      case 'CHAMPION_KILL': {
        // 击杀事件：击杀者/受害者/助攻列表/坐标为 MapPosition 与击杀文案的必需字段
        if (
          !isFiniteNumber(raw.killerId) ||
          !isFiniteNumber(raw.victimId) ||
          !Array.isArray(raw.assistingParticipantIds) ||
          !isPosition(raw.position)
        ) {
          continue
        }
        events.push({
          type: 'CHAMPION_KILL',
          timestamp: raw.timestamp,
          killerId: raw.killerId,
          victimId: raw.victimId,
          assistingParticipantIds: raw.assistingParticipantIds.filter((id): id is number =>
            isFiniteNumber(id)
          ),
          position: raw.position,
          bounty: isFiniteNumber(raw.bounty) ? raw.bounty : undefined,
          shutdownBounty: isFiniteNumber(raw.shutdownBounty) ? raw.shutdownBounty : undefined,
          killStreakLength: isFiniteNumber(raw.killStreakLength)
            ? raw.killStreakLength
            : undefined,
          // 伤害明细为 SGP 专属字段：仅数组形状才透传（VictimDamageDetails 判定用）
          victimDamageDealt: Array.isArray(raw.victimDamageDealt)
            ? (raw.victimDamageDealt as MatchCardDamageDetail[])
            : undefined,
          victimDamageReceived: Array.isArray(raw.victimDamageReceived)
            ? (raw.victimDamageReceived as MatchCardDamageDetail[])
            : undefined
        } satisfies MatchCardChampionKillEvent)
        break
      }

      case 'CHAMPION_SPECIAL_KILL': {
        // 特殊击杀（一血/多杀/团灭）：击杀者/类型/坐标为必需字段
        if (!isFiniteNumber(raw.killerId) || typeof raw.killType !== 'string' || !isPosition(raw.position)) {
          continue
        }
        events.push({
          type: 'CHAMPION_SPECIAL_KILL',
          timestamp: raw.timestamp,
          killerId: raw.killerId,
          killType: raw.killType,
          multiKillLength: isFiniteNumber(raw.multiKillLength) ? raw.multiKillLength : undefined,
          position: raw.position
        } satisfies MatchCardTimelineSpecialKillEvent)
        break
      }

      case 'BUILDING_KILL': {
        // 拆塔/拆水晶：击杀者/建筑类型/坐标为必需字段（towerType/laneType 缺失时组件降级展示）
        if (!isFiniteNumber(raw.killerId) || typeof raw.buildingType !== 'string' || !isPosition(raw.position)) {
          continue
        }
        events.push({
          type: 'BUILDING_KILL',
          timestamp: raw.timestamp,
          killerId: raw.killerId,
          buildingType: raw.buildingType,
          towerType: typeof raw.towerType === 'string' ? raw.towerType : undefined,
          laneType: typeof raw.laneType === 'string' ? raw.laneType : undefined,
          position: raw.position
        } satisfies MatchCardTimelineBuildingKillEvent)
        break
      }

      case 'TURRET_PLATE_DESTROYED': {
        // 镀层摧毁：击杀者/坐标为必需字段（killerId 为 0 表示自行掉落，模板层跳过）
        if (!isFiniteNumber(raw.killerId) || !isPosition(raw.position)) {
          continue
        }
        events.push({
          type: 'TURRET_PLATE_DESTROYED',
          timestamp: raw.timestamp,
          killerId: raw.killerId,
          laneType: typeof raw.laneType === 'string' ? raw.laneType : undefined,
          position: raw.position
        } satisfies MatchCardTimelineTurretPlateDestroyedEvent)
        break
      }

      case 'SKILL_LEVEL_UP': {
        // 技能加点：选手编号/技能槽位为必需字段（levelUpType 缺失按普通加点处理）
        if (!isFiniteNumber(raw.participantId) || !isFiniteNumber(raw.skillSlot)) {
          continue
        }
        events.push({
          type: 'SKILL_LEVEL_UP',
          timestamp: raw.timestamp,
          participantId: raw.participantId,
          skillSlot: raw.skillSlot,
          levelUpType: typeof raw.levelUpType === 'string' ? raw.levelUpType : undefined
        } satisfies MatchCardTimelineSkillLevelUpEvent)
        break
      }

      case 'ITEM_PURCHASED': {
        // 购买事件：选手编号/物品 ID 为必需字段（Builds Tab 图标与锻炉计数消费）
        if (!isFiniteNumber(raw.participantId) || !isFiniteNumber(raw.itemId)) {
          continue
        }
        events.push({
          type: 'ITEM_PURCHASED',
          timestamp: raw.timestamp,
          participantId: raw.participantId,
          itemId: raw.itemId
        } satisfies MatchCardTimelineItemPurchasedEvent)
        break
      }

      case 'GAME_END': {
        // 对局结束：仅时间戳必需（Events Tab 的 firstAndEndTime 用它取真实结束时间）
        events.push({
          type: 'GAME_END',
          timestamp: raw.timestamp
        } satisfies MatchCardTimelineGameEndEvent)
        break
      }

      default: {
        // 未建模事件类型（守卫/精英野怪/龙魂等）：无任何组件消费（对齐原版三个 Tab
        // 的消费结构），且 string 判别值会破坏类型收窄，直接跳过
        continue
      }
    }
  }
  return events
}

/**
 * 归一化参与者帧：键为字符串参与者编号，值字段缺失兜底为 0；
 * damageStats/championStats 仅 SGP 数据携带，非对象形状一律丢弃（isMatchCardDetailedParticipantFrame 判定用）
 */
function normalizeParticipantFrames(
  rawFrames: unknown
): Record<string, MatchCardTimelineParticipantFrame> {
  if (!isRecord(rawFrames)) {
    return {}
  }

  const participantFrames: Record<string, MatchCardTimelineParticipantFrame> = {}
  for (const [key, raw] of Object.entries(rawFrames)) {
    if (!isRecord(raw)) {
      // 非对象参与者帧（异常数据）整条丢弃
      continue
    }

    participantFrames[key] = {
      // participantId 缺失时以帧 key 为准（后端两种数据源均有 participantId，防御兜底）
      participantId: isFiniteNumber(raw.participantId) ? raw.participantId : Number(key),
      currentGold: isFiniteNumber(raw.currentGold) ? raw.currentGold : 0,
      totalGold: isFiniteNumber(raw.totalGold) ? raw.totalGold : 0,
      goldPerSecond: isFiniteNumber(raw.goldPerSecond) ? raw.goldPerSecond : 0,
      level: isFiniteNumber(raw.level) ? raw.level : 0,
      xp: isFiniteNumber(raw.xp) ? raw.xp : 0,
      minionsKilled: isFiniteNumber(raw.minionsKilled) ? raw.minionsKilled : 0,
      jungleMinionsKilled: isFiniteNumber(raw.jungleMinionsKilled) ? raw.jungleMinionsKilled : 0,
      position: isPosition(raw.position)
        ? raw.position
        : { x: 0, y: 0 },
      // SGP 专属字段：形状不可控，经 unknown 中转断言（仅透传，消费方有运行时判定）
      damageStats: isRecord(raw.damageStats)
        ? (raw.damageStats as unknown as MatchCardTimelineDamageStats)
        : undefined,
      championStats: isRecord(raw.championStats)
        ? (raw.championStats as unknown as MatchCardTimelineChampionStats)
        : undefined
    }
  }
  return participantFrames
}

/** Events Tab 渲染的事件类型（对齐原版 SUPPORTED_EVENT_TYPES：击杀/特殊击杀/拆塔/镀层） */
export const MATCH_CARD_EVENT_TYPES = [
  'CHAMPION_KILL',
  'CHAMPION_SPECIAL_KILL',
  'BUILDING_KILL',
  'TURRET_PLATE_DESTROYED'
] as const

/**
 * 抽取 Events Tab 的事件列表（任务 15）：
 * 击杀/一血/多杀/拆塔/镀层事件，字段完整（缺失字段事件已在系列转换时跳过）
 * @param frames 后端返回的原始帧数组
 * @returns 仅含 Events Tab 渲染的四类事件（按帧顺序平铺）
 */
export function toMatchCardEvents(frames: unknown): MatchCardTimelineEvent[] {
  return toMatchCardTimelineSeries(frames)
    .flatMap((frame) => frame.events)
    .filter((event) => (MATCH_CARD_EVENT_TYPES as readonly string[]).includes(event.type))
}

/** 锻炉物品 ID（Builds Tab 的 anvils 计数：原版常量，购买这些物品记为一次锻炉） */
const ANVIL_ITEM_IDS = [6032, 220000]

/** 购买序列中相邻两次购买超过该间隔（毫秒）时插入分割标记（对齐原版 30s 规则） */
const ITEM_SPACER_GAP = 30000

/**
 * 抽取 Builds Tab 的数据（任务 15）：
 * 技能加点序列（按选手分组，displayLevel 为加点序号，EVOLVE 进化不占序号）+
 * 购买序列（按选手分组，相邻购买间隔超 30s 插入 spacer 分割；锻炉物品计数）
 * @param frames 后端返回的原始帧数组
 * @returns 按参与者编号分组的加点/购买序列与锻炉计数（字段缺失事件已在系列转换时跳过）
 */
export function toMatchCardBuilds(frames: unknown): MatchCardBuildsResult {
  const skillLevelUpEvents: MatchCardBuildsResult['skillLevelUpEvents'] = {}
  const itemPurchaseEvents: MatchCardBuildsResult['itemPurchaseEvents'] = {}
  const anvils: Record<number, number> = {}
  // 每位选手上一次购买时间（判断是否插入 spacer；undefined 表示该选手尚无购买）
  const lastPurchaseTimestamp: Record<number, number> = {}

  for (const frame of toMatchCardTimelineSeries(frames)) {
    for (const event of frame.events) {
      if (event.type === 'SKILL_LEVEL_UP') {
        skillLevelUpEvents[event.participantId] = skillLevelUpEvents[event.participantId] ?? []
        skillLevelUpEvents[event.participantId].push(event)
      } else if (event.type === 'ITEM_PURCHASED') {
        itemPurchaseEvents[event.participantId] = itemPurchaseEvents[event.participantId] ?? []

        // 超过 30s 给一个分割线（对齐原版 collected 计算的 spacer 逻辑）
        const last = lastPurchaseTimestamp[event.participantId]
        if (last !== undefined && event.timestamp - last > ITEM_SPACER_GAP) {
          itemPurchaseEvents[event.participantId].push({ type: 'LEAGUE_AKARI_ITEM_SPACER' } satisfies MatchCardItemSpacerEvent)
        }
        lastPurchaseTimestamp[event.participantId] = event.timestamp
        itemPurchaseEvents[event.participantId].push(event)

        // 锻炉物品计数（原版 ANVIL 概念）
        if (ANVIL_ITEM_IDS.includes(event.itemId)) {
          anvils[event.participantId] = (anvils[event.participantId] ?? 0) + 1
        }
      }
    }
  }

  // 补全加点序号：EVOLVE 不占普通加点次数，其余按出现顺序递增（对齐原版 displayLevel 规则）
  for (const [pid, upgrades] of Object.entries(skillLevelUpEvents)) {
    let level = 0
    // Object.entries 的键为字符串，转数字回填 Record<number, ...>（与事件 participantId 同源）
    skillLevelUpEvents[Number(pid)] = upgrades.map((evt) => {
      if (evt.levelUpType === 'EVOLVE') {
        return { ...evt }
      }
      level++
      return { ...evt, displayLevel: level }
    })
  }

  return { anvils, skillLevelUpEvents, itemPurchaseEvents }
}

/**
 * SGP 击杀事件判定（对齐原版 isSgpChampionKillEvent）：
 * 事件携带伤害明细数组（victimDamageDealt/victimDamageReceived 任一）才渲染伤害明细悬浮卡
 */
export function isMatchCardChampionKillEvent(
  event: MatchCardTimelineEvent
): event is MatchCardChampionKillEvent {
  return (
    event.type === 'CHAMPION_KILL' &&
    (Array.isArray(event.victimDamageDealt) || Array.isArray(event.victimDamageReceived))
  )
}

/**
 * SGP 详细参与者帧判定（对齐原版 isSgpDetailedParticipantFrame）：
 * damageStats/championStats 同时存在才视为 SGP 详细帧
 * （DiffLineChart 的伤害指标与 StatsLine 的属性表格只有 SGP 数据才有值）
 */
export function isMatchCardDetailedParticipantFrame(
  frame: MatchCardTimelineParticipantFrame | null | undefined
): frame is MatchCardTimelineParticipantFrame & {
  damageStats: MatchCardTimelineDamageStats
  championStats: MatchCardTimelineChampionStats
} {
  return (
    frame !== null &&
    frame !== undefined &&
    frame.damageStats !== undefined &&
    frame.championStats !== undefined
  )
}
