/**
 * MatchCardDetailsTab 组件测试（任务 11）
 * 覆盖：表头玩家数（1 筛选输入 + 10 玩家列）、统计行数、过滤输入后行数变化（含无结果空态）、
 * 列排序（TEAM-100 蓝队靠左 / TEAM-200 红队靠右，输入乱序仍按队伍分组）；
 * 数据用本文件构造的 10 名参与者 statsJson fixture（LCU 平铺风格 + statsJson 内 teamId，
 * 统计键集两队完全一致，便于行数精确断言）；
 * naive-ui 组件用 NConfigProvider 包裹，StatsBarChart 打桩（chart.js 需 canvas，jsdom 无）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MatchDetail, MatchParticipant } from '@/api/types'
import { provideMatchCard } from '../../context'
import MatchCardDetailsTab from '../MatchCardDetailsTab.vue'

/**
 * 构造一名参赛者档案：直显字段与后端 MatchParticipant 一致（LCU 风格身份在顶层），
 * 未传字段使用默认值（0/false/null），测试只关注传入部分
 */
function makeParticipant(
  partial: Partial<MatchParticipant> & { puuid: string; summonerName: string; teamId: number }
): MatchParticipant {
  return {
    id: 1,
    matchId: 1,
    championId: 1,
    position: 'TOP',
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    goldEarned: 0,
    cs: 0,
    items: null,
    summonerSpells: null,
    statsJson: null,
    // 必传字段（puuid/summonerName/teamId）由调用方经 partial 覆盖
    ...partial
  }
}

/**
 * 统计 JSON：10 名参与者使用同一统计键集（LCU 平铺风格 + statsJson 内 teamId），
 * 便于行数精确断言。可见统计键（MAPPED_RENDER_GROUP_OPTIONS 非 hide）共 16 个：
 * combat-stats(kills/deaths/assists/firstBloodKill/doubleKills/tripleKills/damageGoldEfficiency)、
 * damage(totalDamageDealtToChampions)、economy(goldEarned)、vision(visionScore/wardsPlaced)、
 * buildings(turretKills)、healing(totalHeal)、cc(timeCCingOthers)、misc(champLevel)、
 * game-state(gameEndedInEarlySurrender)；其余键（participantId/teamId/win 等）在 ignored 组隐藏
 */
function statJson(participantId: number, kills: number, teamId: number): string {
  return JSON.stringify({
    participantId,
    teamId,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: true,
    // 战斗统计（combat-stats 组）
    kills,
    deaths: 3,
    assists: 12,
    firstBloodKill: participantId === 1,
    doubleKills: 1,
    tripleKills: participantId === 2 ? 1 : 0,
    // 伤害（damage 组）/ 经济（economy 组）
    totalDamageDealtToChampions: 20000 + participantId * 100,
    goldEarned: 12000,
    // 视野（vision 组）/ 建筑（buildings 组）
    visionScore: 20,
    wardsPlaced: 8,
    turretKills: 2,
    // 治疗（healing 组）/ 控制（cc 组）/ 杂项（misc 组）
    totalHeal: 3000,
    timeCCingOthers: 30,
    champLevel: 15,
    // 投降标记（game-state 组）
    gameEndedInEarlySurrender: false
  })
}

/** 蓝队（TEAM-100）击杀：7/6/5/4/3；红队（TEAM-200）击杀：2/1/3/4/5 */
const blueKills = [7, 6, 5, 4, 3]
const redKills = [2, 1, 3, 4, 5]

/**
 * 10 名参与者 fixture：蓝红两队在输入数组中交错排列（验证 DetailsTab/raw-details
 * 按队伍分组排序后，表头与统计列仍保持队伍对齐）
 */
const participants: MatchParticipant[] = Array.from({ length: 5 }, (_, index) => [
  makeParticipant({
    id: index + 1,
    puuid: `blue-p${index + 1}`,
    summonerName: `Player${['One', 'Two', 'Three', 'Four', 'Five'][index]}#CN1`,
    teamId: 100,
    position: 'TOP',
    statsJson: statJson(index + 1, blueKills[index], 100)
  }),
  makeParticipant({
    id: index + 11,
    puuid: `red-p${index + 1}`,
    summonerName: `Rival${['One', 'Two', 'Three', 'Four', 'Five'][index]}#CN2`,
    teamId: 200,
    position: 'BOTTOM',
    statsJson: statJson(index + 6, redKills[index], 200)
  })
]).flat()

