# 对局详情 1:1 还原（Electron match-sync 扩展）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 LeagueAkari（Electron 主项目）的 match-sync shard 中补充对局时间线（frames）同步能力，并补全同步 DTO 的野怪计数与 LCU 顶层统计字段，为 web 端对局详情 1:1 还原提供数据。

**架构：** 复用现有 `pushMatchWithRetry` 的重试模式新增 timeline 推送；frames 转换放在 `convert.ts`（双源：LCU `getTimeline` 的 `data.frames` / SGP `getGameDetailsByGameId` 的 `data.json.frames`，结构一致，原样透传）；timeline 推送与 match 推送绑定在 flow 内，仅在 match 首次推送成功时执行，失败只记日志不阻塞。

**技术栈：** TypeScript + vitest（项目现有测试设施，测试与源码同目录 `*.test.ts`）。

**规格：** `D:/IDE/project/league-akari-web/docs/superpowers/specs/2026-08-15-match-detail-1to1-design.md` 第 5 节

**注意：** 本计划所有 Commit 均在 LeagueAkari 仓库执行（`cd D:/IDE/project/LeagueAkari`）。

---

### 任务 1：同步 DTO 补全（野怪计数 + LCU 顶层字段）

**文件：**
- 修改：`src/main/shards/match-sync/sync-dto.ts`
- 修改：`src/main/shards/match-sync/convert.ts`
- 测试：`src/main/shards/match-sync/convert.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `convert.test.ts` 追加（先读现有 fixture 结构复用其构造方式）：
```ts
describe('sync DTO 补全', () => {
  it('LCU 队伍透传 voidGrubKills/atakhanKills（缺失按 0）', () => {
    // 构造 LCU summary fixture，teams[0] 含 voidGrubKills: 4
    // 断言 toSyncMatchDto 输出 teams[0].voidGrubKills === 4
  })
  it('LCU stats 透传并入顶层 challenges/missions/perks/pings', () => {
    // 构造 LCU participant 顶层含 challenges 对象
    // 断言输出 participants[0].stats.challenges 存在且内容一致
  })
  it('SGP 队伍透传 atakhanKills（objectives.atakhan.kills）', () => {
    // 构造 SGP fixture，teams[0].objectives.atakhan.kills = 1
    // 断言输出 teams[0].atakhanKills === 1
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`yarn vitest run src/main/shards/match-sync/convert.test.ts`
预期：FAIL（编译失败：字段不存在）。

- [ ] **步骤 3：修改 DTO 与转换**

`sync-dto.ts` 的 `SyncTeamDto` 增加：`voidGrubKills: number`、`atakhanKills: number`（注释：虚空巢虫/阿塔坎击杀数；数据源缺失时为 0）。
`convert.ts`：
- `toLcuSyncTeam`：`voidGrubKills: team.voidGrubKills ?? 0`、`atakhanKills: team.atakhanKills ?? 0`（LCU Team 类型当前无此字段，可选链兜底，未来 LCU 新增字段自动透传）。
- `toSgpSyncTeam`：`voidGrubKills: team.objectives.voidGrub?.kills ?? 0`、`atakhanKills: team.objectives.atakhan?.kills ?? 0`（SgpTeam objectives 含 atakhan；voidGrub 缺失时兜底 0）。
- `convertLcu` 的 stats 透传改为精选顶层字段并入（challenges/missions/perks/pings 若存在）：
```ts
stats: {
  ...p.stats,
  // LCU 顶层字段补并：challenges/missions/perks/pings 不在 stats 内，需随快照透传供 web 端统计表使用
  ...(p.challenges ? { challenges: p.challenges } : {}),
  ...(p.missions ? { missions: p.missions } : {}),
  ...(p.perks ? { perks: p.perks } : {}),
  ...(p.allInPings !== undefined ? {
    allInPings: p.allInPings, assistMePings: p.assistMePings, basicPings: p.basicPings,
    commandPings: p.commandPings, dangerPings: p.dangerPings, enemyMissingPings: p.enemyMissingPings,
    enemyVisionPings: p.enemyVisionPings, getBackPings: p.getBackPings, holdPings: p.holdPings,
    needVisionPings: p.needVisionPings, onMyWayPings: p.onMyWayPings, pushPings: p.pushPings,
    retreatPings: p.retreatPings, visionClearedPings: p.visionClearedPings
  } : {})
}
```
（字段名以 `src/shared/types/league-client/match-history.ts` 的 Participant 类型为准，缺失的键省略。）

- [ ] **步骤 4：运行测试验证通过**

运行：`yarn vitest run src/main/shards/match-sync/`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/shards/match-sync/sync-dto.ts src/main/shards/match-sync/convert.ts src/main/shards/match-sync/convert.test.ts
git commit -m "feat(match-sync): 同步 DTO 补全野怪计数与 LCU 顶层统计字段"
```

---

### 任务 2：timeline 转换与推送

**文件：**
- 修改：`src/main/shards/match-sync/sync-dto.ts`（或新建 `timeline-dto.ts`）
- 修改：`src/main/shards/match-sync/convert.ts`
- 修改：`src/main/shards/match-sync/pusher.ts`
- 测试：`src/main/shards/match-sync/convert.test.ts`、`src/main/shards/match-sync/pusher.test.ts`

- [ ] **步骤 1：编写失败的测试**

`convert.test.ts` 追加：
```ts
it('LCU details 转换：frames 原样透传', () => {
  const frames = [{ timestamp: 1000, events: [] }]
  // 构造 LcuGameDetails fixture { source: 'lcu', data: { frames } }
  expect(toSyncTimelineDto(12345, lcuDetails)).toEqual({ gameId: 12345, frames })
})
it('SGP details 转换：frames 取 data.json.frames', () => {
  // 构造 SgpGameDetails fixture { source: 'sgp', data: { json: { frames } } }
  expect(toSyncTimelineDto(12345, sgpDetails)).toEqual({ gameId: 12345, frames })
})
```
`pusher.test.ts` 追加：
```ts
it('pushTimelineWithRetry 成功后返回 ok，URL 带 timeline 路径', async () => {
  const urls: string[] = []
  const http = async (url: string, body: unknown) => { urls.push(url); return { status: 200 } }
  const result = await pushTimelineWithRetry({ gameId: 1, frames: [] }, 'http://localhost:8081', http)
  expect(result.ok).toBe(true)
  expect(urls[0]).toBe('http://localhost:8081/api/matches/1/timeline')
})
it('pushTimelineWithRetry 重试耗尽返回失败', async () => {
  const http = async () => { throw new Error('boom') }
  const result = await pushTimelineWithRetry({ gameId: 1, frames: [] }, 'http://x', http, { retries: 1, delayMs: 1 })
  expect(result.ok).toBe(false)
  expect(result.attempts).toBe(2)
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`yarn vitest run src/main/shards/match-sync/`
预期：FAIL，`toSyncTimelineDto`/`pushTimelineWithRetry` 不存在。

- [ ] **步骤 3：实现转换与推送**

`sync-dto.ts`（或 `timeline-dto.ts`）：
```ts
/** 时间线同步 DTO：frames 全量透传，gameId 幂等键 */
export interface SyncTimelineDto {
  gameId: number
  frames: unknown[]
}
```
`convert.ts`：
```ts
/**
 * 转换对局详情为时间线同步 DTO
 * LCU 取 data.frames，SGP 取 data.json.frames，结构一致原样透传
 */
export function toSyncTimelineDto(gameId: number, details: LcuOrSgpGameDetails): SyncTimelineDto {
  const frames = details.source === 'sgp' ? details.data.json.frames : details.data.frames
  return { gameId, frames }
}
```
`pusher.ts`：把 `pushMatchWithRetry` 的 URL 拼接参数化，新增：
```ts
/**
 * 推送时间线到后端：复用指数退避重试模式；frames 体积大，超时放宽到 30 秒
 */
export async function pushTimelineWithRetry(
  dto: SyncTimelineDto,
  baseUrl: string,
  http: HttpPost = (url, body) => axios.post(url, body, { timeout: 30_000 }),
  options: PushOptions = { retries: 3, delayMs: 1000 }
): Promise<PushResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/matches/${dto.gameId}/timeline`
  // 重试循环与 pushMatchWithRetry 完全一致（可提取公共 helper 复用，保持行为不变）
}
```
若提取公共循环 helper，`pushMatchWithRetry` 行为必须保持兼容（现有测试不破）。

- [ ] **步骤 4：运行测试验证通过**

运行：`yarn vitest run src/main/shards/match-sync/`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/shards/match-sync/
git commit -m "feat(match-sync): 时间线转换与推送（toSyncTimelineDto + pushTimelineWithRetry）"
```

---

### 任务 3：推送链路接入（flow 内联动）

**文件：**
- 修改：`src/main/shards/match-sync/flow.ts`
- 修改：`src/main/shards/match-sync/index.ts`（若 flow 需要注入 details 拉取依赖）
- 测试：`src/main/shards/match-sync/flow.test.ts`

- [ ] **步骤 1：阅读 flow.ts 现有结构**

先读 `flow.ts` 全文（同步编排、gameId 去重、SyncOutcome），确认 match 推送成功分支的注入点，再写测试与实现。

- [ ] **步骤 2：编写失败的测试**

`flow.test.ts` 追加（注入 mock 依赖，参照现有测试模式）：
```ts
it('match 首次推送成功后顺带推送 timeline；timeline 失败不阻塞 outcome', async () => {
  // mock: syncOne 的依赖中 loadDetails 返回假 details，pushTimeline 抛错
  // 断言: 返回 outcome 仍为成功（timeline 失败只记日志）
})
it('去重命中的对局（skipped）不重复拉取 timeline', async () => {
  // mock: flow 内 gameId 已处理
  // 断言: loadDetails 未被调用
})
```

- [ ] **步骤 3：实现 flow 联动**

`flow.ts` 的同步流程中，match 推送成功后（且该次非去重跳过）追加：
```ts
// 时间线联动推送：失败仅记日志，不阻塞对局详情同步结果
try {
  const details = await deps.loadDetails(gameId, apiSource) // 新增依赖：拉取 timeline 详情（LCU getTimeline / SGP getGameDetailsByGameId）
  if (details) {
    await pushTimelineWithRetry(toSyncTimelineDto(gameId, details), baseUrl)
  }
} catch (error) {
  logger.warn(`Timeline sync failed: gameId=${gameId}`, error)
}
```
`index.ts` 注入 `loadDetails` 依赖（复用 `data/match-history.ts` 同款 API 客户端：`leagueClient.api.matchHistory.getTimeline(gameId)` 或 `sgp.api.matchHistoryQuery.getGameDetailsByGameId(gameId, ...)`，以 index.ts 现有可用客户端为准）。

- [ ] **步骤 4：运行测试验证通过**

运行：`yarn vitest run src/main/shards/match-sync/`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/shards/match-sync/
git commit -m "feat(match-sync): 对局推送联动时间线同步（失败不阻塞）"
```

---

### 任务 4：验证

**文件：** 无新增

- [ ] **步骤 1：全量测试**

运行：`yarn vitest run src/main/shards/match-sync/`
预期：全部 PASS。

- [ ] **步骤 2：契约核对**

与 server 计划核对：`POST /api/matches/{gameId}/timeline` body 为 `{ gameId, frames }`（server 端 `TimelineSyncRequest` 字段一致）；与 web 计划核对：`GET /api/matches/{gameId}/timeline` 返回 `{ data: frames }`。

- [ ] **步骤 3：Commit（如有遗留）**

```bash
git add -A
git commit -m "chore: match-sync 时间线同步收尾"
```
