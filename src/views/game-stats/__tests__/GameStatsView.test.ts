/**
 * GameStatsView 组件测试（玩家战绩页）
 * 覆盖：路由携带 puuid 自动加载该玩家对局（折叠卡渲染/未触发详情请求）、
 * 侧栏搜索跳转新玩家路由、点击卡片展开（懒加载 getMatchDetail，渲染 MatchCard 展开态）、
 * 收起再展开命中缓存不重复请求、详情失败收起并提示、竞态保护；
 * mock src/api/matches.ts 的 listMatches/getMatchDetail/searchRiotAccount 与 vue-router，
 * 数据源为轻量摘要 fixture（与 server ParticipantLight 契约一致）+ 任务 5 的 LCU 详情 fixture；
 * naive-ui 组件用 NConfigProvider + NMessageProvider 包裹，RadarChart/StatsBarChart 打桩
 * （chart.js 需 canvas，jsdom 无）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { analyzeMatch, getMatchDetail, listMatches, searchRiotAccount } from '@/api/matches'
import type { AnalyzeStreamHandlers } from '@/api/matches'
import type { MatchDetail, MatchParticipantLight, MatchSummary, PageResponse } from '@/api/types'
import MatchCard from '@/components/match-card/MatchCard.vue'
import MatchCardOverview from '@/components/match-card/MatchCardOverview.vue'
import { lcuParticipantFixture } from '@/views/match-detail/adapter/__tests__/fixtures'

import GameStatsView from '../GameStatsView.vue'

/** 读取指定索引的 analyzeMatch 调用所保存的 SSE 回调，供测试驱动流式行为 */
function analysisHandlersAt(index: number): AnalyzeStreamHandlers {
  return vi.mocked(analyzeMatch).mock.calls[index]?.[1] ?? {}
}

// mock 分析 SSE：GameStatsView 内 useMatchAnalysis 的 analyzeMatch 由各用例手动驱动
vi.mock('@/api/matches', () => ({
  listMatches: vi.fn(),
  getMatchDetail: vi.fn(),
  searchRiotAccount: vi.fn(),
  analyzeMatch: vi.fn()
}))

// mock 路由：战绩页固定访问 /players/lcu-p1?name=PlayerOne&tag=CN1（puuid 与 fixture 一致）；
// router.push 使用共享 mock，供"侧栏搜索跳转"用例断言
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { puuid: 'lcu-p1' }, query: { name: 'PlayerOne', tag: 'CN1' } }),
  useRouter: () => ({ push: routerPush })
}))

// 局部 mock 数据层：展示函数返回空壳 + 英雄名固定值，避免测试触发 CDragon 网络请求
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    // 英雄名固定返回值（fixture 全部 championId=1），供 hidePrivacy 等文案断言
    getChampionName: vi.fn(() => '菲奥娜'),
    augmentDisplay: vi
      .fn()
      .mockResolvedValue({ name: '海克斯强化', iconUrl: '', rarity: 'kSilver' }),
    itemDisplay: vi.fn().mockResolvedValue({
      id: 1,
      name: '装备',
      iconUrl: '',
      descriptionHtml: '',
      price: 0,
      totalPrice: 0
    }),
    perkDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    perkstyleDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    spellDisplay: vi.fn().mockResolvedValue(null)
  }
})

/**
 * 构造一名轻量参与者档案（与 server ParticipantLight 契约字段逐一对应）：
 * 未传字段使用默认值（0/false/null），测试只关注传入部分
 * 默认值含 7 槽出装/双召唤师技能/6 槽海克斯占位/双系符文，保证折叠卡各部件可渲染
 */
function makeLightParticipant(
  partial: Partial<MatchParticipantLight> & {
    puuid: string
    summonerName: string
    teamId: number
  }
): MatchParticipantLight {
  return {
    championId: 1,
    position: 'TOP',
    win: true,
    kills: 0,
    deaths: 0,
    assists: 0,
    // 出装 7 槽（含真眼槽）/ 召唤师技能 / 海克斯（普通对局缺失槽位为 null）/ 符文
    items: [6653, 3078, 3031, 3026, 3074, 3047, 3340],
    summonerSpells: [4, 12],
    augments: [null, null, null, null, null, null],
    perks: { perkIds: [1, 2, 3, 4, 5, 6], perkStyle: 8100, perkSubStyle: 8300 },
    ...partial
  }
}

