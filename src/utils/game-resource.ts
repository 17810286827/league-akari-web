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
  /** 合成组件 ID 列表（老版本数据可能缺失该字段） */
  from?: number[]
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
  /** 合成费（CDragon items.json 的 price 字段） */
  price: number
  /** 总价（CDragon items.json 的 priceTotal 字段，老数据可能缺失） */
  priceTotal?: number
  /** 总价（保留原名以兼容 ItemIcon.vue 等既有消费方） */
  totalPrice: number
  /** 合成组件 ID 列表（合成路径，老数据可能缺失） */
  from?: number[]
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

/** 拉取任意 JSON（无语言降级），用于 gtimg 等外部数据源 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`请求失败: ${url} (${response.status})`)
  }
  return (await response.json()) as T
}

/**
 * 把 game-data JSON 归一化为 id → 记录 的 Map，兼容两种数据形状：
 * - 数组（CDragon 真实格式，记录自带 id 字段）
 * - 键值对象（{ data: { '30': {...} } }，键名即 id）
 * subKeys 用于从对象外壳中取出数据体（如 perkstyles.json 的 styles 字段）
 */
function toIdMap<T extends object>(payload: unknown, ...subKeys: string[]): Map<number, T> {
  const map = new Map<number, T>()
  let source: unknown = payload
  // 对象外壳（如 { data: ... }、{ styles: ... }）取数据体
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const wrapper = source as Record<string, unknown>
    for (const key of subKeys) {
      if (wrapper[key] !== undefined) {
        source = wrapper[key]
        break
      }
    }
  }
  if (Array.isArray(source)) {
    // 数组形状：取记录自带 id 字段
    for (const raw of source) {
      const record = raw as Record<string, unknown>
      if (typeof record.id === 'number') {
        map.set(record.id, record as unknown as T)
      }
    }
  } else if (source && typeof source === 'object') {
    // 键值对象形状：键名即 id
    for (const [key, record] of Object.entries(source as Record<string, unknown>)) {
      const id = Number(key)
      if (Number.isFinite(id) && record && typeof record === 'object') {
        map.set(id, record as unknown as T)
      }
    }
  }
  return map
}

/** 资源缓存（Promise 去重，避免并发重复请求） */
let spellsPromise: Promise<Map<number, SummonerSpell>> | null = null
let itemsPromise: Promise<Map<number, Item>> | null = null

