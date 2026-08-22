/**
 * API 基础地址统一出口：http.ts 与 matches.ts 共用，消除两处重复定义
 * - 默认空字符串 = 相对路径：生产由容器内 nginx 反代 /api 到宿主机 8081，开发由 vite proxy 转发
 * - 保留 VITE_API_BASE_URL 作为逃生舱：需要直连其他后端环境时注入
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''
