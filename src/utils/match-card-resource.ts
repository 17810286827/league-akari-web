/**
 * match-card 组件用的游戏资源提供者（任务 9 移植原版 providers/game-resource 的 web 简化版）
 * 原版为响应式 provider（locale/colorMode/全套资源表）；web 端：
 * - 仅中文单语言 → runtime.locale 固定 'zh-CN'
 * - 明暗模式跟随系统 prefers-color-scheme（与 Tailwind dark: 变体口径一致）
 * - 冠军名走 @/utils/game-resource 的 CDragon champion-summary 缓存（同步读取，未命中回退 id）
 * 特殊英雄 ID 的文案取自原版 common.yaml（champions.bravery / champions.dummy）
 */
import { getChampionName } from '@/utils/game-resource'

/** 运行时明暗模式（与 Tailwind dark: 变体口径一致：跟随系统） */
function detectColorMode(): 'dark' | 'light' {
  // jsdom 等无 matchMedia 环境按浅色处理，避免测试报错
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 队列名静态表（任务 10：web 无 LCU gameData，取常见队列中文名，未命中回退 id） */
const QUEUE_NAMES: Record<number, string> = {
  // 与既有页面口径一致（src/views/game-stats/adapter.ts / match-detail/adapter.ts）
  420: '单排/双排',
  430: '匹配',
  440: '灵活排位',
  450: '极地大乱斗'
}

/** 地图名静态表（任务 10：web 无 LCU gameData，常见地图中文名，未命中回退 id） */
const MAP_NAMES: Record<number, string> = {
  1: '召唤师峡谷',
  3: '扭曲丛林',
  11: '召唤师峡谷',
  12: '嚎哭深渊'
}

/**
 * 游戏资源提供者（web 简化版）：返回形状对齐原版 useGameResourceProvider 的
 * runtime（locale/colorMode）与 champions.name；items/perks 等其余资源由
 * 任务 7 照搬组件经数据层函数直取，不在此暴露
 */
export function useGameResourceProvider() {
  return {
    runtime: {
      /** 当前语言（web 端仅中文） */
      get locale() {
        return 'zh-CN'
      },
      /** 当前明暗模式：跟随系统（每次读取实时探测，与原版 getter 语义一致） */
      get colorMode() {
        return detectColorMode()
      }
    },
    champions: {
      /**
       * 英雄名（对齐原版 champions.name）：
       * -3 随机/Bravery → 「勇敢举动」；-1 未知 → 「占位」；其余查 CDragon 冠军表，未命中回退 id
       */
      name(id: number) {
        if (id === -3) {
          return '勇敢举动'
        }
        if (id === -1) {
          return '占位'
        }
        return getChampionName(id)
      }
    },
    queues: {
      /** 队列名（对齐原版 queues.name；web 无 LCU gameData，静态表未命中回退 id） */
      name(id: number) {
        return QUEUE_NAMES[id] ?? id.toString()
      }
    },
    maps: {
      /**
       * 地图名（对齐原版 maps.name 签名；web 无 gameModeMutators 数据，
       * 忽略 context 参数直接查静态表，未命中回退 id）
       */
      name(id: number, _context?: { gameModeMutators?: string[] | null }) {
        return MAP_NAMES[id] ?? id.toString()
      }
    }
  }
}
