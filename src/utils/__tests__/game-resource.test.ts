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
})
