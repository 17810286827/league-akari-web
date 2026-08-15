// 路由配置：对局列表、对局详情、玩家详情三个页面
import { createRouter, createWebHistory } from 'vue-router'

import MatchDetailView from '@/views/MatchDetailView.vue'
import MatchListView from '@/views/MatchListView.vue'
import PlayerProfileView from '@/views/player-profile/PlayerProfileView.vue'

// 创建路由实例：使用 HTML5 History 模式
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 列表页：展示对局列表
    { path: '/', name: 'match-list', component: MatchListView },
    // 详情页：按对局 ID 展示单局详情
    { path: '/matches/:gameId', name: 'match-detail', component: MatchDetailView },
    // 玩家详情页：OP.GG 风格玩家数据页（当前使用 mock 数据）
    { path: '/players/:puuid', name: 'player-profile', component: PlayerProfileView }
  ]
})

export default router
