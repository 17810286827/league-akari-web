/**
 * HTTP 客户端封装：基于 axios 的单例实例
 * - 统一配置后端地址与请求超时
 * - 响应拦截器承载后端 #26 统一响应契约的<b>业务失败判别式</b>（全项目唯一入口）
 * - 通过请求/响应拦截器输出日志，便于在 DevTools 定位网络问题
 */
import { API_BASE_URL } from '@/api/config'
import { createLogger } from '@/utils/logger'
import axios from 'axios'
import type { AxiosResponse } from 'axios'

// 创建带 'HTTP' 标签的日志器，方便按来源过滤控制台日志
const logger = createLogger('HTTP')

// 创建 axios 实例：baseURL 默认空串（相对路径，由部署层转发），10 秒超时防止请求长时间挂起
const http = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })

/**
 * 业务错误：HTTP 200 但 code !== 0（后端统一信封的错误语义，错误码见后端 ErrorCode 登记）。
 * <p>由响应拦截器抛出，调用方 catch 后可直接展示 message；
 * 需要按错误码分支的调用方使用 code 字段（如 2001 对局不存在、1101 名单未配置）。</p>
 */
export class ApiError extends Error {
  /** 业务码：非 0 即失败（与后端 ErrorCode 登记一致） */
  public readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 统一信封判别：{ code: number, ... }（非信封响应如时间线原样数组不在契约管辖内） */
function isApiEnvelope(body: unknown): body is { code: number; message?: string } {
  return typeof body === 'object' && body !== null && 'code' in body
}

/**
 * 业务失败判别式（响应拦截器核心，导出供测试）：
 * <p>后端所有 JSON 接口返回 HTTP 200 + {code, message, data}，错误语义全靠业务码——
 * axios 的 catch 对业务失败永远不触发，必须在此显式转换：</p>
 * <ul>
 *   <li>HTTP 200 + code !== 0 → 抛 {@link ApiError}（message 可直接展示）；</li>
 *   <li>HTTP 200 + code === 0 或非信封响应 → 原样放行；</li>
 *   <li>HTTP 非 200 → 请求未达业务（网络/路由/容器级故障），由 axios 原始 reject 通道处理。</li>
 * </ul>
 */
export function checkBusinessFailure(response: AxiosResponse): AxiosResponse {
  const body: unknown = response.data
  if (isApiEnvelope(body) && body.code !== 0) {
    // 业务失败是预期事件：info 一条（调用方会 catch 并提示），不打 error 刷屏
    logger.info('Business failure', body.code, body.message ?? '')
    throw new ApiError(body.code, body.message ?? '请求失败')
  }
  return response
}

// 请求前 info 级日志：记录方法、URL 与查询参数，还原调用现场
http.interceptors.request.use((config) => {
  logger.info('Request', config.method?.toUpperCase(), config.url, config.params ?? '')
  return config
})

// 响应拦截：成功侧跑业务失败判别式；失败侧（HTTP 非 200）error 级日志后原样向上抛，
// 由调用方决定如何处理（网络错误无响应体，属"未达业务"）
http.interceptors.response.use(checkBusinessFailure, (error) => {
  const url = error.config?.url ?? 'unknown'
  logger.error('Request failed', url, error.message, error.response?.data ?? '')
  // 保持原始错误向上抛，由调用方决定如何处理
  return Promise.reject(error)
})

export default http
