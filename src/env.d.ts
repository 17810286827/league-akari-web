// 引入 Vite 客户端类型：为 import.meta.env 等提供类型声明
/// <reference types="vite/client" />
// 引入 Vue 全局 JSX 命名空间：为 .tsx 文件提供 JSX.IntrinsicElements 等类型（vue-tsc 类型检查需要）
import 'vue/jsx'

// 声明本项目自定义的环境变量类型（Vite 约定的接口增强）
interface ImportMetaEnv {
  /** API 基础地址逃生舱：不配置时为相对路径（生产 nginx 反代 / 开发 vite proxy） */
  readonly VITE_API_BASE_URL?: string
}
