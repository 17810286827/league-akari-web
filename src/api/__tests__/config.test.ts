// API base 配置单测：验证默认相对路径与逃生舱覆盖两种行为
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('API_BASE_URL', () => {
  beforeEach(() => {
    // 每个用例前清掉环境 stub 并重置模块缓存，保证 import 时重新求值默认值
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('默认为空字符串（相对路径：生产走 nginx 反代，开发走 vite proxy）', async () => {
    const { API_BASE_URL } = await import('@/api/config')
    expect(API_BASE_URL).toBe('')
  })

  it('注入 VITE_API_BASE_URL 时覆盖默认值（逃生舱：直连其他后端环境）', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://192.168.31.90:8081')
    const { API_BASE_URL } = await import('@/api/config')
    expect(API_BASE_URL).toBe('http://192.168.31.90:8081')
  })
})
