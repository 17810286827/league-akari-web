/**
 * 装备信息查询：懒加载 ddragon 物品数据（item.json），内存缓存，提供名称与属性文本
 * 用于点击装备图标时显示装备名称与属性（tooltip）
 */
import { createLogger } from '@/utils/logger'

const logger = createLogger('ItemInfo')

/** ddragon 物品数据版本（与图标 CDN 保持一致） */
const ITEM_DATA_URL = 'https://ddragon.leagueoflegends.com/cdn/16.16.1/data/zh_CN/item.json'

interface DdragonItem {
  name: string
  plaintext: string
  description: string
}

/** 物品信息缓存：物品 ID → 信息（Promise 去重，避免并发重复请求） */
let itemsCache: Map<number, DdragonItem> | null = null
let loadingPromise: Promise<Map<number, DdragonItem>> | null = null

/** 拉取并缓存全部物品信息（仅首次调用发起网络请求） */
async function loadItems(): Promise<Map<number, DdragonItem>> {
  if (itemsCache) {
    return itemsCache
  }
  if (!loadingPromise) {
    loadingPromise = fetch(ITEM_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`item.json 请求失败: ${response.status}`)
        }
        return response.json() as Promise<{ data: Record<string, DdragonItem> }>
      })
      .then((json) => {
        const map = new Map<number, DdragonItem>()
        for (const [id, item] of Object.entries(json.data)) {
          map.set(Number(id), item)
        }
        itemsCache = map
        logger.info('物品数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        // 失败后清空 promise，允许下次点击重试
        loadingPromise = null
        logger.error('物品数据加载失败', error)
        throw error
      })
  }
  return loadingPromise
}

/** 查询物品名称；数据未就绪或不存在时返回占位 */
export async function getItemName(itemId: number): Promise<string> {
  try {
    const items = await loadItems()
    return items.get(itemId)?.name ?? `物品 ${itemId}`
  } catch {
    return `物品 ${itemId}`
  }
}

/** 查询物品属性描述（优先简洁描述 plaintext，其次清洗 HTML 标签后的完整描述） */
export async function getItemDescription(itemId: number): Promise<string> {
  try {
    const items = await loadItems()
    const item = items.get(itemId)
    if (!item) {
      return ''
    }
    if (item.plaintext) {
      return item.plaintext
    }
    // description 含 HTML 标签，去除标签与样式后返回纯文本
    return item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}
