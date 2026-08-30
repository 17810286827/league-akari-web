import { describe, expect, it } from 'vitest'

import cardStyle from '../../components/match-card/match-card.css?raw'
import homeStyle from '../../views/home/HomeView.vue?raw'
import statsStyle from '../../views/game-stats/GameStatsView.vue?raw'

/**
 * 验证窗口状态切换相关的布局约束。
 * 该测试覆盖 Edge 最小化/还原时的视口高度和合成层回归。
 */
describe('窗口状态切换样式约束', () => {
  it('首页和战绩页使用动态视口高度，避免固定视口重排闪烁', () => {
    expect(homeStyle).toContain('min-height: 100dvh')
    expect(statsStyle).toContain('min-height: 100dvh')
  })

  it('页面内容不依赖 backdrop-filter，避免 Edge 窗口状态切换重建模糊合成层', () => {
    expect(homeStyle).not.toContain('backdrop-filter')
    expect(statsStyle).not.toContain('backdrop-filter')
    expect(cardStyle).not.toContain('backdrop-filter')
  })
})
