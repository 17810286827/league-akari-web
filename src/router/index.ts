// 路由配置：搜索首页、玩家战绩页、对局详情三个页面
import { createRouter, createWebHistory } from 'vue-router'

import MatchDetailView from '@/views/match-detail/MatchDetailView.vue'
import HomeView from '@/views/home/HomeView.vue'
import GameStatsView from '@/views/game-stats/GameStatsView.vue'

// 创建路由实例：使用 HTML5 History 模式
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 首页：居中召唤师搜索框（输入"昵称#tag"，搜索成功跳转战绩页）
    { path: '/', name: 'home', component: HomeView },
    // 玩家战绩页：按 puuid 展示该玩家的对局列表（侧栏统计 + 折叠卡，可展开单局详情）；
    // query 携带昵称/尾号用于顶部展示（?name=xxx&tag=xxx）
    { path: '/players/:puuid', name: 'player-matches', component: GameStatsView },
    // 详情页：按对局 ID 展示单局详情（MatchCard 展开态）
    { path: '/matches/:gameId', name: 'match-detail', component: MatchDetailView }
  ]
})

export default router
