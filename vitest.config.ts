// Vitest 测试配置：复用 vite 配置的插件与别名，测试环境使用 jsdom
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // 测试环境：jsdom（模拟浏览器 DOM）
      environment: 'jsdom',
      // 测试文件匹配规则：src 下的 *.test.ts
      include: ['src/**/*.test.ts'],
      // 每个用例前自动恢复 mock（清空 mock 实现与调用记录）
      restoreMocks: true
    }
  })
)
