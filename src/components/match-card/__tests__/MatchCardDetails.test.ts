/**
 * MatchCardDetails 组件测试（AI 对局表现分析 · 战犯出列，SSE 流式）
 * 覆盖：渲染"战犯出列！"按钮、点击发起流式分析并逐块渲染结果（打字机）、
 * 命中缓存提示（start 事件 fromCache）、流中途错误（error 事件）、HTTP 错误（reject）；
 * mock src/api/matches.ts 的 analyzeMatch 与 match-card context（provideMatchCard），
 * naive-ui 组件用 NConfigProvider + NMessageProvider 包裹，TeamTable 内部组件打桩
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { analyzeMatch, type AnalyzeStreamHandlers } from '@/api/matches'

import { provideMatchCard } from '../context'
import MatchCardDetails from '../MatchCardDetails.vue'

// mock API 层：analyzeMatch 由各用例注入流式回调行为
vi.mock('@/api/matches', () => ({
  analyzeMatch: vi.fn()
}))

// mock 数据源展示函数（TeamTable 内部组件依赖，避免真实网络请求）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    getChampionName: vi.fn(() => '菲奥娜'),
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
    spellDisplay: vi.fn().mockResolvedValue(null),
    augmentDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' })
  }
})

/** 挂载 MatchCardDetails：NConfigProvider + NMessageProvider 包裹，TeamTable 打桩 */
function mountView() {
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () =>
          h(NMessageProvider, null, {
            default: () =>
              h(
                {
                  components: { MatchCardDetails },
                  setup() {
                    // 提供对局上下文（gameId 供 AI 分析使用；最小完整形状供 toParticipants 消费）
                    provideMatchCard({
                      summary: {
                        gameId: 123,
                        gameCreation: 0,
                        gameDuration: 1800,
                        gameMode: 'CLASSIC',
                        queueId: 420,
                        region: 'CN',
                        winnerTeamId: null,
                        selfPuuid: 'p1',
                        dataSource: 'lcu',
                        participants: []
                      } as never,
                      isExpanded: false,
                      hidePrivacy: false
                    })
                    return () => h(MatchCardDetails)
                  }
                },
                null
              )
          })
      }),
    {
      global: {
        stubs: {
          MatchCardSummaryTab: true,
          RadarChart: true
        }
      }
    }
  )
}

describe('MatchCardDetails AI 分析（流式）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认：流式分析成功（start + 思考过程 + 两段 chunk + done，未命中缓存）；
    // 第一块以换行结尾（真实模型输出 markdown 时 ## 标题独占一行）
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onStart?.(false)
      handlers?.onReasoning?.('正在分析本局数据…')
      handlers?.onChunk?.('## 总结\n')
      handlers?.onChunk?.('本局表现优秀，KDA 出色。')
      handlers?.onDone?.(false)
    })
  })

  it('渲染"战犯出列！"按钮，点击后发起流式分析并逐块渲染结果', async () => {
    const wrapper = mountView()

    const button = wrapper.find('.ai-analysis-button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('战犯出列！')

    await button.trigger('click')
    await flushPromises()

    // 按对局 gameId 发起流式请求；两段 chunk 按序拼接渲染为 markdown（## 渲染为 h2）；
    // 未命中缓存时不显示缓存提示
    expect(analyzeMatch).toHaveBeenCalledWith(123, expect.any(Object))
    expect(wrapper.find('.ai-analysis-result h2').text()).toBe('总结')
    expect(wrapper.find('.ai-analysis-result').text()).toContain('本局表现优秀，KDA 出色。')
    expect(wrapper.find('.ai-analysis-cache-tip').exists()).toBe(false)
  })

  it('思考过程默认折叠，点击折叠条展开/收起', async () => {
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    // 默认折叠：只显示折叠条，不渲染思维链内容（太长避免刷屏）
    const toggle = wrapper.find('.ai-analysis-reasoning-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('点击展开')
    expect(wrapper.find('.ai-analysis-reasoning').exists()).toBe(false)

    // 点击展开：灰字区只含思维链，正文区只含分析结果（markdown 渲染为 h2）
    await toggle.trigger('click')
    expect(wrapper.find('.ai-analysis-reasoning').text()).toContain('正在分析本局数据')
    expect(wrapper.find('.ai-analysis-reasoning').text()).not.toContain('总结')
    expect(wrapper.find('.ai-analysis-result h2').text()).toBe('总结')

    // 再次点击收起：内容区消失
    await wrapper.find('.ai-analysis-reasoning-toggle').trigger('click')
    expect(wrapper.find('.ai-analysis-reasoning').exists()).toBe(false)
  })

  it('流式过程中逐块追加渲染（打字机效果：首块到达即显示）', async () => {
    // 手动驱动回调：首块到达后（未 done）结果已可见
    let handlers: AnalyzeStreamHandlers | undefined
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, h) => {
      handlers = h
      h?.onStart?.(false)
      h?.onChunk?.('第一段')
      await Promise.resolve()
    })
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    // 首块已渲染（打字机效果），尚未结束
    expect(wrapper.find('.ai-analysis-result').text()).toBe('第一段')
    // 继续推送后续块：结果追加而非覆盖
    handlers?.onChunk?.('第二段')
    await flushPromises()
    expect(wrapper.find('.ai-analysis-result').text()).toBe('第一段第二段')
  })

  it('命中缓存（start 事件 fromCache=true）：展示缓存结果并提示', async () => {
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onStart?.(true)
      handlers?.onChunk?.('缓存的分析结果')
      handlers?.onDone?.(false)
    })
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ai-analysis-result').text()).toContain('缓存的分析结果')
    expect(wrapper.find('.ai-analysis-cache-tip').text()).toContain('2 分钟内已点名过')
  })

  it('流中途错误（error 事件）：展示后端返回的明确原因', async () => {
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onStart?.(false)
      handlers?.onError?.('AI 接口调用失败（HTTP 500），请稍后重试')
    })
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ai-analysis-error').text()).toContain('AI 接口调用失败')
  })

  it('输出被长度预算截断（done truncated=true）：显示截断提示', async () => {
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onStart?.(false)
      handlers?.onChunk?.('分析写到一半')
      handlers?.onDone?.(true)
    })
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    // 正文照常渲染，同时出现琥珀色截断提示
    expect(wrapper.find('.ai-analysis-result').text()).toContain('分析写到一半')
    expect(wrapper.find('.ai-analysis-truncated-tip').text()).toContain('被截断')
  })

  it('HTTP 错误（如 503 无 API Key）：reject 时提示后端返回的明确原因', async () => {
    // 模拟后端 503（流未建立）：analyzeMatch 抛出带 message 的 Error
    vi.mocked(analyzeMatch).mockRejectedValue(new Error('AI API Key 未配置，无法进行对局分析'))
    const wrapper = mountView()

    await wrapper.find('.ai-analysis-button').trigger('click')
    await flushPromises()

    // 错误提示经 message.error（teleport 到 body）可见，内容含后端返回的明确原因
    expect(analyzeMatch).toHaveBeenCalledWith(123, expect.any(Object))
    expect(document.body.textContent).toContain('AI 分析失败')
    expect(document.body.textContent).toContain('AI API Key 未配置')
  })
})
