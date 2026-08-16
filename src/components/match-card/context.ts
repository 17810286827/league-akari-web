/**
 * match-card 对局卡片上下文（任务 9 移植原版 context.ts 的 web 简化版）
 * 原版含 replay/dry-run/loadDetails/frames 等字段，web 端任务 10 将按计划在此文件基础上
 * 扩展为完整版；本版本仅保留任务 9 各 widgets 消费的最小字段集：
 * basicInfo/participants/teams/puuid/hidePrivacy/navigateToSummonerByPuuid，
 * 数据经任务 5/6 适配层（toBasicInfo/toParticipants/toMatchCardTeams）组装
 */
import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import { computed, inject, provide, toRef, toValue } from 'vue'

import type { MatchDetail } from '@/api/types'
import { toBasicInfo, toParticipants } from '@/views/match-detail/adapter/match-card-participants'
import {
  toMatchCardTeams,
  type TeamsAdapterResult
} from '@/views/match-detail/adapter/match-card-teams'
import type { MatchCardBasicInfo, MatchCardParticipant } from '@/views/match-detail/adapter/types'

/** 上下文形状（web 简化版；字段名与语义对齐原版 MatchCardContext） */
export type MatchCardContext = {
  /** 当前聚焦玩家 PUUID（高亮所在行） */
  puuid: Ref<string | undefined>
  /** 隐私模式：隐藏召唤师名，用英雄名代替（对齐原版 hidePrivacy） */
  hidePrivacy: Ref<boolean>
  /** 对局元信息 */
  basicInfo: Ref<MatchCardBasicInfo>
  /** 全部参与者（适配后模型） */
  participants: Ref<MatchCardParticipant[]>
  /** 队伍聚合统计（teamStatMap 以 teamIdentifier 为 key） */
  teams: Ref<TeamsAdapterResult>
  /** 当前聚焦玩家（无则 null） */
  participant: Ref<MatchCardParticipant | null>
  /** 当前聚焦玩家所在队伍（无则 null） */
  team: Ref<TeamsAdapterResult['teamStatMap'][string] | null>
  /** 跳转到召唤师主页（web 端由挂载方决定导航实现） */
  navigateToSummonerByPuuid: (puuid: string, setCurrent?: boolean) => void
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

/** 提供 match-card 上下文（web 简化版；summary 为对局详情，其余为可选配置） */
export function provideMatchCard(props: {
  summary: MaybeRefOrGetter<MatchDetail>
  puuid?: MaybeRefOrGetter<string | undefined>
  hidePrivacy?: MaybeRefOrGetter<boolean>
  navigateToSummonerByPuuid?: (puuid: string, setCurrent?: boolean) => void
}) {
  const summary = computed(() => toValue(props.summary))
  const basicInfo = computed(() => toBasicInfo(summary.value))
  const participants = computed(() => toParticipants(summary.value.participants))
  const teams = computed(() => toMatchCardTeams(summary.value.teamsJson, participants.value))

  const puuid = toRef(props.puuid) as Ref<string | undefined>
  const hidePrivacy = toRef(props.hidePrivacy ?? false) as Ref<boolean>

  const participant = computed(() => {
    return participants.value.find((p) => p.puuid === puuid.value) ?? null
  })

  const team = computed(() => {
    if (!participant.value) return null
    return teams.value.teamStatMap[participant.value.teamIdentifier] ?? null
  })

  provide(MatchCardContextKey, {
    puuid,
    hidePrivacy,
    basicInfo,
    participants,
    teams,
    participant,
    team,
    navigateToSummonerByPuuid: props.navigateToSummonerByPuuid ?? (() => {})
  })
}
