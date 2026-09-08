/**
 * 图标同步「清单 → 下载计划」纯函数测试（ADR 0004 图标本地化）：
 * 验证各资源清单 JSON（CDragon / gtimg 原始形状）转换为下载计划
 * （远程 URL → 本地路径映射）的转换规则；网络与文件 IO 不在此接缝（留在脚本主体边缘）。
 */
import { describe, expect, it } from 'vitest'

import {
  buildAugmentEntries,
  buildChampionEntries,
  buildItemEntries,
  buildPerkEntries,
  buildPerkstyleEntries,
  buildSpellEntries
} from './plan'

describe('champion 清单 → 下载计划', () => {
  it('正 id 全量镜像为 /icons/champion/{id}.png（CDragon champion-icons URL）', () => {
    // 数组形状（CDragon 真实格式）；-1 等非英雄记录排除
    const entries = buildChampionEntries([
      { id: 103, name: '九尾妖狐', description: '阿狸' },
      { id: -1, name: '无', description: '' }
    ])
    expect(entries).toEqual([
      {
        localPath: '/icons/champion/103.png',
        remoteUrl:
          'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/103.png'
      }
    ])
  })
})

describe('item 清单 → 下载计划', () => {
  it('按 ddragon 版本镜像为 /icons/item/{id}.png（DDragon CDN URL，id 升序）', () => {
    // 键值对象形状（{ data: { '30': {...} } } 外壳兼容）；数值键 Map 按升序产出
    const entries = buildItemEntries(
      { data: { '226668': { name: '终极九头蛇' }, '1001': { name: '鞋子' } } },
      '16.17.1'
    )
    expect(entries).toEqual([
      {
        localPath: '/icons/item/1001.png',
        remoteUrl: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/1001.png'
      },
      {
        localPath: '/icons/item/226668.png',
        remoteUrl: 'https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/226668.png'
      }
    ])
  })
})

describe('spell / perk / perkstyle 清单 → 下载计划', () => {
  it('spell：iconPath 经 resolveAssetUrl 转 CDragon URL，本地按 spell/{id}', () => {
    const entries = buildSpellEntries({
      data: {
        '4': {
          id: 4,
          name: '闪现',
          iconPath: '/lol-game-data/assets/ASSETS/Spell/Icons/SummonerFlash.png'
        }
      }
    })
    expect(entries).toEqual([
      {
        localPath: '/icons/spell/4.png',
        remoteUrl:
          'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/spell/icons/summonerflash.png'
      }
    ])
  })

  it('perk：本地按 perk/{id}；perkstyle 取 styles 子字段，本地按 perkstyle/{id}', () => {
    const perks = buildPerkEntries([
      { id: 8112, name: '电刑', iconPath: '/lol-game-data/assets/ASSETS/Perks/Styles/Domination/Electrocute/Electrocute.png' }
    ])
    expect(perks[0]).toEqual({
      localPath: '/icons/perk/8112.png',
      remoteUrl:
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/perks/styles/domination/electrocute/electrocute.png'
    })

    const styles = buildPerkstyleEntries({
      styles: [{ id: 8100, name: '电刑', iconPath: '/lol-game-data/assets/ASSETS/Perks/Styles/7200_Domination.png' }]
    })
    expect(styles[0]).toEqual({
      localPath: '/icons/perkstyle/8100.png',
      remoteUrl:
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/perks/styles/7200_domination.png'
    })
  })
})

describe('augment 清单 → 下载计划（CDragon 优先 + gtimg 补漏）', () => {
  it('CDragon 小图标路径优先镜像；gtimg 仅补 CDragon 缺失的 id', () => {
    const cdragon = {
      data: {
        '30': { name: '全凭身手', augmentSmallIconPath: '/lol-game-data/assets/v1/augments/30.png' }
      }
    }
    // gtimg 有 30（重复，应被忽略）与 31（CDragon 缺失，应补漏）
    const gtimg = { data: [{ augmentID: 30, name_cn: '全凭身手' }, { augmentID: 31, name_cn: '风暴聚集' }] }
    const entries = buildAugmentEntries(cdragon, gtimg)
    expect(entries).toEqual([
      {
        localPath: '/icons/augment/30.png',
        remoteUrl:
          'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/augments/30.png'
      }
      // 31 无 gtimg 图标直链（large_Icon 缺失）：不产出条目（运行时由 CdnImage 链兜底）
    ])
  })

  it('gtimg 图标直链补漏：协议相对地址（//开头）规范化为 https', () => {
    const entries = buildAugmentEntries(
      { data: {} },
      { data: [{ augmentID: 31, name_cn: '风暴聚集', large_Icon: '//game.gtimg.cn/aug/31.png' }] }
    )
    expect(entries).toEqual([
      { localPath: '/icons/augment/31.png', remoteUrl: 'https://game.gtimg.cn/aug/31.png' }
    ])
  })
})