/** 最小对局详情：gameId/版本/创建时间供页头展示，数据源 lcu（builds Tab 隐藏逻辑不涉及） */
const summary: MatchDetail = {
  gameId: 987654,
  gameCreation: 0,
  gameDuration: 1800,
  gameMode: 'CLASSIC',
  gameType: 'MATCHED_GAME',
  queueId: 420,
  mapId: 11,
  gameVersion: '14.10.1',
  region: 'CN',
  rsoPlatformId: 'CN1',
  dataSource: 'lcu',
  winnerTeamId: 100,
  selfPuuid: 'blue-p1',
  teamsJson: null,
  participants
}

/** 测试挂载壳：提供 match-card context 后渲染 MatchCardDetailsTab（NConfigProvider 包裹） */
const Harness = defineComponent({
  setup() {
    provideMatchCard({ summary, puuid: 'blue-p1' })
    return () => h(MatchCardDetailsTab)
  }
})

/** 挂载 DetailsTab：naive-ui 依赖 NConfigProvider；StatsBarChart 打桩（chart.js 需 canvas） */
function mountDetailsTab() {
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(Harness)
      }),
    { global: { stubs: { StatsBarChart: true } } }
  )
}

describe('MatchCardDetailsTab', () => {
  afterEach(() => {
    // 过滤用例使用了 fake timers，统一恢复真实计时器
    vi.useRealTimers()
  })

  it('表头渲染 1 个筛选输入与 10 个玩家列', () => {
    const wrapper = mountDetailsTab()

    // 11 个 th = 筛选输入列 + 10 名玩家列；玩家列渲染英雄头像图
    expect(wrapper.findAll('thead th')).toHaveLength(11)
    expect(wrapper.findAll('thead img')).toHaveLength(10)
  })

  it('统计表渲染 16 行（两队 10 人共享同一统计键集）', () => {
    const wrapper = mountDetailsTab()

    // 统计行标签列（sticky left 的 w-30 单元格），数量 = 可见统计键数
    const labelCells = wrapper.findAll('td.w-30')
    expect(labelCells).toHaveLength(16)

    // 击杀行：蓝队 7/6/5/4/3 靠左、红队 2/1/3/4/5 靠右
    const killsRow = wrapper
      .findAll('tbody tr')
      .find((tr) => tr.find('td.w-30').text() === '击杀')
    expect(killsRow).toBeTruthy()
    const cells = killsRow!.findAll('td').slice(1).map((td) => td.text())
    expect(cells).toEqual(['7', '6', '5', '4', '3', '2', '1', '3', '4', '5'])
  })

  it('列按队伍排序：蓝队 5 人靠左、红队 5 人靠右（输入交错仍分组）', () => {
    const wrapper = mountDetailsTab()

    // 表头玩家列：title 在内层 div（= 召唤师名 #tag，hidePrivacy=false 时），按队伍分组排序
    const titles = wrapper
      .findAll('thead th')
      .slice(1)
      .map((th) => th.find('div').attributes('title'))
    expect(titles.slice(0, 5)).toEqual([
      'PlayerOne #CN1',
      'PlayerTwo #CN1',
      'PlayerThree #CN1',
      'PlayerFour #CN1',
      'PlayerFive #CN1'
    ])
    expect(titles.slice(5)).toEqual([
      'RivalOne #CN2',
      'RivalTwo #CN2',
      'RivalThree #CN2',
      'RivalFour #CN2',
      'RivalFive #CN2'
    ])
  })

  it('过滤输入后行数变化：匹配 key 的行保留、无结果显示空态、清空恢复', async () => {
    const wrapper = mountDetailsTab()
    expect(wrapper.findAll('td.w-30')).toHaveLength(16)

    // 输入 'Kill'：key 匹配区分大小写（原版 1:1）——命中 4 行
    // （firstBloodKill/doubleKills/tripleKills/turretKills，注意全小写 kills 不命中）
    vi.useFakeTimers()
    await wrapper.find('input').setValue('Kill')
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.findAll('td.w-30')).toHaveLength(4)

    // 无匹配：显示无筛选结果空态
    await wrapper.find('input').setValue('不存在的统计')
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.findAll('td.w-30')).toHaveLength(0)
    expect(wrapper.text()).toContain('无筛选结果')

    // 清空输入：行数恢复
    await wrapper.find('input').setValue('')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(wrapper.findAll('td.w-30')).toHaveLength(16)
  })
})
