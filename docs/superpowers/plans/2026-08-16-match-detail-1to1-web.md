# 对局详情 1:1 还原（Web 端）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 league-akari-web 中 1:1 还原 League Akari 客户端的对局详情（折叠卡 + 6 Tab 展开面板），列表页改造成展开式卡片，时间线数据通过后端 timeline API 接入。

**架构：** 原版组件体系（约 8400 行，位于 `D:/IDE/project/LeagueAkari/src/renderer-shared/components/`）按原目录结构照搬进 `src/components/`，引入 `@vitejs/plugin-vue-jsx` 支持 TSX；新增数据适配层把 web 后端的 `MatchDetail + statsJson` 转换成原版组件消费的参与者模型；图片加载从 `akari://` 协议替换为 CDN `resolveAssetUrl`；i18n 替换为中文常量模块。

**技术栈：** Vue 3.5 + TypeScript + Vite 6 + Naive UI 2.44 + Tailwind 4（与原版一致），新增：@vitejs/plugin-vue-jsx、vitest、jsdom、@vue/test-utils、dayjs、@vueuse/core、@vicons/{fluent,fa,material,ionicons5}、chart.js、vue-chartjs、chartjs-plugin-datalabels。

**规格：** `docs/superpowers/specs/2026-08-15-match-detail-1to1-design.md`（三仓库联合契约）

**原版对照根：** `D:/IDE/project/LeagueAkari/src/renderer-shared/components/`（下文"原版 X"均指该目录下文件）

---

### 任务 1：工程基础设施（vue-jsx + vitest）

**文件：**
- 修改：`package.json`
- 修改：`vite.config.ts`
- 修改：`tsconfig.app.json`
- 创建：`vitest.config.ts`
- 创建：`src/utils/__tests__/smoke.test.ts`

- [ ] **步骤 1：安装依赖**

运行：
```bash
npm i -D @vitejs/plugin-vue-jsx vitest jsdom @vue/test-utils
npm i dayjs @vueuse/core @vicons/fluent @vicons/fa @vicons/material @vicons/ionicons5 chart.js vue-chartjs chartjs-plugin-datalabels
```
预期：安装成功。vue-jsx 插件需选择与 vite 6 兼容的版本（`^1.x`）。

- [ ] **步骤 2：配置 vite 与 vitest**

`vite.config.ts` 修改为：
```ts
import vueJsx from '@vitejs/plugin-vue-jsx'
// plugins 数组改为 [vue(), vueJsx(), tailwindcss()]
```
`vitest.config.ts` 新建（复用 vite 配置的别名与插件，测试环境用 jsdom）：
```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      restoreMocks: true
    }
  })
)
```
`package.json` scripts 增加：`"test": "vitest run"`、`"test:watch": "vitest"`。
`tsconfig.app.json`：确认 `include` 含 `"src/**/*.tsx"`（无则补），`compilerOptions` 增加 `"jsx": "preserve"`（.tsx 由 vite 插件编译，vue-tsc 仅做类型检查）。

- [ ] **步骤 3：编写冒烟测试**

`src/utils/__tests__/smoke.test.ts`：
```ts
import { describe, expect, it } from 'vitest'

describe('测试基础设施', () => {
  it('vitest + jsdom 正常工作', () => {
    const el = document.createElement('div')
    el.textContent = 'ok'
    expect(el.textContent).toBe('ok')
  })
})
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test`
预期：1 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add package.json vite.config.ts vitest.config.ts tsconfig.app.json src/utils/__tests__/smoke.test.ts package-lock.json
git commit -m "build: 引入 vue-jsx 与 vitest 测试基础设施"
```

---

### 任务 2：中文文案模块（match-card-i18n）

原版组件调用 `t('key')`（i18next-vue），web 端不引入 i18next 运行时，改为轻量中文常量模块（key 结构保持原版一致，文案从原版 yaml 提取）。

**文件：**
- 创建：`src/utils/match-card-i18n.ts`
- 测试：`src/utils/__tests__/match-card-i18n.test.ts`

- [ ] **步骤 1：编写失败的测试**

`src/utils/__tests__/match-card-i18n.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { t } from '../match-card-i18n'

