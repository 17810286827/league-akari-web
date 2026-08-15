// 应用入口：负责创建 Vue 应用实例并挂载路由
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

// 创建应用实例，挂载路由后渲染到 #app
createApp(App).use(router).mount('#app')
