// 应用入口：负责创建 Vue 应用实例并挂载路由
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
// 全局暗色主题与设计令牌：OP.GG 风格（深蓝黑背景 + 胜利蓝/失败红 + LOL 金点缀）
import './styles/opgg.css'
// Tailwind CSS 4：提供工具类与 @theme 语义色板（bg-surface、text-win 等）
import './styles/tailwind.css'

// 创建应用实例，挂载路由后渲染到 #app
createApp(App).use(router).mount('#app')