/**
 * 轻量摘要 fixture：蓝队 5 人（self 7/3/12，队友凑队总击杀 25 供参团率断言）+ 红队 5 人，
 * 含 self/teamTotals/teammates（侧栏聚合统计消费）与 participants（折叠卡消费）
 * 注意：与详情 fixture 共用同一批 puuid/召唤师名，保证展开后数据连贯；
 * gameId 可传参（竞态用例需要两张不同 ID 的卡片）
 */
function makeSummary(gameId = 123): MatchSummary {
  // 蓝队：self 击杀 7，队友 6/5/4/3 → 队总击杀 25（self 参团率 (7+12)/25 = 76%）
  const blue: MatchParticipantLight[] = [
    makeLightParticipant({ puuid: 'lcu-p1', summonerName: 'PlayerOne#CN1', teamId: 100, kills: 7, deaths: 3, assists: 12 }),
    makeLightParticipant({ puuid: 'lcu-p2', summonerName: 'PlayerTwo#CN1', teamId: 100, kills: 6 }),
    makeLightParticipant({ puuid: 'lcu-p3', summonerName: 'PlayerThree#CN1', teamId: 100, kills: 5 }),
    makeLightParticipant({ puuid: 'lcu-p4', summonerName: 'PlayerFour#CN1', teamId: 100, kills: 4 }),
    makeLightParticipant({ puuid: 'lcu-p5', summonerName: 'PlayerFive#CN1', teamId: 100, kills: 3 })
  ]
  // 红队副本：负方（win=false），仅改身份字段（puuid/名称/队伍），击杀改小值防混淆
  const red: MatchParticipantLight[] = blue.map((p, index) => ({
    ...p,
    puuid: `red-${p.puuid}`,
    summonerName: p.summonerName.replace('Player', 'Rival'),
    teamId: 200,
    win: false,
    kills: index // 红队击杀各不相同，验证不误并
  }))

  // 摘要根字段：gameId 与详情 fixture 一致（默认 123），展开时按同一 ID 命中缓存
  return {
    gameId,
    gameCreation: 0,
    gameDuration: 1800,
    gameMode: 'CLASSIC',
    queueId: 420,
    region: 'CN',
    winnerTeamId: 100,
    selfPuuid: 'lcu-p1',
    // self 快照：侧栏总览聚合消费（胜负/平均 KDA/占比），与 light participants 的 self 行同值
    self: {
      championId: 1,
      summonerName: 'PlayerOne#CN1',
      kills: 7,
      deaths: 3,
      assists: 12,
      win: true,
      totalDamage: 25000,
      totalDamageTaken: 30000,
      goldEarned: 12500,
      cs: 200,
      largestMultiKill: 0,
      turretKills: 0,
      gameEndedInSurrender: false
    },
    // 队伍聚合与队友摘要：侧栏"最近队友"聚合消费（同队 4 人）
    teamTotals: { kills: 25, gold: 60000, damage: 100000, damageTaken: 120000 },
    teammates: blue.slice(1).map((p) => ({
      puuid: p.puuid,
      summonerName: p.summonerName,
      championId: p.championId,
      win: true
    })),
    // participants：折叠卡数据源（10 人，含 self）
    participants: [...blue, ...red]
  }
}