describe('match-card-i18n', () => {
  it('已知 key 返回中文文案', () => {
    expect(t('match-card.win')).toBe('胜利')
  })
  it('未知 key 回显 key 本身（不崩溃）', () => {
    expect(t('match-card.not-exist-key')).toBe('match-card.not-exist-key')
  })
  it('支持 {name} 占位符插值', () => {
    expect(t('match-card.hello', { name: 'Akari' })).toBe('你好 Akari')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- src/utils/__tests__/match-card-i18n.test.ts`
预期：FAIL，`match-card-i18n` 模块不存在。

- [ ] **步骤 3：实现中文文案模块**

`src/utils/match-card-i18n.ts`：
```ts
/**
 * match-card 体系的中文文案常量模块
 * key 与 i18next 一致（如 match-card.win），文案取自原版
 * src/shared/i18n/zh-CN/renderer/match-card.yaml 与 main.yaml
 */
const zh: Record<string, string> = {
  'match-card.win': '胜利',
  'match-card.hello': '你好 {name}'
  // 后续任务按组件 t() 调用逐步补充，缺失 key 回显本身
}

/** 按 key 取中文文案；缺失回显 key；支持 {name} 插值 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = zh[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- src/utils/__tests__/match-card-i18n.test.ts`
预期：3 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/utils/match-card-i18n.ts src/utils/__tests__/match-card-i18n.test.ts
git commit -m "feat(utils): 新增 match-card 中文文案模块（i18next 替代）"
```

---

### 任务 3：CDN 图片组件（CdnImage）

原版组件用 `LcuImage`（`akari://league-client/...` 协议），web 端无 LCU，替换为 CDN 图片组件。其余组件照搬时统一把 `LcuImage` 替换为 `CdnImage`。

**文件：**
- 创建：`src/components/widgets/CdnImage.vue`
- 测试：`src/components/widgets/__tests__/CdnImage.test.ts`

- [ ] **步骤 1：编写失败的测试**

`src/components/widgets/__tests__/CdnImage.test.ts`：
```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CdnImage from '../CdnImage.vue'

describe('CdnImage', () => {
  it('把 LCU 资源路径转换为 CDN URL 并渲染 img', () => {
    const wrapper = mount(CdnImage, {
      props: { path: '/lol-game-data/assets/v1/champion-icons/103.png' }
    })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toContain('champion-icons/103.png')
    expect(img.attributes('src')).toMatch(/^https?:/)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- src/components/widgets/__tests__/CdnImage.test.ts`
预期：FAIL，组件不存在。

- [ ] **步骤 3：实现 CdnImage**

`src/components/widgets/CdnImage.vue`：
```vue
<!-- CDN 图片组件：替换原版 LcuImage（akari:// 协议），LCU 资源路径经 resolveAssetUrl 转 CDN URL -->
<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/utils/icon-url'

const props = withDefaults(
  defineProps<{ path: string; class?: string; alt?: string }>(),
  { class: undefined, alt: '' }
)

const src = computed(() => resolveAssetUrl(props.path))
</script>

<template>
  <img :src="src" :class="props.class" :alt="props.alt" loading="lazy" />
</template>
```
（props.class 冲突时使用 `useAttrs()` 或改名为 `imgClass`，以 `vue-tsc` 报错为准修正。）

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- src/components/widgets/__tests__/CdnImage.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/components/widgets/CdnImage.vue src/components/widgets/__tests__/CdnImage.test.ts
git commit -m "feat(widgets): 新增 CdnImage 组件（LcuImage 的 CDN 替代）"
```

---

### 任务 4：game-resource 扩展（augments/perks/items/champions）

在现有 `src/utils/game-resource.ts`（已有 `itemDisplay`/`spellDisplay`，数据源为 CommunityDragon 镜像，zh_cn 优先降级 default）基础上扩展。海克斯中文描述走 gtimg `kiwi_augments.json`（原版同款）。

**文件：**
- 修改：`src/utils/game-resource.ts`
- 测试：`src/utils/__tests__/game-resource.test.ts`（新建，已有测试则扩展）

- [ ] **步骤 1：编写失败的测试**

`src/utils/__tests__/game-resource.test.ts`：
```ts
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- src/utils/__tests__/game-resource.test.ts`
预期：FAIL，`augmentDisplay` 等函数不存在。

- [ ] **步骤 3：实现扩展**

在 `src/utils/game-resource.ts` 追加（沿用现有 `loadJson`/缓存 Promise/请求序号模式，先读该文件了解现有实现再动手）：

```ts
// ---- 海克斯强化（augment）----
export interface AugmentDisplayResource {
  name: string
  iconUrl: string
  rarity?: string // gtimg 稀有度：kBronze/kSilver/kGold/kPrismatic
  descriptionHtml?: string // 中文描述（gtimg）
}

/** CDragon augments.json（图标/名称） + gtimg kiwi_augments.json（中文描述/稀有度）合并 */
export async function augmentDisplay(augmentId: number): Promise<AugmentDisplayResource> { /* 实现 */ }

// ---- 符文（perks）----
export interface PerkDisplayResource { name: string; iconUrl: string; descriptionHtml?: string }
export interface PerkstyleDisplayResource { name: string; iconUrl: string }

export async function perkDisplay(perkId: number): Promise<PerkDisplayResource> { /* 实现 */ }
export async function perkstyleDisplay(styleId: number): Promise<PerkstyleDisplayResource> { /* 实现 */ }
```

`itemDisplay` 返回类型增加 `from?: number[]`（合成组件 ID）与 `price?: number`（合成费），字段缺失可选链兜底（老数据兼容）。
gtimg URL：`https://game.gtimg.cn/images/lol/act/img/js/kiwi/kiwi_augments.json`（CORS 受限时走 vite dev proxy：`vite.config.ts` 加 `server.proxy['/gtimg']` 并把 gtimg 请求改为相对路径）。
数据源 URL 模式：CDragon `.../v1/augments.json`、`.../v1/perks.json`、`.../v1/perkstyles.json`、`.../v1/champions.json`（与现有 `loadItems` 同根）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- src/utils/__tests__/game-resource.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/utils/game-resource.ts src/utils/__tests__/game-resource.test.ts
git commit -m "feat(utils): game-resource 扩展海克斯/符文/装备合成路径（CDragon+gtimg）"
```

---

### 任务 5：参与者适配层（statsJson 双源解析）

核心数据适配：把 `MatchDetail.participants[].statsJson` 解析为原版 `data-adapter/match-history/participants.ts` 输出模型（字段名逐一对应，组件零改动）。先读原版 `src/shared/data-adapter/match-history/participants.ts` 完整字段集（约 80 个字段），web 端输出**同名字段**，值从 statsJson 解析。本任务同时导出 `toBasicInfo`（对局元信息：mode/duration/gameCreation/queueId/mapId 等，供 context 使用）。

**文件：**
- 创建：`src/views/match-detail/adapter/match-card-participants.ts`（导出 `toBasicInfo`、`toParticipants`）
- 创建：`src/views/match-detail/adapter/types.ts`
- 测试：`src/views/match-detail/adapter/__tests__/match-card-participants.test.ts`

- [ ] **步骤 1：阅读原版并定义类型**

读 `D:/IDE/project/LeagueAkari/src/shared/data-adapter/match-history/participants.ts`（重点：函数签名、返回字段全集、`MatchParticipant` 类型），把返回类型定义到 `src/views/match-detail/adapter/types.ts`（字段名与结构保持一致，删除依赖原版 shard 类型的部分，改为纯数据对象）。

- [ ] **步骤 2：编写失败的测试（双源 fixture）**

`src/views/match-detail/adapter/__tests__/match-card-participants.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { toParticipants } from '../match-card-participants'
import { lcuParticipantFixture, sgpParticipantFixture } from './fixtures'

describe('toParticipants', () => {
  it('LCU 平铺 statsJson：解析 KDA/参与率/多杀/强化/符文', () => {
    const result = toParticipants(lcuParticipantFixture)
    const p = result[0]
    expect(p.kda).toBeCloseTo((7 + 12) / 3)
    expect(p.killParticipation).toBeCloseTo((7 + 12) / 25) // 队总击杀 25
    expect(p.augments).toEqual([1, 2, 3, 4, 5, 6])
    expect(p.doubleKills).toBe(2)
    expect(p.tripleKills).toBe(1)
    expect(p.perks).toEqual({ perkIds: [1, 2, 3, 4, 5, 6], perkStyle: 8100, perkSubStyle: 8300 })
    expect(p.items).toHaveLength(7) // item0-6
  })

  it('SGP 嵌套 statsJson（{...p} 透传）：同样正确解析', () => {
    const result = toParticipants(sgpParticipantFixture)
    expect(result[0].kda).toBeCloseTo((7 + 12) / 3)
    expect(result[0].augments).toEqual([1, 2, 3, 4, 5, 6])
    // SGP 顶层字段名一致，读取路径相同
  })

  it('statsJson 缺失字段不阻塞（可选链兜底）', () => {
    const result = toParticipants([{ ...lcuParticipantFixture[0], statsJson: '{}' }])
    expect(result[0].kda).toBe(0)
    expect(result[0].augments).toEqual([null, null, null, null, null, null])
  })
})
```
`fixtures.ts`：构造 LCU 平铺 statsJson（含 `playerAugment1-6`、`perk0-5`、`perkPrimaryStyle`、`perkSubStyle`、`doubleKills`、`tripleKills`、`kills/deaths/assists`、`item0-6` 等）与 SGP 嵌套版本（同一批字段，整体对象）两个 fixture。

- [ ] **步骤 3：运行测试验证失败**

运行：`npm test -- src/views/match-detail/adapter/__tests__/match-card-participants.test.ts`
预期：FAIL，模块不存在。

- [ ] **步骤 4：实现适配函数**

`src/views/match-detail/adapter/match-card-participants.ts`：
```ts
/**
 * 把后端 MatchParticipant（statsJson 全量快照）转换为原版 participants 模型
 * 双源兼容：LCU 平铺字段与 SGP 整体透传字段名一致，统一从 statsJson 取值
 */
export function toParticipants(
  participants: MatchParticipant[]
): MatchCardParticipant[] { /* 实现 */ }

/** 对局元信息：mode/duration/gameCreation/queueId/mapId/winnerTeamId 等（供 context.basicInfo） */
export function toBasicInfo(detail: MatchDetail): MatchCardBasicInfo { /* 实现 */ }
```
实现要点（对照原版 participants.ts 逐字段）：
- `kda = (kills + assists) / noZero(deaths)`（noZero 同原版：0 返回 1）
- `killParticipation = (kills + assists) / noZero(该队总击杀)`；队总击杀先按 `teamId`（CHERRY 按 `playerSubteamId`，`gameMode === 'CHERRY'` 时）累加
- `augments = [playerAugment1..6]`（statsJson 直读，双源字段名一致）
- `perks`：SGP 有嵌套 `perks` 对象则用 `{ perkIds, perkStyle, perkSubStyle }`；否则从 `perk0-5` + `perkPrimaryStyle` + `perkSubStyle` 组装（LCU）
- `items = [item0..item6]`、`spells = [spell1Id, spell2Id]`（`spell1Id` 在 statsJson 内，SGP 顶层同名字段）
- 其余字段（伤害/承伤/治疗/视野/守卫/金币/等级/pings/challenges 等）逐一从 statsJson 取值，缺省为 `null`/`0`，与组件侧 `??` 兜底配合

- [ ] **步骤 5：运行测试验证通过**

运行：`npm test -- src/views/match-detail/adapter/__tests__/match-card-participants.test.ts`
预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/views/match-detail/adapter/
git commit -m "feat(adapter): 参与者适配层（statsJson 双源解析，对齐原版 participants 模型）"
```

---

### 任务 6：队伍与时间线适配层

**文件：**
- 创建：`src/views/match-detail/adapter/match-card-teams.ts`（导出 `toTeams`）
- 创建：`src/views/match-detail/adapter/match-card-timeline.ts`（导出 `toMatchCardFrames`）
- 测试：`src/views/match-detail/adapter/__tests__/match-card-teams.test.ts`、`match-card-timeline.test.ts`

- [ ] **步骤 1：编写失败的测试**

`match-card-teams.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { toTeams } from '../match-card-teams'

describe('toTeams', () => {
  it('teamsJson 解析塔/水晶/龙/男爵/先锋/巢虫/阿塔坎计数', () => {
    const teams = toMatchCardTeams(
      JSON.stringify([
        { teamId: 100, towerKills: 11, inhibitorKills: 2, dragonKills: 3, baronKills: 1, riftHeraldKills: 1, voidGrubKills: 4, atakhanKills: 0, firstBlood: true }
      ])
    )
    expect(teams.teamStatMap['100'].towerKills).toBe(11)
    expect(teams.teamStatMap['100'].voidGrubKills).toBe(4) // 老数据缺失按 0
  })
})
```
`match-card-timeline.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { toMatchCardFrames } from '../match-card-timeline'

describe('toMatchCardFrames', () => {
  it('frames 数组原样透传（LCU 与 SGP 结构一致）', () => {
    const frames = [{ timestamp: 1000, events: [], participantFrames: {} }]
    expect(toMatchCardFrames(frames)).toEqual(frames)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

预期：FAIL，模块不存在。

- [ ] **步骤 3：实现**

- `match-card-teams.ts`：`toTeams(teamsJson: string | null): MatchCardTeams`——解析 LCU Team 结构（先读现有 `src/views/match-detail/adapter.ts` 的 `parseTeamsJson` 复用其解析与容错模式），输出对齐原版 `data-adapter/match-history/teams.ts` 的 `teamStatMap`（key 为字符串 teamId）；`voidGrubKills`/`atakhanKills` 缺失按 0。
- `match-card-timeline.ts`：`toMatchCardFrames(frames: unknown): unknown[]`——透传 frames 数组（对齐原版 `toFrames`：LCU 取 `data.frames`、SGP 取 `data.json.frames`，web 端后端直接返回 frames 数组，透传即可）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- src/views/match-detail/adapter/__tests__/`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/views/match-detail/adapter/match-card-teams.ts src/views/match-detail/adapter/match-card-timeline.ts src/views/match-detail/adapter/__tests__/
git commit -m "feat(adapter): 队伍与时间线适配层"
```

---

### 任务 7：共享 widgets 移植（6 组件 + ItemIcon 薄包装）

原版 `renderer-shared/components/widgets/` 六个组件照搬，替换数据/图片/i18n 三处。先读原版 `providers/game-resource/akari.ts` 中 `items.display`/`augments.display`/`summonerSpells.display` 的返回结构，映射到 web 的 `game-resource.ts`。

**文件（源 → 目标，全部"复制 + 改动"）：**
- `widgets/ItemDisplay.vue` → `src/components/widgets/ItemDisplay.vue`
- `widgets/AugmentDisplay.vue` → `src/components/widgets/AugmentDisplay.vue`
- `widgets/SummonerSpellDisplay.vue` → `src/components/widgets/SummonerSpellDisplay.vue`
- `widgets/PerkDisplay.vue` → `src/components/widgets/PerkDisplay.vue`
- `widgets/PerkstyleDisplay.vue` → `src/components/widgets/PerkstyleDisplay.vue`
- `widgets/ChampionIcon.vue` → `src/components/widgets/ChampionIcon.vue`
- 修改：`src/components/widgets/ItemIcon.vue`（现有简化版 → 内部复用 ItemDisplay 能力的薄包装，props 保持 `{ itemId: number; size?: number }` 兼容 game-stats/player-profile 调用点）

- [ ] **步骤 1：复制原版组件到目标路径**

运行：
```bash
cp "D:/IDE/project/LeagueAkari/src/renderer-shared/components/widgets/ItemDisplay.vue" src/components/widgets/
# 其余 5 个组件同法复制
```

- [ ] **步骤 2：逐组件改动（每个组件 3 处）**

1. 图片：`LcuImage` → `CdnImage`（import 与模板标签替换；`props.path` 语义一致）。
2. i18n：`useTranslation()`/`t(...)` → `import { t } from '@/utils/match-card-i18n'`，组件内 `t('match-card.xxx')` key 不变（文案后续在任务 2 的 zh map 中补齐，缺失回显 key 不影响渲染）。
3. 数据：`game-resource` provider（`@renderer-shared/providers/game-resource`）→ `@/utils/game-resource`，函数名映射（`items.display(id)` → `itemDisplay(id)`，`augments.display(id)` → `augmentDisplay(id)`，`summonerSpells.display(id)` → `spellDisplay(id)`）。
4. 类型：原版 shared 类型导入改为本地定义（`src/views/match-detail/adapter/types.ts` 或组件内联类型）。

逐个组件跑 `npm run typecheck` 确认无类型错误。

- [ ] **步骤 3：验证渲染**

写一个临时挂载页或在任务 9 的折叠卡中目测；此处先用组件测试冒烟：
`src/components/widgets/__tests__/AugmentDisplay.test.ts`——mount 后断言稀有度边框 class（`kGold` → `bg-gradient-to-br from-amber-...` 以原版 class 为准）与名称渲染。

- [ ] **步骤 4：运行测试与类型检查**

运行：`npm test -- src/components/widgets/` 与 `npm run typecheck`
预期：PASS 且无类型错误。

- [ ] **步骤 5：Commit**

```bash
git add src/components/widgets/
git commit -m "feat(widgets): 移植原版共享 widgets（Item/Augment/SummonerSpell/Perk/Champion）"
```

---

### 任务 8：icons + 纯函数 utils 移植

**文件（源 → 目标）：**
- `match-card/icons/{Atakhan,Baron,Dragon,Inhibitor,RiftHerald,Tower,VoidGrub}.vue` → `src/components/match-card/icons/`（纯 SVG 组件，原样复制）
- `match-card/utils/tags.tsx` → `src/components/match-card/utils/tags.tsx`
- `match-card/utils/theme.tsx` → `src/components/match-card/utils/theme.tsx`
- `match-card/utils/game-details.ts` → `src/components/match-card/utils/game-details.ts`
- `match-card/utils/game-map.ts` → `src/components/match-card/utils/game-map.ts`
- `match-card/utils/text.ts` → `src/components/match-card/utils/text.ts`
- `match-card/utils/time.ts` → `src/components/match-card/utils/time.ts`
- 测试：`src/components/match-card/utils/__tests__/tags.test.ts`（新建）

- [ ] **步骤 1：复制文件并修复 import**

运行复制后，逐个文件处理：
- 原版 `@shared/...`/`@renderer-shared/...` import → 本地路径或删除（tags.tsx 若引用原版 i18n/theme 的依赖，替换为 web 对应模块）
- `theme.tsx` 的 naive-ui `useThemeVars` 等保留（naive-ui 已装）

- [ ] **步骤 2：编写多杀去重测试（TDD）**

`src/components/match-card/utils/__tests__/tags.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { computeMultikillTags } from '../tags'

describe('computeMultikillTags（对齐原版去重逻辑）', () => {
  it('五杀优先于四杀：1 五杀 + 1 四杀只显示五杀', () => {
    const tags = computeMultikillTags({ pentaKills: 1, quadraKills: 1, tripleKills: 0, doubleKills: 2 })
    expect(tags.filter((t) => t.type === 'penta')).toHaveLength(1)
    expect(tags.filter((t) => t.type === 'quadra')).toHaveLength(0)
  })
  it('三杀减去四五杀之和', () => {
    const tags = computeMultikillTags({ pentaKills: 1, quadraKills: 1, tripleKills: 2, doubleKills: 0 })
    // 2 三杀 - (1 四杀 + 1 五杀) = 0 三杀
    expect(tags.filter((t) => t.type === 'triple')).toHaveLength(0)
  })
  it('按 priority 排序：penta > quadra > triple > double', () => {
    const tags = computeMultikillTags({ pentaKills: 0, quadraKills: 1, tripleKills: 1, doubleKills: 3 })
    const order = tags.map((t) => t.type)
    expect(order.indexOf('quadra')).toBeLessThan(order.indexOf('triple'))
    expect(order.indexOf('triple')).toBeLessThan(order.indexOf('double'))
  })
})
```

- [ ] **步骤 3：运行测试验证失败 → 实现 → 通过**

运行：`npm test -- src/components/match-card/utils/__tests__/tags.test.ts`
预期：先 FAIL（tags.tsx 中函数签名若与测试不匹配则调整测试对齐原版导出名），实现后 PASS。注意：若原版 `computeMultikillTags` 已有且逻辑不同，以原版实现为准调整测试期望。

- [ ] **步骤 4：迁移原版 game-map 测试**

原版有 `match-card/utils/game-map.test.ts`，复制到 web 对应 `__tests__/` 并修复 import，运行通过。

- [ ] **步骤 5：Commit**

```bash
git add src/components/match-card/
git commit -m "feat(match-card): 移植 icons 与纯函数 utils（tags/theme/game-map 等）"
```

---

### 任务 9：卡片 widgets 移植（TeamTable 等 9 个）

**文件（源 → 目标，复制 + 三处替换：LcuImage→CdnImage、t()、类型）：**
- `match-card/widgets/DamageBar.vue`、`DamageBarWithPopover.vue`、`ManyTags.vue`、`RadarChart.vue`、`StatsBarChart.vue`、`TabSwitch.vue`、`MapPosition.vue`、`VictimDamageDetails.vue`、`TeamTable.vue` → `src/components/match-card/widgets/`
- `match-card/match-card.css` → `src/components/match-card/match-card.css`（组件内 `<style>` 若用 `@import` 引用则改为全局引入：`src/main.ts` 或 `App.vue` import）
- 资源：`D:/IDE/project/LeagueAkari/src/renderer-shared/components/match-card/map-images/{11,12,21}.png` → `public/map-images/`

- [ ] **步骤 1：复制组件与资源**

复制 9 个 vue 文件、match-card.css、map-images 3 张 png 到目标路径。

- [ ] **步骤 2：逐组件三处替换**

1. `LcuImage` → `CdnImage`；2. `t()` → `@/utils/match-card-i18n`；3. 类型导入 → web 本地类型（TeamTable 用 `MatchCardParticipant`，来自任务 5 的 `types.ts`）。ManyTags 的 `useResizeObserver`（@vueuse/core）保留。

- [ ] **步骤 3：组件冒烟测试**

`src/components/match-card/widgets/__tests__/TeamTable.test.ts`：用任务 5 的 fixture 数据 mount TeamTable，断言玩家行渲染数量与 KDA 文本（注意 naive-ui 组件需 `NConfigProvider` 包裹，测试里用 `h(NConfigProvider)` 包裹或挂载时提供）。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/components/match-card/widgets/` 与 `npm run typecheck`
预期：PASS 且无类型错误。

- [ ] **步骤 5：Commit**

```bash
git add src/components/match-card/ public/map-images/
git commit -m "feat(match-card): 移植卡片 widgets（TeamTable/DamageBar/ManyTags 等）"
```

---

### 任务 10：折叠卡（MatchCard + context + Overview）

**文件：**
- 创建：`src/components/match-card/context.ts`（web 简化版：去掉 replayState/canDryRunOngoingGame/loadReplay/watchReplay/dryRunOngoingGame，保留 isExpanded/puuid/details/summary/hidePrivacy/loadingDetails/basicInfo/participants/teams/frames/participant/team/navigateToSummonerByPuuid/loadDetails）
- 创建：`src/components/match-card/MatchCard.vue`
- 创建：`src/components/match-card/MatchCardOverview.vue`
- 测试：`src/components/match-card/__tests__/MatchCardOverview.test.ts`

- [ ] **步骤 1：复制并简化 context.ts**

复制原版 `match-card/context.ts`，删除 replay/dry-run 相关类型与字段（`ReplayDownloadProgress`、`DraftOptions` 等 import 一并删除）；`toBasicInfo/toParticipants/toTeams/toFrames` 的 import 改为 `@/views/match-detail/adapter/` 下对应函数（`toBasicInfo`/`toParticipants` 来自任务 5 的 `match-card-participants.ts`，`toTeams` 来自任务 6 的 `match-card-teams.ts`，frames 用 `toMatchCardFrames`）。如原版函数签名与 web 数据结构不匹配，调整 web 适配函数签名以匹配 context 调用，保持组件零改动。

- [ ] **步骤 2：复制 MatchCard.vue / MatchCardOverview.vue 并替换**

两文件三处替换（LcuImage→CdnImage、t()、类型）。`MatchCardOverview.vue` 的 `useIntervalFn`（@vueuse/core）保留；`dayjs` 保留。回放相关按钮在 Overview 不存在（在 Details 面板，任务 11 处理）。

- [ ] **步骤 3：编写折叠卡冒烟测试**

`MatchCardOverview.test.ts`：在测试内直接构造最小 `MatchCardSummary`（basicInfo/participants/teams 三组，复用任务 5/6 的 fixture 构造器），mount `MatchCard`（`isExpanded=false`），断言：英雄名/KDA 文本/装备图标数/海克斯数/玩家列表数渲染。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/components/match-card/` 与 `npm run typecheck`
预期：PASS 且无类型错误。

- [ ] **步骤 5：Commit**

```bash
git add src/components/match-card/context.ts src/components/match-card/MatchCard.vue src/components/match-card/MatchCardOverview.vue
git commit -m "feat(match-card): 折叠卡（MatchCard + context + Overview）"
```

---

### 任务 11：详情面板 + Summary/Details Tab

**文件：**
- 创建：`src/components/match-card/MatchCardDetails.vue`（去掉回放下载/观看按钮区，保留 TabSwitch 六个 Tab 骨架；`@vicons/fluent` 的 Replay 图标 import 删除）
- 创建：`src/components/match-card/tabs/MatchCardSummaryTab.vue`
- 创建：`src/components/match-card/tabs/MatchCardDetailsTab.vue`
- 创建：`src/components/match-card/utils/details-table/{groups.ts, raw-details.ts, renderers.tsx, types.ts, index.ts}`
- 测试：`src/components/match-card/tabs/__tests__/MatchCardDetailsTab.test.ts`

- [ ] **步骤 1：details-table 体系移植（raw-details 改写点）**

复制原版 `match-card/utils/details-table/` 全部文件。**raw-details.ts 是本任务的改写核心**：原版从 LCU participant 对象（含嵌套 stats/challenges/missions/perks）平铺字段；web 端输入改为 `statsJson: Record<string, unknown>`（LCU stats 平铺、SGP 整体透传），字段读取 `statsJson[key]`，嵌套对象（challenges/missions/pings）从 `statsJson.challenges` 等键取，缺失跳过该行。renderers.tsx 的 akari-score 渲染器若无对应数据保留但恒不触发。

- [ ] **步骤 2：MatchCardDetails.vue 复制与简化**

复制原版，删除回放区（replayState/loadReplay/watchReplay 相关 props 与 UI），保留六个 Tab 的 `TabSwitch` 配置与 `KeepAlive`。`MatchCardDetailsTab.vue` 的 `refDebounced`（@vueuse/core）保留。

- [ ] **步骤 3：编写 DetailsTab 测试**

构造 10 名参与者 statsJson fixture，mount `MatchCardDetailsTab`，断言：表头玩家数、行数、过滤输入后行数变化、排序切换。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/components/match-card/` 与 `npm run typecheck`
预期：PASS 且无类型错误。

- [ ] **步骤 5：Commit**

```bash
git add src/components/match-card/MatchCardDetails.vue src/components/match-card/tabs/ src/components/match-card/utils/details-table/
git commit -m "feat(match-card): 展开面板与 Summary/Details Tab（含 18 组统计表）"
```

---

### 任务 12：Runes Tab

**文件：**
- 创建：`src/components/match-card/tabs/MatchCardRunesTab.vue`
- 测试：`src/components/match-card/tabs/__tests__/MatchCardRunesTab.test.ts`

- [ ] **步骤 1：复制 MatchCardRunesTab.vue 并替换**

三处替换（LcuImage→CdnImage、t()、类型）。符文数据来自任务 5 适配层的 `participant.perks`（LCU 平铺组装 / SGP 嵌套透传两种路径），`perkDisplay`/`perkstyleDisplay`（任务 4）提供图标与描述；原版用 `@eogvar` 占位符替换逻辑保留。

- [ ] **步骤 2：编写冒烟测试**

构造含 perks 的 participants fixture，mount 后断言每人天赋树块数量与主系名称渲染。

- [ ] **步骤 3：运行测试与 typecheck**

运行：`npm test -- src/components/match-card/` 与 `npm run typecheck`
预期：PASS。

- [ ] **步骤 4：Commit**

```bash
git add src/components/match-card/tabs/MatchCardRunesTab.vue
git commit -m "feat(match-card): Runes Tab（天赋树 + 选手导航器）"
```

---

### 任务 13：详情页组装（替换三段式）

**文件：**
- 修改：`src/api/matches.ts`（新增 `getMatchTimeline`）
- 修改：`src/api/types.ts`（新增 timeline 返回类型）
- 重写：`src/views/match-detail/MatchDetailView.vue`
- 删除：`src/views/match-detail/MatchSummaryHeader.vue`、`TeamStatsTable.vue`、`ResourceStatsBanner.vue`、`adapter.ts`
- 测试：`src/views/match-detail/__tests__/MatchDetailView.test.ts`

- [ ] **步骤 1：新增 timeline API**

`src/api/matches.ts` 追加：
```ts
/** 查询对局时间线（404 时抛出，由调用方处理） */
export async function getMatchTimeline(gameId: number): Promise<unknown[]> {
  const { data } = await http.get<{ data: unknown[] }>(`/api/matches/${gameId}/timeline`)
  return data.data
}
```

- [ ] **步骤 2：重写 MatchDetailView**

加载流程：`getMatchDetail(gameId)` → `toMatchCardSummary(detail)`（任务 5/6 组合出 `basicInfo/participants/teams`）→ 渲染 `MatchCard`（`isExpanded=true`）；`getMatchTimeline(gameId)` 成功则把 frames 传给 context 的 `details`（失败仅 warn 日志，不阻塞折叠卡展示，时间线 Tab 显示空态）。
删除旧三段式组件与旧 adapter（git 历史可追溯）。

- [ ] **步骤 3：编写测试**

mount `MatchDetailView`（mock `src/api/matches.ts` 的 `getMatchDetail`/`getMatchTimeline`），断言加载成功渲染 MatchCard、接口失败显示错误态。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/views/match-detail/`、`npm run typecheck`、`npm run build`
预期：PASS、无类型错误、构建成功。

- [ ] **步骤 5：Commit**

```bash
git add src/api/matches.ts src/api/types.ts src/views/match-detail/
git commit -m "feat(match-detail): 详情页组装 MatchCard 展开态（替换三段式布局）"
```

---

### 任务 14：列表页改造（game-stats 展开式卡片）

前置：server 计划的任务 3（列表 DTO 轻量扩展）完成，`MatchSummary` 类型含 `participants: MatchParticipantLight[]`。

**文件：**
- 修改：`src/api/types.ts`（`MatchSummary` 增 `participants` 字段，类型 `MatchParticipantLight`）
- 修改：`src/views/game-stats/GameStatsView.vue`、`GameCardItem.vue`、`adapter.ts`、`types.ts`
- 测试：`src/views/game-stats/__tests__/GameStatsView.test.ts`

- [ ] **步骤 1：类型与 API 对齐**

`MatchParticipantLight` 定义（`puuid/summonerName/championId/teamId/position/win/kills/deaths/assists/items/summonerSpells/augments/perks`）；`MatchSummary.participants` 声明（后端未升级时可能为 undefined，代码中 `?? []` 兜底）。

- [ ] **步骤 2：列表项替换为折叠卡**

`GameCardItem.vue` 改为渲染 `MatchCardOverview`（数据：`summary.participants` 经任务 5 的 `toParticipants` 转换——轻量 DTO 缺 statsJson 时传 `{}`，组件侧字段兜底）；点击卡片调用 `onExpand(gameId)`：展开态拉 `getMatchDetail` + `getMatchTimeline`，渲染 `MatchCard`（`isExpanded=true`）。侧栏统计与筛选保持现状。

- [ ] **步骤 3：编写测试**

mock `listMatches` 返回含 participants 的摘要，断言折叠卡渲染与点击展开后详情加载被调用。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/views/game-stats/`、`npm run typecheck`、`npm run build`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/api/types.ts src/views/game-stats/
git commit -m "feat(game-stats): 列表项改为原版折叠卡（点击展开详情）"
```

---

### 任务 15：时间线三 Tab（Events/Builds/Timeline）

前置：server 计划完成（timeline API 可用）；本任务数据为真实 frames。

**文件：**
- 创建：`src/components/match-card/tabs/MatchCardEventsTab.vue`
- 创建：`src/components/match-card/tabs/MatchCardBuildsTab.vue`
- 创建：`src/components/match-card/tabs/timeline/{MatchCardTimelineTab.vue, MatchCardDiffLineChart.vue, MatchCardStatsLine.vue}`
- 测试：`src/components/match-card/tabs/__tests__/MatchCardEventsTab.test.ts`

- [ ] **步骤 1：复制三个 Tab 并替换**

三处替换（LcuImage→CdnImage、t()、类型）。`MatchCardEventsTab` 的 `NTimeline`（naive-ui）保留；`MatchCardDiffLineChart`/`MatchCardStatsLine` 的 vue-chartjs `Line` 组件与 chartjs-plugin-datalabels 注册逻辑保留（依赖已安装）。

- [ ] **步骤 2：适配层补充 frames 数据转换**

`match-card-timeline.ts` 增加 `toMatchCardEvents(frames)`（击杀/一血/多杀/推塔/野怪事件抽取，对齐原版 EventsTab 消费的事件字段）与 `toMatchCardBuilds(frames)`（技能加点序列 + 购买事件）——先读原版两个 Tab 的数据消费结构再定函数签名，字段缺失事件跳过。

- [ ] **步骤 3：编写测试**

构造最小 frames fixture（含 `CHAMPION_KILL`、`ITEM_PURCHASED`、`SKILL_LEVEL_UP` 事件与 `participantFrames` 经济字段），断言 Events 列表渲染、Builds 加点序列渲染、Timeline 图表数据 prop 传入。

- [ ] **步骤 4：运行测试与 typecheck**

运行：`npm test -- src/components/match-card/`、`npm run typecheck`、`npm run build`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/components/match-card/tabs/MatchCardEventsTab.vue src/components/match-card/tabs/MatchCardBuildsTab.vue src/components/match-card/tabs/timeline/
git commit -m "feat(match-card): 时间线三 Tab（Events/Builds/Timeline）接入真实数据"
```

---

### 任务 16：收尾验证

**文件：** 无新增

- [ ] **步骤 1：全量测试**

运行：`npm test`
预期：全部 PASS。

- [ ] **步骤 2：类型检查与构建**

运行：`npm run typecheck` 与 `npm run build`
预期：无错误，dist 产出。

- [ ] **步骤 3：规格对照核对**

对照规格 `docs/superpowers/specs/2026-08-15-match-detail-1to1-design.md` 第 8/9/10 节逐项核对：
- 折叠卡：英雄/技能/符文/海克斯/KDA/伤害%/补刀/装备/标签/5v5 列表 ✅
- 6 Tab：Summary/Details/Runes/Events/Builds/Timeline 全部渲染 ✅
- 海克斯稀有度着色 + 中文描述 ✅；装备合成路径 ✅；多杀去重标签 ✅
- 列表页折叠卡 + 展开懒加载 ✅；`/matches/:gameId` 深链 ✅

- [ ] **步骤 4：最终 Commit（如有遗留）**

```bash
git add -A
git commit -m "chore: 对局详情 1:1 还原收尾"
```
