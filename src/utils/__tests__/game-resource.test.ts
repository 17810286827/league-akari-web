import { beforeEach, describe, expect, it, vi } from 'vitest'
import { augmentDisplay, itemDisplay, perkDisplay, perkstyleDisplay } from '../game-resource'

const ok = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) } as Response)

describe('game-resource 扩展', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] }))))

  it('augmentDisplay 返回名称/图标/稀有度（gtimg 中文兜底）', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        data: {
          '30': { name: '全凭身手', iconPath: '/lol-game-data/assets/v1/augments/30.png' }
        }
      })
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ data: { '30': { name: '全凭身手', description: '击杀后回复生命', rarity: 'kGold' } } })
    )
    const display = await augmentDisplay(30)
    expect(display.name).toBe('全凭身手')
    expect(display.rarity).toBe('kGold')
    expect(display.descriptionHtml).toContain('击杀后回复')
    expect(display.iconUrl).toContain('augments/30.png')
  })

  it('itemDisplay 增强：合成路径 from 与总价', async () => {
    // loadItems 会并行探测 Data Dragon 版本：先应答 versions.json，再应答 items.json
    vi.mocked(fetch).mockResolvedValueOnce(ok(['16.17.1']))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        data: {
          '3089': { name: '无尽之刃', from: [1038], priceTotal: 3400, price: 1200 },
          '1038': { name: '长剑', from: [], priceTotal: 350, price: 350, iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/1038.png' }
        }
      })
    )
    const display = await itemDisplay(3089)
    // 合成组件按 items 记录组装（含名称与图标路径）；组件图标由 itemIconUrl 动态版本构建（此处探测到 16.17.1）
    expect(display.from).toEqual([{ id: 1038, name: '长剑', iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/1038.png' }])
    expect(display.priceTotal).toBe(3400)
  })

  it('perkDisplay / perkstyleDisplay 返回描述与图标', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ data: { '8112': { name: '电刑', description: '爆发伤害', iconPath: '/x.png' } } }))
      .mockResolvedValueOnce(ok({ data: { '8100': { name: '主宰', iconPath: '/y.png' } } }))
    const perk = await perkDisplay(8112)
    expect(perk.name).toBe('电刑')
    const style = await perkstyleDisplay(8100)
    expect(style.name).toBe('主宰')
  })

  it('数组形状（CDragon 真实格式）可解析：items/perks 数组与 perkstyles 的 styles 子字段', async () => {
    // 重置模块缓存：避免命中前置用例的 Promise 缓存，强制本用例重新发起网络请求
    vi.resetModules()
    const fresh = await import('../game-resource')
    // loadItems 会并行探测 Data Dragon 版本：先应答 versions.json
    vi.mocked(fetch).mockResolvedValueOnce(ok(['16.17.1']))
    // items.json 真实为数组（记录自带 id/from/priceTotal/to）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        { id: 3089, name: '无尽之刃', description: '', price: 1200, priceTotal: 3400, from: [1038], to: [1053], iconPath: '/lol-game-data/assets/v1/3089.png' },
        { id: 1038, name: '长剑', description: '', price: 350, priceTotal: 350, from: [], to: [3089], iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/1038.png' }
      ])
    )
    // perks.json 真实为数组（longDesc 为填充数值后的 HTML 描述）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ id: 8112, name: '电刑', longDesc: '爆发伤害', iconPath: '/lol-game-data/assets/v1/8112.png' }])
    )
    // perkstyles.json 真实结构为 { styles: [...] }，需取 styles 子字段（tooltip 为样式说明）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ schemaVersion: 2, styles: [{ id: 8100, name: '主宰', tooltip: '提升攻击或法术强度', iconPath: '/lol-game-data/assets/v1/8100.png' }] })
    )
    const item = await fresh.itemDisplay(3089)
    expect(item.name).toBe('无尽之刃')
    expect(item.from).toEqual([{ id: 1038, name: '长剑', iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/1038.png' }])
    // to 指向 1053，但 mock 无该记录：组件未命中时跳过（图标无法推导）
    expect(item.to).toEqual([])
    expect(item.priceTotal).toBe(3400)
    const perk = await fresh.perkDisplay(8112)
    expect(perk.name).toBe('电刑')
    expect(perk.descriptionHtml).toBe('爆发伤害')
    const style = await fresh.perkstyleDisplay(8100)
    expect(style.name).toBe('主宰')
    expect(style.iconUrl).toContain('8100.png')
    expect(style.tooltip).toBe('提升攻击或法术强度')
  })

  it('gtimg 数组形状（augmentID/name_cn/desc/level）解析为中文描述与稀有度', async () => {
    // 重置模块缓存：避免命中前置用例的 Promise 缓存，强制本用例重新发起网络请求
    vi.resetModules()
    const fresh = await import('../game-resource')
    // cherry-augments.json 真实为数组（nameTRA/augmentSmallIconPath/rarity）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ id: 1205, nameTRA: '物理转魔法', augmentSmallIconPath: '/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/ADAPt_small.png', rarity: 'kSilver' }])
    )
    // kiwi_augments.json 真实为数组（augmentID/name_cn/desc/level/large_Icon）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ augmentID: 1205, name_cn: '物理转魔法', desc: '将<scaleAD>额外攻击力</scaleAD>转化为<scaleAP>法术强度</scaleAP>', level: 'kSilver', large_Icon: 'https://game.gtimg.cn/images/lol/act/img/rune/adapt_large.png' }])
    )
    const display = await fresh.augmentDisplay(1205)
    expect(display.name).toBe('物理转魔法')
    expect(display.rarity).toBe('kSilver')
    expect(display.descriptionHtml).toContain('法术强度')
    // resolveAssetUrl 会小写化资源路径，故断言小写文件名
    expect(display.iconUrl).toContain('adapt_small.png')
  })
})

