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
  /** 升级合成去向 ID 列表（与 LCU 同源数据，老版本数据可能缺失该字段） */
  to?: number[]
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
  /** 升级合成去向 ID 列表（老数据可能缺失；主仓库 items.display 亦返回该字段） */
  to?: number[]
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
  // 非 2xx 一律抛错，由调用方决定降级或放弃本次展示
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
  // 空壳判空约定：未知物品 name 为空串，消费方（如 ItemIcon.vue）据此隐藏价格与描述
  // 价格字段置 0，避免模板在字段缺失时渲染出 "undefined 金币"
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
    // 仅以 name 判空：iconPath/from/priceTotal 等字段缺失由可选链兜底（老数据兼容）
    if (!item?.name) {
      return emptyItemDisplay(itemId)
    }
    return {
      id: item.id,
      name: item.name,
      // iconPath 缺失时 resolveAssetUrl 返回 null，最终兜底为空串
      iconUrl: resolveAssetUrl(item.iconPath ?? '') ?? '',
      descriptionHtml: item.description ?? '',
      price: item.price,
      // 总价（priceTotal 字段名与 CDragon 对齐；totalPrice 保留给既有消费方）
      priceTotal: item.priceTotal,
      // totalPrice 为必填展示字段：priceTotal 缺失时补 0，避免渲染 "undefined 金币"
      totalPrice: item.priceTotal ?? 0,
      // 合成组件 ID（合成路径）
      from: item.from,
      // 升级合成去向 ID（与 from 同源，主仓库 items.display 亦返回）
      to: item.to
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
        // 失败后清空缓存 Promise，允许下次调用重新发起请求
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
        // 失败后清空缓存 Promise，允许下次调用重新发起请求
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
  // 双数据源并行拉取、互不阻塞：CDragon 提供名称/图标，gtimg 提供中文描述/稀有度
  const [cdragonResult, gtimgResult] = await Promise.allSettled([
    loadAugments(),
    loadAugmentDescriptions()
  ])
  // allSettled 保证单个数据源失败（如 CDragon 网络抖动）不影响另一侧组装展示
  const cdragonAugment =
    cdragonResult.status === 'fulfilled' ? cdragonResult.value.get(augmentId) : undefined
  const gtimgAugment =
    gtimgResult.status === 'fulfilled' ? gtimgResult.value.get(augmentId) : undefined
  if (!cdragonAugment && !gtimgAugment) {
    // 两个数据源均未命中：返回空壳（name 为空串），调用方据此渲染占位
    return { name: '', iconUrl: '' }
  }
  return {
    // 中文名优先 gtimg（中文兜底），其次 CDragon 翻译名
    name: gtimgAugment?.name || cdragonAugment?.nameTRA || cdragonAugment?.name || '',
    // 图标优先 CDragon 小图标路径（CDN 解析），CDragon 缺失时退回 gtimg 图标直链
    iconUrl: cdragonAugment
      ? (resolveAssetUrl(cdragonAugment.augmentSmallIconPath ?? cdragonAugment.iconPath ?? '') ?? '')
      : (gtimgAugment?.iconUrl ?? ''),
    // 稀有度以 gtimg 的 level 为准，缺失时退回 CDragon 的 rarity 字段
    rarity: gtimgAugment?.rarity || cdragonAugment?.rarity,
    // 中文描述仅 gtimg 提供（desc 优先，tooltip 兜底，含 HTML 标签）
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
  /**
   * 对局内统计描述（原版 endOfGameStatDescs：含 @eogvarN@ 占位符，
   * 由 RunesTab 用选手对局内的 var1-3 实际数值替换）
   */
  endOfGameStatDescriptions?: string[]
}

/** 符文页样式展示资源 */
export interface PerkstyleDisplayResource {
  name: string
  iconUrl: string
  /** 样式说明文本（主仓库 perkStyles.display 亦返回 tooltip 字段） */
  tooltip?: string
}

/** 符文 JSON 记录（perks.json，longDesc 为填充数值后的 HTML 描述） */
interface Perk {
  id: number
  name?: string
  iconPath?: string
  longDesc?: string
  description?: string
  tooltip?: string
  /** 对局内统计描述（原版字段，含 @eogvarN@ 占位符，老数据可能缺失） */
  endOfGameStatDescs?: string[]
}

/** 符文页样式 JSON 记录（perkstyles.json 的 styles 元素） */
interface Perkstyle {
  id: number
  name?: string
  iconPath?: string
  /** 样式说明（真实数据为 tooltip 字段） */
  tooltip?: string
}

let perksPromise: Promise<Map<number, Perk>> | null = null
let perkstylesPromise: Promise<Map<number, Perkstyle>> | null = null

/** 加载符文表（仅首次调用发起网络请求） */
function loadPerks(): Promise<Map<number, Perk>> {
  if (!perksPromise) {
    // 复用 game-data 拉取链路：zh_cn 优先，失败自动降级 default
    perksPromise = fetchGameDataJson<unknown>('perks.json')
      .then((payload) => {
        const map = toIdMap<Perk>(payload, 'data')
        logger.info('符文数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        // 失败后清空缓存 Promise，允许下次调用重新发起请求
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
    // 解析时优先取 styles 子字段，其次兼容 { data: [...] } 外壳形状
    perkstylesPromise = fetchGameDataJson<unknown>('perkstyles.json')
      .then((payload) => {
        const map = toIdMap<Perkstyle>(payload, 'styles', 'data')
        logger.info('符文页样式数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        // 失败后清空缓存 Promise，允许下次调用重新发起请求
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
    // 未命中或字段不完整（老数据）：返回空壳，消费方据此渲染占位
    if (!perk?.name || !perk.iconPath) {
      return { name: '', iconUrl: '' }
    }
    return {
      name: perk.name,
      // iconPath 缺失时 resolveAssetUrl 返回 null，最终兜底为空串
      iconUrl: resolveAssetUrl(perk.iconPath) ?? '',
      // 描述优先取 longDesc（填充数值的 HTML），兼容 description/tooltip 字段形状
      descriptionHtml: perk.longDesc ?? perk.description ?? perk.tooltip,
      // 对局内统计描述原样透传（占位符由消费方按选手对局数据替换，缺失时为空数组）
      endOfGameStatDescriptions: perk.endOfGameStatDescs ?? []
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
    // 未命中或字段不完整：返回空壳，消费方据此渲染占位
    if (!style?.name || !style.iconPath) {
      return { name: '', iconUrl: '' }
    }
    return {
      name: style.name,
      // 样式图标同样经 resolveAssetUrl 转为 CDN 地址（缺失时为空串）
      iconUrl: resolveAssetUrl(style.iconPath) ?? '',
      // 样式说明透传（缺失时不展示该行）
      tooltip: style.tooltip
    }
  } catch {
    return { name: '', iconUrl: '' }
  }
}

// ---- 冠军（champion）----

/** 冠军摘要 JSON 记录（champion-summary.json；主仓库即用此文件，champions.json 已 404） */
interface ChampionSummary {
  id: number
  name?: string
}

let championsPromise: Promise<Map<number, ChampionSummary>> | null = null
/** 冠军名同步缓存（加载完成后填充；组件模板需同步取值，未命中回退 id 字符串） */
let championNames = new Map<number, string>()

/** 加载冠军表（仅首次调用发起网络请求；失败清空缓存允许重试） */
function loadChampions(): Promise<Map<number, ChampionSummary>> {
  if (!championsPromise) {
    championsPromise = fetchGameDataJson<unknown>('champion-summary.json')
      .then((payload) => {
        const map = toIdMap<ChampionSummary>(payload, 'data')
        // 同步填充名字缓存：供组件模板同步读取（未命中回退 id 字符串）
        championNames = new Map(
          [...map].map(([id, champion]) => [id, champion.name ?? String(id)])
        )
        logger.info('冠军数据加载完成', { count: map.size })
        return map
      })
      .catch((error) => {
        // 失败后清空缓存 Promise，允许下次调用重新发起请求
        championsPromise = null
        logger.error('冠军数据加载失败', error)
        throw error
      })
  }
  return championsPromise
}

/**
 * 同步读取冠军名（对齐原版 providers/game-resource 的 champions.name 语义）：
 * 首次调用触发后台加载（结果写入缓存），未加载完成/未命中时回退 id 字符串
 * @param championId 英雄 ID（-1/-3 等特殊值由调用方自行处理，此处原样回退）
 */
export function getChampionName(championId: number): string {
  // 触发加载（重复调用复用同一 Promise；失败静默，下次调用重试）
  void loadChampions().catch(() => {})
  return championNames.get(championId) ?? String(championId)
}
