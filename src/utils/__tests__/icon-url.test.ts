/**
 * icon-url 动态版本探测测试：
 * 覆盖 Data Dragon 版本号的动态拉取、缓存、失败回退与重试语义。
 * 背景：写死版本落后时新装备图标 404（如 16.17.1 新增的 ARAM 装备 226668 终极九头蛇），
 * 故版本号须从 versions.json 动态获取，写死值仅作探测失败时的兜底。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ok = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) } as Response)

describe('icon-url Data Dragon 动态版本', () => {
  beforeEach(() => {
    // 每个用例重置模块状态（版本缓存 / 在途 Promise）与 fetch stub，保证用例间隔离
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('未探测时使用写死兜底版本（16.16.1）', async () => {
    const mod = await import('../icon-url')
    // 兜底语义：探测从未发生时，行为与旧实现一致（写死版本）
    expect(mod.itemIconUrl(6653)).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/6653.png'
    )
  })

  it('探测成功后 itemIconUrl / profileIconUrl 均改用最新版本', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(['16.17.1', '16.16.1'])))
    const mod = await import('../icon-url')
    const version = await mod.ensureDdDragonVersion()
    expect(version).toBe('16.17.1')
    // 新装备（终极九头蛇 226668，16.17.1 才有）拼出最新版本 URL
    expect(mod.itemIconUrl(226668)).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/226668.png'
    )
    // 召唤师头像与出装同源，版本跟随动态值
    expect(mod.profileIconUrl(948)).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/profileicon/948.png'
    )
  })

  it('探测结果缓存：重复调用不发起新请求（Promise 去重）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(['16.17.1']))
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('../icon-url')
    await mod.ensureDdDragonVersion()
    await mod.ensureDdDragonVersion()
    await mod.ensureDdDragonVersion()
    // 三个并发语义的调用只产生一次网络请求
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('探测失败回退兜底版本，且后续调用可重试（Promise 缓存被重置）', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('../icon-url')
    // 首次探测失败：错误上抛（由调用方决定是否吞掉），版本保持兜底
    await expect(mod.ensureDdDragonVersion()).rejects.toThrow('network down')
    expect(mod.itemIconUrl(6653)).toContain('/16.16.1/')
    // 恢复网络后再次探测：重新发起请求并成功切换版本（失败不清空可重试性）
    fetchMock.mockResolvedValue(ok(['16.18.1']))
    expect(await mod.ensureDdDragonVersion()).toBe('16.18.1')
    expect(mod.itemIconUrl(6653)).toContain('/16.18.1/')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('versions.json 形状异常（非字符串数组）视为失败，保持兜底版本', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] })))
    const mod = await import('../icon-url')
    await expect(mod.ensureDdDragonVersion()).rejects.toThrow()
    // 形状异常不得污染版本状态
    expect(mod.itemIconUrl(6653)).toContain('/16.16.1/')
  })
})

/**
 * 本地化图标多源构造测试（ADR 0004 图标本地化）：
 * 各构造函数返回「本地 → CDN」降级链数组，本地路径按类型 + ID 命名；
 * CdnImage 以 sources 属性消费（逐级回退），本地缺图（未同步的新英雄）自动落 CDN。
 */
describe('icon-url 本地化多源构造', () => {
  it('championIconSources：本地优先 + CDragon 兜底（英雄头像二级链）', async () => {
    const mod = await import('../icon-url')
    expect(mod.championIconSources(103)).toEqual([
      '/icons/champion/103.png',
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/103.png'
    ])
  })

  it('itemIconSources：本地 + DDragon 动态版本（版本跟随探测结果）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(['16.17.1'])))
    const mod = await import('../icon-url')
    await mod.ensureDdDragonVersion()
    expect(mod.itemIconSources(226668)).toEqual([
      '/icons/item/226668.png',
      'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/226668.png'
    ])
  })

  it('本地化资源各类型的本地路径约定：spell/perk/perkstyle/augment 按 ID 命名', async () => {
    const mod = await import('../icon-url')
    expect(mod.spellIconLocalUrl(4)).toBe('/icons/spell/4.png')
    expect(mod.perkIconLocalUrl(8112)).toBe('/icons/perk/8112.png')
    expect(mod.perkstyleIconLocalUrl(8100)).toBe('/icons/perkstyle/8100.png')
    expect(mod.augmentIconLocalUrl(30)).toBe('/icons/augment/30.png')
  })
})
