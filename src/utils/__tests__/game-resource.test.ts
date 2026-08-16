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
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        data: {
          '3089': { name: '无尽之刃', from: [1038], priceTotal: 3400, price: 1200 }
        }
      })
    )
    const display = await itemDisplay(3089)
    expect(display.from).toEqual([1038])
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
    // items.json 真实为数组（记录自带 id/from/priceTotal/to）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        { id: 3089, name: '无尽之刃', description: '', price: 1200, priceTotal: 3400, from: [1038], to: [1053], iconPath: '/lol-game-data/assets/v1/3089.png' },
        { id: 1038, name: '长剑', description: '', price: 350, priceTotal: 350, from: [], to: [3089], iconPath: '/lol-game-data/assets/v1/1038.png' }
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
    expect(item.from).toEqual([1038])
    expect(item.to).toEqual([1053])
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
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ data: { '3089': { name: '灭世者的死亡之帽', from: [1058, 1058], to: 0, priceTotal: 3600, price: 1200, iconPath: '/x.png' } } })
    )
    const display = await fresh.itemDisplay(3089)
    expect(display.from).toEqual([1058, 1058])
    expect(display.to).toEqual([])
  })
})
