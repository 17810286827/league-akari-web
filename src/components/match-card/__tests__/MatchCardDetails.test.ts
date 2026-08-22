/**
 * MatchCardDetails 组件测试：受控 AI 对局表现展示。
 * 覆盖按钮事件、markdown、缓存提示、reasoning 折叠、截断和错误展示。
 */
import { mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { h, reactive } from 'vue'

import MatchCardDetails from '../MatchCardDetails.vue'
import { provideMatchCard } from '../context'

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

type AnalysisProps = {
  analyzing: boolean
  result: string
  reasoning: string
  reasoningCollapsed: boolean
  fromCache: boolean
  errorMsg: string
  truncatedTip: string
}

const defaultAnalysis: AnalysisProps = {
  analyzing: false,
  result: '',
  reasoning: '',
  reasoningCollapsed: true,
  fromCache: false,
  errorMsg: '',
  truncatedTip: ''
}

/** 挂载受控组件，并模拟页面层持有和更新 AI 状态。 */
function mountView(overrides: Partial<AnalysisProps> = {}, onAnalyze = vi.fn()) {
  const state = reactive({ ...defaultAnalysis, ...overrides })
  const wrapper = mount(
    () =>
      h(NConfigProvider, null, {
        default: () =>
          h(NMessageProvider, null, {
            default: () =>
              h(
                {
                  components: { MatchCardDetails },
                  setup() {
                    // 提供对局上下文（useCardBorderClass 依赖 team；summary 供 identify 使用）
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
                    return () =>
                      h(MatchCardDetails, {
                        analyzing: state.analyzing,
                        result: state.result,
                        reasoning: state.reasoning,
                        reasoningCollapsed: state.reasoningCollapsed,
                        fromCache: state.fromCache,
                        errorMsg: state.errorMsg,
                        truncatedTip: state.truncatedTip,
                        onAnalyze,
                        'onUpdate:reasoningCollapsed': (collapsed: boolean) => {
                          state.reasoningCollapsed = collapsed
                        }
                      })
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
  return { wrapper, state }
}

describe('MatchCardDetails AI 分析展示', () => {
  it('渲染分析按钮并通过 analyze 事件通知页面层', async () => {
    const onAnalyze = vi.fn()
    const { wrapper } = mountView({}, onAnalyze)

    const button = wrapper.find('.ai-analysis-button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('战犯出列！')

    await button.trigger('click')

    expect(onAnalyze).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(MatchCardDetails).emitted('analyze')).toEqual([[]])
  })

  it('分析中禁用按钮并显示点名中语义', () => {
    const { wrapper } = mountView({ analyzing: true })
    const button = wrapper.find('.ai-analysis-button')

    expect(button.text()).toContain('点名中...')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('已有结果时显示重新点名语义并渲染 markdown', () => {
    const { wrapper } = mountView({ result: '## 总结\n本局表现 **优秀**。', reasoningCollapsed: true })

    expect(wrapper.find('.ai-analysis-button').text()).toContain('战犯再点名！')
    expect(wrapper.find('.ai-analysis-result h2').text()).toBe('总结')
    expect(wrapper.find('.ai-analysis-result').text()).toContain('本局表现 优秀。')
  })

  it('受控展示缓存命中提示、截断提示和错误提示', () => {
    const { wrapper } = mountView({
      result: '缓存的分析结果',
      fromCache: true,
      truncatedTip: '内容因长度限制被截断',
      errorMsg: 'AI 分析失败：服务不可用'
    })

    expect(wrapper.find('.ai-analysis-result').text()).toContain('缓存的分析结果')
    expect(wrapper.find('.ai-analysis-cache-tip').text()).toContain('2 分钟内已点名过')
    expect(wrapper.find('.ai-analysis-truncated-tip').text()).toContain('被截断')
    expect(wrapper.find('.ai-analysis-error').text()).toContain('服务不可用')
  })

  it('reasoning 默认按父层状态折叠，并通过 update 事件同步展开状态', async () => {
    const { wrapper, state } = mountView({ reasoning: '正在分析本局数据…' })
    const component = wrapper.findComponent(MatchCardDetails)

    expect(wrapper.find('.ai-analysis-reasoning-toggle').text()).toContain('点击展开')
    expect(wrapper.find('.ai-analysis-reasoning').exists()).toBe(false)

    await wrapper.find('.ai-analysis-reasoning-toggle').trigger('click')

    expect(state.reasoningCollapsed).toBe(false)
    expect(component.emitted('update:reasoningCollapsed')).toEqual([[false]])
    expect(wrapper.find('.ai-analysis-reasoning').text()).toContain('正在分析本局数据')

    await wrapper.find('.ai-analysis-reasoning-toggle').trigger('click')
    expect(state.reasoningCollapsed).toBe(true)
    expect(wrapper.find('.ai-analysis-reasoning').exists()).toBe(false)
  })

  it('展开 reasoning 后内容真实可见', async () => {
    const { wrapper } = mountView({ reasoning: '父层应看到这段思考' })

    await wrapper.find('.ai-analysis-reasoning-toggle').trigger('click')

    expect(wrapper.find('.ai-analysis-reasoning').isVisible()).toBe(true)
    expect(wrapper.find('.ai-analysis-reasoning').text()).toContain('父层应看到这段思考')
  })
})
