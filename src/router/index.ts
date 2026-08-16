// 路由配置：战绩分析（首页）、对局详情、玩家详情三个页面
import { createRouter, createWebHistory } from 'vue-router'

import MatchDetailView from '@/views/match-detail/MatchDetailView.vue'
import PlayerProfileView from '@/views/player-profile/PlayerProfileView.vue'
import GameStatsView from '@/views/game-stats/GameStatsView.vue'

// 创建路由实例：使用 HTML5 History 模式
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 首页：战绩分析页面（左侧统计边栏 + 右侧战绩列表，可展开单局详情）
    { path: '/', name: 'game-stats', component: GameStatsView },
    // 详情页：按对局 ID 展示单局详情（MatchCard 展开态，卡片内 Tab 切换，替换旧三段式布局）
    { path: '/matches/:gameId', name: 'match-detail', component: MatchDetailView },
    // 玩家详情页：OP.GG 风格玩家数据页（当前使用 mock 数据）
    { path: '/players/:puuid', name: 'player-profile', component: PlayerProfileView }
  ]
})

export default router
