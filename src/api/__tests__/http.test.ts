/**
 * http.ts 单元测试：统一响应契约的判别式（对齐后端 #26）
 * - HTTP 200 + code !== 0 → 抛 ApiError（业务失败，携带业务码与可展示文案）
 * - HTTP 200 + code === 0 或非信封响应 → 原样放行
 * - HTTP 非 200 → 由 axios reject（"未达业务"，拦截器不吞）
 */
import { describe, expect, it } from 'vitest'
import type { AxiosResponse } from 'axios'

import { ApiError, checkBusinessFailure } from '../http'

/** 构造 axios 响应体（拦截器入参） */
function axiosResponse(body: unknown): AxiosResponse {
  return { data: body } as unknown as AxiosResponse
}

describe('checkBusinessFailure（业务失败判别式）', () => {
  it('HTTP 200 + code=0 统一信封：原样放行（成功语义）', () => {
    const response = axiosResponse({ code: 0, message: 'ok', data: { gameId: 1 } })
    expect(checkBusinessFailure(response)).toBe(response)
  })

  it('HTTP 200 + code=2001：抛 ApiError，携带业务码与后端文案', () => {
    const response = axiosResponse({ code: 2001, message: '对局不存在: gameId=123' })
    expect(() => checkBusinessFailure(response)).toThrow(ApiError)
    try {
      checkBusinessFailure(response)
    } catch (e) {
      const apiError = e as ApiError
      expect(apiError.code).toBe(2001)
      expect(apiError.message).toBe('对局不存在: gameId=123')
    }
  })

  it('HTTP 200 + code!=0 但 message 缺省：回退通用文案', () => {
    const response = axiosResponse({ code: 5000 })
    expect(() => checkBusinessFailure(response)).toThrow(ApiError)
    try {
      checkBusinessFailure(response)
    } catch (e) {
      expect((e as ApiError).message).toBe('请求失败')
    }
  })

  it('HTTP 200 + 非信封响应体（无 code 字段）：原样放行（非本契约管辖的响应）', () => {
    const response = axiosResponse([{ timestamp: 1000 }])
    expect(checkBusinessFailure(response)).toBe(response)
  })

  it('ApiError 是 Error 实例（调用方 catch (error) + instanceof 双兼容）', () => {
    const error = new ApiError(1101, '车队名单未配置')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.code).toBe(1101)
    expect(error.message).toBe('车队名单未配置')
  })
})
