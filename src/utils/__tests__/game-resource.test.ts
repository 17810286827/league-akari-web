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
    // items.json 真实为数组（记录自带 id/from/priceTotal）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([
        { id: 3089, name: '无尽之刃', description: '', price: 1200, priceTotal: 3400, from: [1038], iconPath: '/lol-game-data/assets/v1/3089.png' },
        { id: 1038, name: '长剑', description: '', price: 350, priceTotal: 350, from: [], iconPath: '/lol-game-data/assets/v1/1038.png' }
      ])
    )
    // perks.json 真实为数组（longDesc 为填充数值后的 HTML 描述）
    vi.mocked(fetch).mockResolvedValueOnce(
      ok([{ id: 8112, name: '电刑', longDesc: '爆发伤害', iconPath: '/lol-game-data/assets/v1/8112.png' }])
    )
    // perkstyles.json 真实结构为 { styles: [...] }，需取 styles 子字段
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ schemaVersion: 2, styles: [{ id: 8100, name: '主宰', tooltip: '', iconPath: '/lol-game-data/assets/v1/8100.png' }] })
    )
    const item = await fresh.itemDisplay(3089)
    expect(item.name).toBe('无尽之刃')
    expect(item.from).toEqual([1038])
    expect(item.priceTotal).toBe(3400)
    const perk = await fresh.perkDisplay(8112)
    expect(perk.name).toBe('电刑')
    expect(perk.descriptionHtml).toBe('爆发伤害')
    const style = await fresh.perkstyleDisplay(8100)
    expect(style.name).toBe('主宰')
    expect(style.iconUrl).toContain('8100.png')
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
