/**
 * match-card 对局卡片上下文（任务 10 扩展为完整版，对齐原版 context.ts）
 * 原版含 replay/dry-run 字段，web 端无回放能力，按计划删除：
 * replayState/canDryRunOngoingGame/loadReplay/watchReplay/dryRunOngoingGame；
 * 保留 isExpanded/details/loadingDetails/frames/loadDetails 与任务 9 各 widgets 消费的字段集。
 * 数据经任务 5/6 适配层（toBasicInfo/toParticipants/toMatchCardTeams/toMatchCardFrames）组装
 */
import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import { computed, inject, provide, toRef, toValue } from 'vue'

import type { MatchDetail } from '@/api/types'
import {
  toBasicInfo,
  toParticipants
} from '@/views/match-detail/adapter/match-card-participants'
import {
  toMatchCardTeams,
  type TeamsAdapterResult
} from '@/views/match-detail/adapter/match-card-teams'
import { toMatchCardFrames } from '@/views/match-detail/adapter/match-card-timeline'
import type {
  MatchCardBasicInfo,
  MatchCardGameDetails,
  MatchCardParticipant
} from '@/views/match-detail/adapter/types'

/** 上下文形状（字段名与语义对齐原版 MatchCardContext；web 版类型全部本地化） */
export type MatchCardContext = {
  /** 折叠/展开状态（详情面板展示条件，任务 11 消费） */
  isExpanded: Ref<boolean>
  /** 当前聚焦玩家 PUUID（高亮所在行） */
  puuid: Ref<string | undefined>
  /** 对局详情（时间线）数据：未加载为 null/undefined（frames 由此派生） */
  details: Ref<MatchCardGameDetails | null | undefined>
  /** 对局元信息（web 的 summary 即 MatchDetail 本身，原始数据不重复暴露给组件） */
  summary: Ref<MatchDetail>
  /** 隐私模式：隐藏召唤师名，用英雄名代替（对齐原版 hidePrivacy） */
  hidePrivacy: Ref<boolean>
  /** 详情（时间线）加载中标记（任务 11 详情面板消费） */
  loadingDetails: Ref<boolean>

  /** 对局元信息（适配后模型） */
  basicInfo: Ref<MatchCardBasicInfo>
  /** 全部参与者（适配后模型） */
  participants: Ref<MatchCardParticipant[]>
  /** 队伍聚合统计（teamStatMap 以 teamIdentifier 为 key） */
  teams: Ref<TeamsAdapterResult>
  /** 时间线帧数组（details 未加载时为空数组，结构透传） */
  frames: Ref<unknown[]>

  /** 当前聚焦玩家（无则 null） */
  participant: Ref<MatchCardParticipant | null>
  /** 当前聚焦玩家所在队伍（无则 null） */
  team: Ref<TeamsAdapterResult['teamStatMap'][string] | null>

  /** 跳转到召唤师主页（web 端由挂载方决定导航实现） */
  navigateToSummonerByPuuid: (puuid: string, setCurrent?: boolean) => void
  /** 加载对局详情（时间线）事件（web 端由挂载方实现数据装载） */
  loadDetails: (gameId: number) => void
}

export const MatchCardContextKey: InjectionKey<MatchCardContext> = Symbol('MatchCardContext')

/** 读取 match-card 上下文（必须在 provideMatchCard 的子树内使用，对齐原版报错语义） */
export function useMatchCard(): MatchCardContext {
  const context = inject(MatchCardContextKey)

  if (!context) {
    throw new Error('useMatchCard must be used within a match card component')
  }

  return context
}

/**
 * 提供 match-card 上下文（web 完整版；summary 为对局详情，其余为可选配置）
 * 可选配置均有默认值：isExpanded=false / details=null / loadingDetails=false，
 * 挂载方只传需要的字段即可（测试与列表页零负担）
 */
export function provideMatchCard(props: {
  summary: MaybeRefOrGetter<MatchDetail>
  isExpanded?: MaybeRefOrGetter<boolean>
  puuid?: MaybeRefOrGetter<string | undefined>
  details?: MaybeRefOrGetter<MatchCardGameDetails | null | undefined>
  hidePrivacy?: MaybeRefOrGetter<boolean>
  loadingDetails?: MaybeRefOrGetter<boolean>
  navigateToSummonerByPuuid?: (puuid: string, setCurrent?: boolean) => void
  loadDetails?: (gameId: number) => void
}) {
  const summary = computed(() => toValue(props.summary))
  const basicInfo = computed(() => toBasicInfo(summary.value))
  // CHERRY 判定以 gameMode 为准（任务 5 账本校正：避免 playerSubteamId>0 启发式误判普通对局）
  const participants = computed(() =>
    toParticipants(summary.value.participants, basicInfo.value.gameMode)
  )
  const teams = computed(() => toMatchCardTeams(summary.value.teamsJson, participants.value))
  const frames = computed(() => {
    const d = toValue(props.details)
    if (!d) {
      return []
    }
    return toMatchCardFrames(d.frames)
  })

  const isExpanded = toRef(props.isExpanded ?? false) as Ref<boolean>
  const puuid = toRef(props.puuid) as Ref<string | undefined>
  const hidePrivacy = toRef(props.hidePrivacy ?? false) as Ref<boolean>
  const loadingDetails = toRef(props.loadingDetails ?? false) as Ref<boolean>

  const participant = computed(() => {
    return participants.value.find((p) => p.puuid === puuid.value) ?? null
  })

  const team = computed(() => {
    if (!participant.value) return null
    return teams.value.teamStatMap[participant.value.teamIdentifier] ?? null
  })

  provide(MatchCardContextKey, {
    isExpanded,
    puuid,
    details: toRef(props.details) as Ref<MatchCardGameDetails | null | undefined>,
    summary,
    hidePrivacy,
    loadingDetails,
    basicInfo,
    participants,
    teams,
    frames,
    participant,
    team,
    navigateToSummonerByPuuid: props.navigateToSummonerByPuuid ?? (() => {}),
    loadDetails: props.loadDetails ?? (() => {})
  })
}