/** 展开态详情 fixture：复用任务 5 的 LCU fixture + 红队副本 + 两队 teamsJson（与任务 13 口径一致） */
const detailFixture = {
  // 根字段：gameId=123 与轻量摘要一致（展开时替换折叠卡数据）
  gameId: 123,
  gameCreation: 0,
  gameDuration: 1800,
  gameMode: 'CLASSIC',
  gameType: 'MATCHED_GAME',
  queueId: 420,
  mapId: 11,
  gameVersion: '14.10.1',
  region: 'CN',
  rsoPlatformId: 'CN1',
  // 数据源 lcu：详情面板不出现"构建"Tab（sgp 专属）
  dataSource: 'lcu',
  winnerTeamId: 100,
  selfPuuid: 'lcu-p1',
  // 队伍快照：蓝队 win 字符串（LCU 形状），供队伍胜负与推塔展示
  teamsJson: JSON.stringify([
    { teamId: 100, win: 'Win', towerKills: 11, inhibitorKills: 2, dragonKills: 3, baronKills: 1, riftHeraldKills: 1, voidGrubKills: 4, atakhanKills: 0, firstBlood: true, bans: [] },
    { teamId: 200, win: 'Fail', towerKills: 3, inhibitorKills: 0, dragonKills: 2, baronKills: 0, riftHeraldKills: 0, voidGrubKills: 2, atakhanKills: 0, firstBlood: false, bans: [] }
  ]),
  // 参与者：蓝队全量 statsJson（LCU 平铺）+ 红队仅改身份字段
  participants: [
    ...lcuParticipantFixture,
    // 红队副本：仅改顶层身份字段（LCU stats 无 teamId，分组回退顶层 teamId=200）
    ...lcuParticipantFixture.map((p) => ({
      ...p,
      id: p.id + 100,
      puuid: `red-${p.puuid}`,
      summonerName: p.summonerName.replace('Player', 'Rival'),
      teamId: 200
    }))
  ]
}

/** 挂载 GameStatsView：NConfigProvider + NMessageProvider 包裹（naive-ui 依赖），图表打桩 */
function mountView() {
  // 返回挂载结果：各用例按需 await flushPromises 等待列表/详情接口 resolve
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(GameStatsView) })
      }),
    { global: { stubs: { RadarChart: true, StatsBarChart: true } } }
  )
}