/** 加载技能表（仅首次调用发起网络请求） */
function loadSpells(): Promise<Map<number, SummonerSpell>> {
  if (!spellsPromise) {
    spellsPromise = fetchGameDataJson<unknown>('summoner-spells.json')
      .then((payload) => {
        const map = toIdMap<SummonerSpell>(payload, 'data')
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
    itemsPromise = fetchGameDataJson<unknown>('items.json')
      .then((payload) => {
        const map = toIdMap<Item>(payload, 'data')
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

/** 未知物品展示资源空壳（name 为空串，消费方据此判空） */
function emptyItemDisplay(id: number): ItemDisplayResource {
  return { id, name: '', iconUrl: '', descriptionHtml: '', price: 0, totalPrice: 0 }
}

/**
 * 查询物品展示资源；未知物品或数据未就绪返回空壳（name 为空串）。
 * 注：与 spellDisplay 不同，本函数不返回 null——简报测试与消费方均按非空资源使用
 */
export async function itemDisplay(itemId: number): Promise<ItemDisplayResource> {
  try {
    const items = await loadItems()
    const item = items.get(itemId)
    if (!item?.name) {
      return emptyItemDisplay(itemId)
    }
    return {
      id: item.id,
      name: item.name,
      iconUrl: resolveAssetUrl(item.iconPath ?? '') ?? '',
      descriptionHtml: item.description ?? '',
      price: item.price,
      // 总价（priceTotal 字段名与 CDragon 对齐；totalPrice 保留给既有消费方）
      priceTotal: item.priceTotal,
      totalPrice: item.priceTotal,
      // 合成组件 ID（合成路径）
      from: item.from
    }
  } catch {
    return emptyItemDisplay(itemId)
  }
}

// ---- 海克斯强化（augment）----

/** 海克斯强化展示资源（名称/图标来自 CDragon，稀有度/中文描述来自 gtimg） */
export interface AugmentDisplayResource {
  name: string
  iconUrl: string
  /** gtimg 稀有度：kBronze/kSilver/kGold/kPrismatic */
  rarity?: string
  /** 中文描述（gtimg，HTML 文本） */
  descriptionHtml?: string
}

/** CDragon 海克斯强化 JSON 记录（cherry-augments.json，与主仓库 Augment 类型一致） */
interface Augment {
  id: number
  /** 中文名（主仓库使用字段） */
  nameTRA?: string
  /** 中文名（测试/兜底形状使用的字段名） */
  name?: string
  /** 小图标路径（主仓库使用字段） */
  augmentSmallIconPath?: string
  /** 图标路径（测试/兜底形状使用的字段名） */
  iconPath?: string
  rarity?: string
}

/** gtimg kiwi_augments.json 规范化记录（中文描述 + 稀有度） */
interface GtimgAugment {
  id: number
  name: string
  description: string
  rarity?: string
  iconUrl?: string
}

// gtimg 腾讯官方数据源（中文描述 + 稀有度，CORS 已放开）
const GTIMG_AUGMENTS_URL = 'https://game.gtimg.cn/images/lol/act/img/js/kiwi/kiwi_augments.json'

let augmentsPromise: Promise<Map<number, Augment>> | null = null
let augmentDescriptionsPromise: Promise<Map<number, GtimgAugment>> | null = null

/**
 * 把 gtimg kiwi_augments.json 解析为 id → 规范化记录 的 Map：
 * 真实数据为数组（augmentID/name_cn/desc/level/large_Icon），
 * 兼容 { data: { '30': {...} } } 键值对象形状（测试/兼容场景）
 */
function toGtimgAugmentMap(payload: unknown): Map<number, GtimgAugment> {
  const map = new Map<number, GtimgAugment>()
  let source: unknown = payload
  // 对象外壳（{ data: [...] } 或 { data: { id: 记录 } }）取数据体
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const wrapper = source as Record<string, unknown>
    if (wrapper.data !== undefined) {
      source = wrapper.data
    }
  }
  // 单条记录 → 规范化字段（优先 gtimg 字段名，其次通用字段名）
  const push = (id: number, record: Record<string, unknown>) => {
    map.set(id, {
      id,
      name: String(record.name_cn ?? record.name ?? record.name_en ?? ''),
      description: String(record.desc ?? record.description ?? record.tooltip ?? ''),
      rarity:
        typeof record.level === 'string'
          ? record.level
          : typeof record.rarity === 'string'
            ? record.rarity
            : undefined,
      iconUrl:
        typeof record.large_Icon === 'string'
          ? record.large_Icon
          : typeof record.small_Icon === 'string'
            ? record.small_Icon
            : undefined
    })
  }
  if (Array.isArray(source)) {
    // 数组形状：真实 gtimg 数据使用 augmentID 字段
    for (const raw of source) {
      const record = raw as Record<string, unknown>
      const id = typeof record.augmentID === 'number' ? record.augmentID : record.id
      if (typeof id === 'number') {
        push(id, record)
      }
    }
  } else if (source && typeof source === 'object') {
    // 键值对象形状：键名即 id
    for (const [key, record] of Object.entries(source as Record<string, unknown>)) {
      const id = Number(key)
      if (Number.isFinite(id) && record && typeof record === 'object') {
        push(id, record as Record<string, unknown>)
      }
    }
  }
  return map
}

/**
 * 加载海克斯强化表（仅首次调用发起网络请求）。
 * 注：CDragon 并无 augments.json（404），实际文件为 cherry-augments.json（与主仓库一致）
 */
function loadAugments(): Promise<Map<number, Augment>> {
  if (!augmentsPromise) {
    augmentsPromise = fetchGameDataJson<unknown>('cherry-augments.json')
      .then((payload) => {
        const map = toIdMap<Augment>(payload, 'data')
        logger.info('海克斯强化数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        augmentsPromise = null
        logger.error('海克斯强化数据加载失败', error)
        throw error
      })
  }
  return augmentsPromise
}

/** 加载 gtimg 海克斯强化中文描述/稀有度（仅首次调用发起网络请求） */
function loadAugmentDescriptions(): Promise<Map<number, GtimgAugment>> {
  if (!augmentDescriptionsPromise) {
    augmentDescriptionsPromise = fetchJson<unknown>(GTIMG_AUGMENTS_URL)
      .then((payload) => {
        const map = toGtimgAugmentMap(payload)
        logger.info('海克斯强化中文描述加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        augmentDescriptionsPromise = null
        logger.error('海克斯强化中文描述加载失败', error)
        throw error
      })
  }
  return augmentDescriptionsPromise
}

/**
 * 查询海克斯强化展示资源：CDragon（名称/图标）与 gtimg（中文描述/稀有度）并行拉取、
 * 互不阻塞，任一数据源成功即可组装展示；两者都未命中返回空壳（name 为空串）
 */
export async function augmentDisplay(augmentId: number): Promise<AugmentDisplayResource> {
  const [cdragonResult, gtimgResult] = await Promise.allSettled([
    loadAugments(),
    loadAugmentDescriptions()
  ])
  const cdragonAugment =
    cdragonResult.status === 'fulfilled' ? cdragonResult.value.get(augmentId) : undefined
  const gtimgAugment =
    gtimgResult.status === 'fulfilled' ? gtimgResult.value.get(augmentId) : undefined
  if (!cdragonAugment && !gtimgAugment) {
    return { name: '', iconUrl: '' }
  }
  return {
    // 中文名优先 gtimg（中文兜底），其次 CDragon 翻译名
    name: gtimgAugment?.name || cdragonAugment?.nameTRA || cdragonAugment?.name || '',
    iconUrl: cdragonAugment
      ? (resolveAssetUrl(cdragonAugment.augmentSmallIconPath ?? cdragonAugment.iconPath ?? '') ?? '')
      : (gtimgAugment?.iconUrl ?? ''),
    rarity: gtimgAugment?.rarity || cdragonAugment?.rarity,
    descriptionHtml: gtimgAugment?.description
  }
}

// ---- 符文（perks）----

/** 符文展示资源 */
export interface PerkDisplayResource {
  name: string
  iconUrl: string
  /** 符文描述（HTML 文本，优先 CDragon longDesc 填充后描述） */
  descriptionHtml?: string
}

/** 符文页样式展示资源 */
export interface PerkstyleDisplayResource {
  name: string
  iconUrl: string
}

/** 符文 JSON 记录（perks.json，longDesc 为填充数值后的 HTML 描述） */
interface Perk {
  id: number
  name?: string
  iconPath?: string
  longDesc?: string
  description?: string
  tooltip?: string
}

/** 符文页样式 JSON 记录（perkstyles.json 的 styles 元素） */
interface Perkstyle {
  id: number
  name?: string
  iconPath?: string
}

let perksPromise: Promise<Map<number, Perk>> | null = null
let perkstylesPromise: Promise<Map<number, Perkstyle>> | null = null

/** 加载符文表（仅首次调用发起网络请求） */
function loadPerks(): Promise<Map<number, Perk>> {
  if (!perksPromise) {
    perksPromise = fetchGameDataJson<unknown>('perks.json')
      .then((payload) => {
        const map = toIdMap<Perk>(payload, 'data')
        logger.info('符文数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        perksPromise = null
        logger.error('符文数据加载失败', error)
        throw error
      })
  }
  return perksPromise
}

/** 加载符文页样式表（仅首次调用发起网络请求；真实结构为 { styles: [...] }） */
function loadPerkstyles(): Promise<Map<number, Perkstyle>> {
  if (!perkstylesPromise) {
    perkstylesPromise = fetchGameDataJson<unknown>('perkstyles.json')
      .then((payload) => {
        const map = toIdMap<Perkstyle>(payload, 'styles', 'data')
        logger.info('符文页样式数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        perkstylesPromise = null
        logger.error('符文页样式数据加载失败', error)
        throw error
      })
  }
  return perkstylesPromise
}

/** 查询符文展示资源；未知符文或数据未就绪返回空壳（name 为空串） */
export async function perkDisplay(perkId: number): Promise<PerkDisplayResource> {
  try {
    const perks = await loadPerks()
    const perk = perks.get(perkId)
    if (!perk?.name || !perk.iconPath) {
      return { name: '', iconUrl: '' }
    }
    return {
      name: perk.name,
      iconUrl: resolveAssetUrl(perk.iconPath) ?? '',
      // 描述优先取 longDesc（填充数值的 HTML），兼容 description/tooltip 字段形状
      descriptionHtml: perk.longDesc ?? perk.description ?? perk.tooltip
    }
  } catch {
    return { name: '', iconUrl: '' }
  }
}

/** 查询符文页样式展示资源；未知样式或数据未就绪返回空壳（name 为空串） */
export async function perkstyleDisplay(styleId: number): Promise<PerkstyleDisplayResource> {
  try {
    const styles = await loadPerkstyles()
    const style = styles.get(styleId)
    if (!style?.name || !style.iconPath) {
      return { name: '', iconUrl: '' }
    }
    return {
      name: style.name,
      iconUrl: resolveAssetUrl(style.iconPath) ?? ''
    }
  } catch {
    return { name: '', iconUrl: '' }
  }
}