describe('修复回归：海克斯占位符与装备合成路径', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] }))))

  it('gtimg 键值对象形状（键为索引、augmentID 在记录内）：按 augmentID 命中且取 tooltip 干净文本', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ id: 1077, nameTRA: '虹吸', augmentSmallIconPath: '/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/SoulSiphon_small.png', rarity: 'kGold' }])
    )
    // 真实 kiwi 数据形态：顶层键是数组索引（'12'），augmentID 在记录内；desc 带占位符、tooltip 干净
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        '12': { augmentID: 1077, name_cn: '灵魂虹吸', desc: '获得<crit>@CritChance*100@%暴击几率</crit>和<lifeSteal>@HealPercentage*100@%生命偷取</lifeSteal>。', tooltip: '获得暴击几率和作用于暴击的生命偷取。', level: 'kGold', large_Icon: 'https://game.gtimg.cn/images/lol/act/img/rune/soulsiphon_large.png' }
      })
    )
    const display = await fresh.augmentDisplay(1077)
    // 名称取 gtimg name_cn（完整中文名），而非 CDragon nameTRA
    expect(display.name).toBe('灵魂虹吸')
    // 描述取 tooltip（无占位符的干净文本），不泄漏 {{xx}}/@xx@ 占位符
    expect(display.descriptionHtml).toBe('获得暴击几率和作用于暴击的生命偷取。')
    expect(display.descriptionHtml).not.toContain('@')
  })

  it('tooltip 缺失时回退 desc（不崩溃）', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(ok([{ id: 1022, nameTRA: '灵巧', augmentSmallIconPath: '/x.png', rarity: 'kSilver' }]))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ '12': { augmentID: 1022, name_cn: '灵巧', desc: '获得@AttackSpeed*100@%攻击速度。', level: 'kSilver' } })
    )
    const display = await fresh.augmentDisplay(1022)
    expect(display.name).toBe('灵巧')
    expect(display.rarity).toBe('kSilver')
    // desc 含占位符但可展示（tooltip 缺失时的兜底语义）
    expect(display.descriptionHtml).toContain('攻击速度')
  })

  it('itemDisplay 的 to 字段为数字 0（CDragon 老格式）时归一为空数组，不抛错', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    // loadItems 会并行探测 Data Dragon 版本：先应答 versions.json
    vi.mocked(fetch).mockResolvedValueOnce(ok(['16.17.1']))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        data: {
          '3089': { name: '灭世者的死亡之帽', from: [1058, 1058], to: 0, priceTotal: 3600, price: 1200, iconPath: '/x.png' },
          '1058': { name: '灭世法典', from: [], priceTotal: 1200, price: 1200, iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/1058.png' }
        }
      })
    )
    const display = await fresh.itemDisplay(3089)
    // 组件图标由 itemIconUrl 动态版本构建（本用例探测到 16.17.1）
    expect(display.from).toEqual([
      { id: 1058, name: '灭世法典', iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/1058.png' },
      { id: 1058, name: '灭世法典', iconPath: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/1058.png' }
    ])
    expect(display.to).toEqual([])
  })
})

/**
 * 装备图标双源策略回归（动态版本主源 + CDragon 兜底）：
 * 背景：写死 ddragon 版本落后导致新装备图标 404（如 16.17.1 新增的
 * ARAM 装备 226668 终极九头蛇），策略改为——版本号动态探测作主源，
 * items.json 自带的 iconPath 解析出的 CDragon 资源 URL 作兜底。
 */
