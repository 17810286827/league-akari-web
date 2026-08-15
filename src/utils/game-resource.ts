/**
 * 游戏资源数据层（技能/物品）：完全对齐 League Akari 主仓库 game-resource provider 的机制
 * - 数据源：CommunityDragon 镜像的 LCU game-data JSON（与客户端内 /lol-game-data/assets/v1/ 同一份数据）
 * - 图标：JSON 中的 iconPath（LCU 相对路径）→ CommunityDragon CDN URL（去前缀 + 小写化，照抄主仓库 resolve 逻辑）
 * - 描述：技能/物品 JSON 的 description 字段（与主仓库 SummonerSpellDisplay 展示一致）
 */
import { createLogger } from '@/utils/logger'

const logger = createLogger('GameResource')

// CommunityDragon 数据根地址（与主仓库 storybook.ts 常量一致）
const CDRAGON_GAME_DATA_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'
const CDRAGON_DEFAULT_ASSET_BASE = `${CDRAGON_GAME_DATA_BASE}/default`
// LCU 资源路径前缀（iconPath 以它开头）
const LCU_ASSET_PREFIX = '/lol-game-data/assets/'

/** 技能 JSON 结构（与主仓库 SummonerSpell 类型一致） */
interface SummonerSpell {
  id: number
  name: string
  description: string
  summonerLevel: number
  cooldown: number
  iconPath: string
}

/** 物品 JSON 结构（与主仓库 Item 类型一致） */
interface Item {
  id: number
  name: string
  description: string
  price: number
  priceTotal: number
  iconPath: string
}

/** 技能展示资源（对齐主仓库 SummonerSpellDisplayResource） */
export interface SpellDisplayResource {
  id: number
  name: string
  /** 转换后的 CDN 图标地址 */
  iconUrl: string
  description: string
  cooldown: number
  summonerLevel: number
}

/** 物品展示资源（对齐主仓库 ItemDisplayResource 的核心字段） */
export interface ItemDisplayResource {
  id: number
  name: string
  /** 转换后的 CDN 图标地址 */
  iconUrl: string
  /** 物品属性描述（HTML 文本） */
  descriptionHtml: string
  price: number
  totalPrice: number
}

/**
 * 把 LCU 资源路径转换为 CommunityDragon CDN 地址（照抄主仓库 resolveCommunityDragonAssetUrl）：
 * 去掉 /lol-game-data/assets/ 前缀并小写化，拼接到 default 资源根
 */
export function resolveAssetUrl(iconPath: string): string | null {
  const normalized = iconPath.trim()
  if (!normalized.startsWith('/')) {
    return null
  }
  const pathOnly = normalized.split(/[?#]/, 1)[0]
  const lowerPath = pathOnly.toLowerCase()
  if (lowerPath.startsWith(LCU_ASSET_PREFIX)) {
    const relative = pathOnly.slice(LCU_ASSET_PREFIX.length).replace(/^\/+/, '').toLowerCase()
    return `${CDRAGON_DEFAULT_ASSET_BASE}/${relative}`
  }
  return `${CDRAGON_DEFAULT_ASSET_BASE}${pathOnly.toLowerCase()}`
}

/** 拉取 game-data JSON：优先 zh_cn 语言，失败降级 default（照抄主仓库 fetchGameDataJson） */
async function fetchGameDataJson<T>(file: string): Promise<T> {
  const localizedUrl = `${CDRAGON_GAME_DATA_BASE}/zh_cn/v1/${file}`
  try {
    const response = await fetch(localizedUrl)
    if (!response.ok) {
      throw new Error(`game-data ${file} 请求失败: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    logger.warn('本地化 game-data 加载失败，降级 default', { file, error })
    const response = await fetch(`${CDRAGON_GAME_DATA_BASE}/default/v1/${file}`)
    if (!response.ok) {
      throw new Error(`game-data ${file} 请求失败: ${response.status}`)
    }
    return (await response.json()) as T
  }
}

/** 资源缓存（Promise 去重，避免并发重复请求） */
let spellsPromise: Promise<Map<number, SummonerSpell>> | null = null
let itemsPromise: Promise<Map<number, Item>> | null = null

/** 加载技能表（仅首次调用发起网络请求） */
function loadSpells(): Promise<Map<number, SummonerSpell>> {
  if (!spellsPromise) {
    spellsPromise = fetchGameDataJson<SummonerSpell[]>('summoner-spells.json')
      .then((list) => {
        const map = new Map<number, SummonerSpell>()
        for (const spell of list) {
          map.set(spell.id, spell)
        }
        logger.info('技能数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        spellsPromise = null
        logger.error('技能数据加载失败', error)
        throw error
      })
  }
  return spellsPromise
}

/** 加载物品表（仅首次调用发起网络请求） */
function loadItems(): Promise<Map<number, Item>> {
  if (!itemsPromise) {
    itemsPromise = fetchGameDataJson<Item[]>('items.json')
      .then((list) => {
        const map = new Map<number, Item>()
        for (const item of list) {
          map.set(item.id, item)
        }
        logger.info('物品数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        itemsPromise = null
        logger.error('物品数据加载失败', error)
        throw error
      })
  }
  return itemsPromise
}

/** 查询技能展示资源；未知技能或数据未就绪返回 null */
export async function spellDisplay(spellId: number): Promise<SpellDisplayResource | null> {
  try {
    const spells = await loadSpells()
    const spell = spells.get(spellId)
    if (!spell?.name || !spell.iconPath) {
      return null
    }
    return {
      id: spell.id,
      name: spell.name,
      iconUrl: resolveAssetUrl(spell.iconPath) ?? '',
      description: spell.description,
      cooldown: spell.cooldown,
      summonerLevel: spell.summonerLevel
    }
  } catch {
    return null
  }
}

/** 查询物品展示资源；未知物品或数据未就绪返回 null */
export async function itemDisplay(itemId: number): Promise<ItemDisplayResource | null> {
  try {
    const items = await loadItems()
    const item = items.get(itemId)
    if (!item?.name || !item.iconPath) {
      return null
    }
    return {
      id: item.id,
      name: item.name,
      iconUrl: resolveAssetUrl(item.iconPath) ?? '',
      descriptionHtml: item.description,
      price: item.price,
      totalPrice: item.priceTotal
    }
  } catch {
    return null
  }
}
