/**
 * HTTP 客户端封装：基于 axios 的单例实例
 * - 统一配置后端地址与请求超时
 * - 通过请求/响应拦截器输出日志，便于在 DevTools 定位网络问题
 */
import { createLogger } from '@/utils/logger'
import axios from 'axios'

// 创建带 'HTTP' 标签的日志器，方便按来源过滤控制台日志
const logger = createLogger('HTTP')

/** 后端地址：本机运行默认 localhost:8080，可用 VITE_API_BASE_URL 覆盖 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

// 创建 axios 实例：固定 baseURL，10 秒超时防止请求长时间挂起
const http = axios.create({ baseURL, timeout: 10000 })

// 请求前 info 级日志：记录方法、URL 与查询参数，还原调用现场
http.interceptors.request.use((config) => {
  logger.info('Request', config.method?.toUpperCase(), config.url, config.params ?? '')
  return config
})

// 响应失败 error 级日志 + 统一错误消息：记录 URL、错误信息与后端返回体
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? 'unknown'
    logger.error('Request failed', url, error.message, error.response?.data ?? '')
    // 保持原始错误向上抛，由调用方决定如何处理（如 404 提示对局不存在）
    return Promise.reject(error)
  }
)

export default http
