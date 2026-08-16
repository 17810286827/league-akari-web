// 应用入口：负责创建 Vue 应用实例并挂载路由
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
// 全局暗色主题与设计令牌：OP.GG 风格（纯黑背景 + 胜利蓝/失败红 + LOL 金点缀）
import './styles/opgg.css'
// Tailwind CSS 4：提供工具类与 @theme 语义色板（bg-surface、text-win 等）
import './styles/tailwind.css'
// match-card 卡片样式（任务 9：原版由 TeamTable 等组件内 @import，web 改为全局引入）
import './components/match-card/match-card.css'

// 强制深色模式：dark: 变体为 class 模式（见 tailwind.css），
// 固定 .dark 避免跟随系统主题导致浅色背景 + 白字看不清
document.documentElement.classList.add('dark')

// 创建应用实例，挂载路由后渲染到 #app
createApp(App).use(router).mount('#app')
