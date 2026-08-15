// 路由配置：应用仅包含对局列表与对局详情两个页面
// 视图组件目前为占位实现，由后续任务补齐
import { createRouter, createWebHistory } from 'vue-router'

import MatchDetailView from '@/views/MatchDetailView.vue'
import MatchListView from '@/views/MatchListView.vue'

// 创建路由实例：使用 HTML5 History 模式，路径为 / 与 /matches/:gameId
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 列表页：展示对局列表，任务 3 实现
    { path: '/', name: 'match-list', component: MatchListView },
    // 详情页：按对局 ID 展示单局详情，任务 4 实现
    { path: '/matches/:gameId', name: 'match-detail', component: MatchDetailView }
  ]
})

export default router