describe('GameStatsView', () => {
  beforeEach(() => {
    // 重置 mock 实现并清空调用历史（否则用例间 mockImplementation 会残留串用）
    vi.resetAllMocks()
    // 默认：列表 1 条轻量摘要；详情成功（失败用例按需覆盖）
    vi.mocked(listMatches).mockResolvedValue({
      data: [makeSummary()],
      total: 1,
      page: 1,
      pageSize: 20
    } satisfies PageResponse<MatchSummary>)
    // 详情：真实 MatchDetail（LCU fixture），与轻量摘要同一 gameId=123
    vi.mocked(getMatchDetail).mockResolvedValue(detailFixture)
    // 召唤师搜索：默认返回 self 玩家账号（puuid=lcu-p1，与摘要/详情 fixture 一致）
    vi.mocked(searchRiotAccount).mockResolvedValue({
      puuid: 'lcu-p1',
      gameName: 'PlayerOne',
      tagLine: 'CN1'
    })
  })

  it('路由携带 puuid：自动加载该玩家的对局并渲染折叠卡，未触发详情请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    // 挂载即按路由 puuid 加载（无需手动查询），列表接口携带查询玩家
    expect(listMatches).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      queueId: undefined,
      summonerName: 'PlayerOne#CN1'
    })
    // 顶部居中查询栏渲染（可切换查询玩家）
    expect(wrapper.find('.top-search-input').exists()).toBe(true)

    // 折叠卡（MatchCardOverview）渲染：self 轻量 KDA 7/3/12（statsJson 归一后来自 participants）
    expect(wrapper.findComponent(MatchCardOverview).exists()).toBe(true)
    expect(wrapper.text()).toContain('7/3/12')
    // 蓝红两队共 10 行玩家列表（轻量参与者 10 人，含 self）
    expect(wrapper.findAll('.group')).toHaveLength(10)
    // 出装图标异步加载（itemDisplay mock 微任务）后出现：7 槽出装
    await flushPromises()
    expect(wrapper.findAll('img.item')).toHaveLength(7)
    // 侧栏统计保持现状：总览区与队列筛选渲染
    expect(wrapper.text()).toContain('总览统计')
    expect(wrapper.find('.queue-select').exists()).toBe(true)

    // 折叠态未触发详情请求，也不渲染展开卡片（懒加载生效）
    expect(getMatchDetail).not.toHaveBeenCalled()
    // 展开态卡片（MatchCard）与详情面板均未挂载
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)
  })

  it('顶部搜索框搜索召唤师：搜索成功后跳转到新玩家的战绩页路由', async () => {
    const wrapper = mountView()
    await flushPromises()

    // 顶部搜索框输入"昵称#tag"并点击查询：搜索接口按输入调用
    await wrapper.find('.top-search-input').setValue('赌书消得泼茶香#iKun')
    await wrapper.find('.top-search-button').trigger('click')
    await flushPromises()

    expect(searchRiotAccount).toHaveBeenCalledWith('赌书消得泼茶香#iKun')
    // 成功后跳转新玩家战绩页（携带昵称/尾号 query），不原地加载
    expect(routerPush).toHaveBeenCalledWith({
      path: '/players/lcu-p1',
      query: { name: 'PlayerOne', tag: 'CN1' }
    })
  })

  it('点击折叠卡展开：懒加载详情，渲染 MatchCard 展开态', async () => {
    const wrapper = mountView()
    await flushPromises()

    // 点击折叠卡 → 通知父组件按 gameId 懒加载详情（时间线接口已移除，不再请求）
    await wrapper.find('.collapsed').trigger('click')
    expect(getMatchDetail).toHaveBeenCalledWith(123)

    // 详情就绪后切换为 MatchCard 展开态（details 恒 null：总览面板无时间线消费）
    await flushPromises()
    const card = wrapper.findComponent(MatchCard)
    expect(card.exists()).toBe(true)
    expect(card.props('isExpanded')).toBe(true)
    expect(card.props('details')).toBeNull()
    // 展开面板精简为"总览"（队伍表格）：无 Tab 切换，直接渲染 TeamTable
    expect(wrapper.text()).toContain('KDA')
  })

  it('展开后收起（卡片内箭头）再展开：命中缓存不重复请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    // 第一步：展开 → 详情加载完成，展开态卡片出现
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(MatchCard).exists()).toBe(true)

    // 卡片内箭头点击 → 收起（v-model 双向同步回父组件，整行回到折叠态）
    await wrapper.find('.rotate-90').trigger('click')
    await flushPromises()
    // 收起后展开卡片卸载，折叠卡（轻量数据）重新挂载
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)
    expect(wrapper.findComponent(MatchCardOverview).exists()).toBe(true)

    // 再次点击展开：详情已缓存，不再请求后端（接口仅调用一次）
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    // 展开态由缓存数据渲染，接口调用次数不增加
    expect(wrapper.findComponent(MatchCard).props('isExpanded')).toBe(true)
    expect(getMatchDetail).toHaveBeenCalledTimes(1)
  })

  it('详情接口失败：收起卡片并提示错误，不渲染展开态', async () => {
    // 详情接口失败（如 404）：展开态应回退折叠卡，不渲染空详情面板
    vi.mocked(getMatchDetail).mockRejectedValue(new Error('404 Not Found'))
    const wrapper = mountView()
    await flushPromises()

    // 点击折叠卡触发懒加载：详情失败后 expandedGameId 复位为 null
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()

    // 展开态不渲染，折叠卡仍在（错误提示经 NMessageProvider teleport 到 body，从 body 断言）
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)
    expect(wrapper.findComponent(MatchCardOverview).exists()).toBe(true)
    expect(document.body.textContent).toContain('对局 123 详情加载失败')
  })

  it('竞态：点 A 后立即点 B，A 详情失败不收起 B（过期响应不改动展开状态）', async () => {
    // 两张卡：A（gameId=123）与 B（gameId=456）；A 的详情请求挂起，B 的详情立即成功
    vi.mocked(listMatches).mockResolvedValue({
      data: [makeSummary(), makeSummary(456)],
      total: 2,
      page: 1,
      pageSize: 20
    } satisfies PageResponse<MatchSummary>)
    // A 的详情为可手动 reject 的挂起 Promise（模拟请求在途）；B 返回带自身 gameId 的详情
    let rejectADetail!: (reason?: unknown) => void
    const pendingADetail = new Promise<MatchDetail>((_resolve, reject) => {
      rejectADetail = reject
    })
    vi.mocked(getMatchDetail).mockImplementation((gameId) =>
      gameId === 123 ? pendingADetail : Promise.resolve({ ...detailFixture, gameId: 456 })
    )
    const wrapper = mountView()
    await flushPromises()

    // 列表渲染两张折叠卡：先点 A（详情请求在途），再立即改点 B
    expect(wrapper.findAll('.collapsed')).toHaveLength(2)
    await wrapper.findAll('.collapsed')[0].trigger('click')
    await flushPromises()
    // A 展开态详情未就绪：保留原折叠卡（不切加载占位），列表仍为两张折叠卡
    expect(wrapper.findAll('.collapsed')).toHaveLength(2)
    await wrapper.findAll('.collapsed')[1].trigger('click')
    await flushPromises()
    // B 详情已就绪：渲染的是 B 的展开态卡片（summary.gameId=456，非 A），loading 已复位
    const card = wrapper.findComponent(MatchCard)
    expect(card.exists()).toBe(true)
    expect(card.props('isExpanded')).toBe(true)
    expect(card.props('summary')).toMatchObject({ gameId: 456 })
    expect(card.props('loadingDetails')).toBe(false)

    // A 的详情此刻才失败：过期 rejection 不得收起正在展示的 B，也不弹 A 的错误提示
    // 前一用例的错误提示仍残留在 body（wrapper 未卸载），改为断言 reject 前后 body 文本无新增
    const bodyTextBeforeReject = document.body.textContent ?? ''
    rejectADetail(new Error('404 Not Found'))
    await flushPromises()
    expect(wrapper.findComponent(MatchCard).exists()).toBe(true)
    expect(wrapper.findComponent(MatchCard).props('isExpanded')).toBe(true)
    expect(wrapper.findComponent(MatchCard).props('loadingDetails')).toBe(false)
    expect(document.body.textContent).toBe(bodyTextBeforeReject)
  })

  it('展开后触发分析，收起再展开后分析结果仍在', async () => {
    // 模拟分析成功：响应 SSE 流式回调，完成后保留结果
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onStart?.(false)
      handlers?.onChunk?.('分析结果正文')
      handlers?.onDone?.(false)
    })
    const wrapper = mountView()
    await flushPromises()

    // 展开卡片，触发分析
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    const card = wrapper.findComponent(MatchCard)
    expect(card.exists()).toBe(true)

    // 点击分析按钮触发 analyzeMock
    const analysisBtn = wrapper.find('.ai-analysis-button')
    expect(analysisBtn.exists()).toBe(true)
    await analysisBtn.trigger('click')
    await flushPromises()

    // 分析完成：结果应展示在卡片中
    expect(wrapper.find('.ai-analysis-result').text()).toContain('分析结果正文')

    // 收起卡片（箭头点击）
    await wrapper.find('.rotate-90').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)

    // 再次展开卡片：分析结果应在（因为 composable 状态由页面层持有，不随组件销毁丢失）
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(MatchCard).exists()).toBe(true)
    expect(wrapper.find('.ai-analysis-result').text()).toContain('分析结果正文')
  })

  it('流式期间折叠卡片，chunk 继续到达，再展开后新片段可见', async () => {
    // 保存 handlers 手动驱动，模拟流式期间折叠
    let savedHandlers: AnalyzeStreamHandlers | undefined
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      savedHandlers = handlers
      handlers?.onStart?.(false)
      handlers?.onChunk?.('第一段')
    })
    const wrapper = mountView()
    await flushPromises()

    // 展开并点击分析
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.ai-analysis-result').text()).toBe('第一段')

    // 折叠卡片（此时 composable 仍存活，请求继续后台进行）
    await wrapper.find('.rotate-90').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)

    // 后台继续推送 chunk（折叠期间请求未中断）
    savedHandlers?.onChunk?.('第二段')
    savedHandlers?.onDone?.(false)
    await flushPromises()

    // 再次展开：能看到拼接后的完整结果
    await wrapper.find('.collapsed').trigger('click')
    await flushPromises()
    expect(wrapper.find('.ai-analysis-result').text()).toBe('第一段第二段')
  })
})
