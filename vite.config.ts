// Vite 构建配置：插件、路径别名与开发服务器端口
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // 启用 Vue 单文件组件（SFC）、JSX/TSX 编译与 Tailwind CSS 4 支持
  // tsTransform: 'built-in'：让 JSX 转换同时覆盖 .vue 内 <script lang="tsx"> 块
  // （默认 esbuild 模式只转换 .tsx 文件，.vue 内嵌 TSX 会落到 React 风格转换，
  //   悬浮渲染 JSX 时报 "React is not defined"——与原版 electron.vite 配置对齐）
  plugins: [vue(), vueJsx({ tsTransform: 'built-in' }), tailwindcss()],
  resolve: {
    // 路径别名：@ 指向项目根目录下的 src，配合 tsconfig paths 使用
    alias: { '@': '/src' }
  },
  server: {
    // 开发服务器端口：固定 5177，便于本地调试
    port: 5177,
    // 开发环境 API 代理：前端代码用相对路径 /api，开发时转发到本机后端 8081
    // （与生产环境容器内 nginx 反代行为对齐，代码无需区分环境）
    proxy: {
      '/api': 'http://localhost:8081'
    }
  }
})
