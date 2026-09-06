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