describe('装备图标动态版本 + CDragon 兜底', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] }))))

  it('itemDisplay 的 iconUrl 用动态版本，fallbackIconUrl 由 iconPath 解析（小写化）', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(ok(['16.17.1']))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        {
          id: 226668,
          name: '终极九头蛇',
          description: '',
          price: 0,
          priceTotal: 2500,
          iconPath: '/lol-game-data/assets/ASSETS/Items/Icons2D/Kiwi/ARAM_UltimateHydra_64.png'
        }
      ])
    )
    const display = await fresh.itemDisplay(226668)
    // 主源：Data Dragon（探测到的最新版本，写死版本下该图标 404）
    expect(display.iconUrl).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/226668.png'
    )
    // 兜底源：iconPath 去 LCU 前缀 + 小写化 → CDragon 资源地址（已实测可达）
    expect(display.fallbackIconUrl).toBe(
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/kiwi/aram_ultimatehydra_64.png'
    )
  })

  it('versions.json 探测失败不阻塞物品加载：iconUrl 回退兜底版本，fallbackIconUrl 仍可用', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockRejectedValueOnce(new Error('versions down'))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        {
          id: 226668,
          name: '终极九头蛇',
          description: '',
          price: 0,
          priceTotal: 2500,
          iconPath: '/lol-game-data/assets/ASSETS/Items/Icons2D/Kiwi/ARAM_UltimateHydra_64.png'
        }
      ])
    )
    const display = await fresh.itemDisplay(226668)
    // 探测失败：主源 URL 退回写死版本（此时由 CdnImage 的 fallback 链路兜底）
    expect(display.iconUrl).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/226668.png'
    )
    expect(display.fallbackIconUrl).toContain('aram_ultimatehydra_64.png')
  })

  it('iconPath 缺失（CDragon 老数据）时 fallbackIconUrl 为 undefined', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(ok(['16.17.1']))
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ id: 1001, name: '鞋子', description: '', price: 300, priceTotal: 300 }])
    )
    const display = await fresh.itemDisplay(1001)
    expect(display.iconUrl).toContain('/16.17.1/img/item/1001.png')
    // 老数据无 iconPath：不虚构兜底地址，字段缺省（消费方按无兜底处理）
    expect(display.fallbackIconUrl).toBeUndefined()
  })
})

/**
 * 英雄筛选选项数据源（按英雄过滤对局功能）：
 * champion-summary 的 name 为称号、description 为本名，选项双字段供称号/本名实时匹配；
 * 非英雄记录（id ≤ 0，如 -1 "无"）必须排除；
 * 60001+ 段旧称号重复记录按本名去重，保留正式 id（称号最新）的一条。
 */
describe('listChampionOptions 英雄筛选选项', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] }))))

  it('返回全部正 id 英雄，label 取本名（description），title 取称号（name），按 id 升序', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        { id: -1, name: '无', description: '', alias: 'None' },
        { id: 266, name: '堕天使', description: '莫甘娜', alias: 'Morgana' },
        { id: 1, name: '黑暗之女', description: '安妮', alias: 'Annie' },
        { id: 22, name: '赏金猎人', description: '厄运小姐', alias: 'MissFortune' }
      ])
    )
    const options = await fresh.listChampionOptions()
    // 排除 id=-1；按 id 升序；label 为本名（description）、title 为称号（name）
    expect(options).toEqual([
      { id: 1, label: '安妮', title: '黑暗之女' },
      { id: 22, label: '厄运小姐', title: '赏金猎人' },
      { id: 266, label: '莫甘娜', title: '堕天使' }
    ])
  })

  it('description 缺失时 label 回退称号（name），title 同步回退，两者皆缺回退 id 字符串', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        { id: 10, name: '时光守护者' },
        { id: 20, name: undefined, description: undefined }
      ])
    )
    const options = await fresh.listChampionOptions()
    expect(options).toContainEqual({ id: 10, label: '时光守护者', title: '时光守护者' })
    expect(options).toContainEqual({ id: 20, label: '20', title: '20' })
  })

  it('60001+ 段旧称号重复记录去重：同本名保留正式 id（数值更小）的一条', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        // 正式 id 现行称号（应保留）
        { id: 13, name: '符文法师', description: '瑞兹', alias: 'Ryze' },
        // 60001+ 段旧称号重复（应丢弃）
        { id: 60013, name: '流浪法师', description: '瑞兹', alias: 'Ryze' },
        { id: 266, name: '暗裔剑魔', description: '亚托克斯', alias: 'Aatrox' }
      ])
    )
    const options = await fresh.listChampionOptions()
    expect(options).toEqual([
      { id: 13, label: '瑞兹', title: '符文法师' },
      { id: 266, label: '亚托克斯', title: '暗裔剑魔' }
    ])
  })

  it('加载失败返回空数组（下拉回退"所有英雄"单项，不抛错）', async () => {
    vi.resetModules()
    const fresh = await import('../game-resource')
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))
    const options = await fresh.listChampionOptions()
    expect(options).toEqual([])
  })
})
