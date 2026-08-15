import { createRouter, createWebHistory } from 'vue-router'

import MatchDetailView from '@/views/MatchDetailView.vue'
import MatchListView from '@/views/MatchListView.vue'

// 路由表：列表页 / 与详情页 /matches/:gameId（视图由后续任务实现，此处为占位组件）
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'match-list', component: MatchListView },
    { path: '/matches/:gameId', name: 'match-detail', component: MatchDetailView }
  ]
})

export default router
