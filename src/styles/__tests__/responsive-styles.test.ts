import { describe, expect, it } from 'vitest'

import cardRoot from '../../components/match-card/MatchCard.vue?raw'
import overview from '../../components/match-card/MatchCardOverview.vue?raw'
import eventsTab from '../../components/match-card/tabs/MatchCardEventsTab.vue?raw'
import summaryTab from '../../components/match-card/tabs/MatchCardSummaryTab.vue?raw'
import diffChart from '../../components/match-card/tabs/timeline/MatchCardDiffLineChart.vue?raw'
import statsLine from '../../components/match-card/tabs/timeline/MatchCardStatsLine.vue?raw'
import teamTable from '../../components/match-card/widgets/TeamTable.vue?raw'
import gameStats from '../../views/game-stats/GameStatsView.vue?raw'
import topNav from '../../views/game-stats/TopNavBar.vue?raw'
import home from '../../views/home/HomeView.vue?raw'
import leaderboards from '../../views/team-leaderboards/LeaderboardsView.vue?raw'
import weekly from '../../views/team-weekly/WeeklyView.vue?raw'

/**
 * 移动端响应式布局约束测试。
 *
 * 背景：对局卡片根节点曾固定 min-width:700px（min-w-175），是战绩列表页/详情页
 * 在窄视口（<700px）横向溢出的唯一根因；解除后组件内的容器查询体系（@[680px] 等）
 * 才能按卡片实际宽度生效。本文件按"源码字符串断言"模式（同 viewport-styles.test.ts）
 * 固化各页面/组件的响应式改造点，防止后续改回固定宽度。
 */
describe('移动端响应式布局约束', () => {
  it('对局卡片根节点不再固定 700px 最小宽度（窄屏横向溢出根因）', () => {
    // min-w-175 = 175 × 0.25rem = 700px：强制卡片至少 700px 宽
    expect(cardRoot).not.toContain('min-w-175')
  })

  it('队伍表格窄容器下可横向滚动，次要列（补刀/经济/装备/野怪目标）渐进隐藏', () => {
    // 根节点：窄容器兜底横向滚动（数据不可裁剪丢失）
    expect(teamTable).toContain('overflow-x-auto')
    // 经济列：与补刀列同策略，窄容器隐藏（CLASSIC 模式）
    expect(teamTable).toContain("hidden @[700px]:block min-w-[5rem] text-center")
    // 装备列：窄容器隐藏（展开详情仍可查看）
    expect(teamTable).toContain('hidden @[640px]:flex')
    // 队头野怪目标区：窄容器隐藏，仅保留禁用位
    expect(teamTable).toContain('hidden @[600px]:flex')
  })

  it('折叠卡总览窄容器下渐进隐藏次要数据列与队员栏', () => {
    // 承伤列：容器 <560px 隐藏
    expect(overview).toMatch(/class="hidden min-w-22 @min-\[560px\]:block"/)
    // 经济列：容器 <620px 隐藏
    expect(overview).toMatch(/hidden min-w-22 @min-\[620px\]:block/)
    // 伤转列：容器 <680px 隐藏
    expect(overview).toMatch(/hidden min-w-22 @min-\[680px\]:block/)
    // 右侧两队队员栏：容器 <680px 隐藏（展开详情有完整名单）
    expect(overview).toContain('@min-[680px]:flex')
  })

  it('战绩页侧栏在小屏为 fixed 抽屉（修复折叠按钮链路）且分页栏可换行', () => {
    // 小屏媒体查询内：侧栏容器必须是 fixed 抽屉定位（旧实现 display:none 内嵌
    // fixed 样式属于死代码，导致"展开侧栏"按钮点击后无任何反应）
    expect(gameStats).toMatch(/@media \(max-width: 900px\)[\s\S]*position: fixed/)
    // 抽屉需有背景遮蔽（覆盖在列表上方时不透出下层内容）
    expect(gameStats).toMatch(/@media \(max-width: 900px\)[\s\S]*z-index/)
    // 分页栏：页码多时允许换行，不横向溢出
    expect(gameStats).toMatch(/\.pagination\s*\{[^}]*flex-wrap: wrap/)
    // 小屏默认收起侧栏：依赖 @vueuse useMediaQuery 判定窄屏
    expect(gameStats).toContain('useMediaQuery')
  })

  it('战绩页顶部导航在 900px 以下重排为可换行布局', () => {
    expect(topNav).toMatch(/@media \(max-width: 900px\)/)
    // 三栏 grid（1fr auto 1fr）在小屏需放开为流式布局
    expect(topNav).toMatch(/@media \(max-width: 900px\)[\s\S]*display: flex/)
  })

  it('榜单中心成员卡英雄基线表有横向滚动兜底', () => {
    // whitespace-nowrap 的 5 列表格在极窄屏（lg 以下全宽面板）不撑破容器
    expect(leaderboards).toMatch(/overflow-x-auto[^>]*>\s*<table/)
  })

  it('车队周报榜单行辅助文案在小屏隐藏', () => {
    // detail 文案（如"22.5% 胜率 · 300 场"）在 <768px 隐藏，保留名次/昵称/数值
    expect(weekly).toMatch(/class="hidden text-sm text-slate-400 md:inline"/)
  })

  it('详情 Tab 双栏组件（事件/差距图/属性线）在窄容器下纵向堆叠', () => {
    // 事件 Tab：左右双栏 → 窄容器上下堆叠
    expect(eventsTab).toMatch(/@max-\[640px\]:flex-col/)
    // 差距线图表：右栏控制面板窄容器下堆叠并占满行宽
    expect(diffChart).toMatch(/@max-\[640px\]:flex-col/)
    expect(diffChart).toMatch(/@max-\[640px\]:w-full!/)
    // 属性时间线：右栏窄容器下占满行宽
    expect(statsLine).toMatch(/@max-\[640px\]:flex-col/)
    expect(statsLine).toMatch(/w-52 flex-col @max-\[640px\]:w-full/)
  })

  it('展开态总览 Tab 的禁用位行允许换行（32 个图标窄屏不溢出）', () => {
    expect(summaryTab).toMatch(/flex min-w-0 flex-wrap justify-end gap-0\.5/)
  })

  it('首页标题在移动端缩小字号', () => {
    // 44px 桌面字号在 375px 视口占比过大
    expect(home).toMatch(/@media \(max-width: 640px\)/)
  })
})
