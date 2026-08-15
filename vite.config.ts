// Vite 构建配置：插件、路径别名与开发服务器端口
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // 启用 Vue 单文件组件（SFC）编译与 Tailwind CSS 4 支持
  plugins: [vue(), tailwindcss()],
  resolve: {
    // 路径别名：@ 指向项目根目录下的 src，配合 tsconfig paths 使用
    alias: { '@': '/src' }
  },
  server: {
    // 开发服务器端口：固定 5177，便于本地调试
    port: 5177
  }
})
