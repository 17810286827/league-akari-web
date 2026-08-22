# 任务 4-6 统一审查修复报告

日期：2026-08-22

## 修复内容

1. **reasoning 折叠状态透传**
   - `GameCardItem` 新增并转发 `update:reasoningCollapsed` 到 `MatchCard` 上层。
   - `MatchCard` 已转发 `MatchCardDetails` 的 reasoning 更新事件。
   - `MatchDetailView` 增加显式 `handleReasoningCollapsed`，列表页增加显式状态处理函数，父层状态作为唯一来源。
   - 增加列表、详情和组件测试，真实断言展开后 reasoning 内容可见或父层状态变为 `false`。

2. **路由切换保留 AI 状态**
   - 路由变化只清理 `detailCache`、展开引用，不再清空 `analysisByKey`。
   - 未调用任何 localStorage 清理逻辑；正在进行的分析实例继续保留。

3. **详情成功前禁止 AI composable 副作用**
   - `GameStatsView` 在摘要列表阶段将 `analysisState` 注入为 `null`。
   - 只有 `getMatchDetail` 成功后，列表渲染才创建/读取分析 composable。
   - 缺失 `puuid` 或非法 `gameId` 继续返回 `null`，无缓存读写和网络调用。
   - 列表测试断言初始摘要渲染不会读取 Storage。

4. **详情失败无 AI 副作用**
   - 详情失败测试增加 `Storage.prototype.getItem` 未调用和 `analyzeMatch` 未调用断言。

5. **HTTP/network reject 回退**
   - 新增 `analyzeMatch.mockRejectedValue` 测试。
   - 验证旧快照继续展示、错误文本可见、localStorage 快照保持不变。

6. **清理无用导入**
   - 删除 `MatchCard.vue` 未使用的 `toRefs`。

7. **统一安全 Map key**
   - `GameStatsView` 使用 `encodeURIComponent(String(gameId))` 与 `encodeURIComponent(puuid)` 组成稳定 key。
   - `useMatchAnalysis` 已使用同样的编码策略，保证不同 gameId/puuid 隔离。

8. **日志安全**
   - 新增实例日志包含 `gameId` 和 `puuid` 标识，不记录分析正文、reasoning 或 chunk 内容。
   - 分析请求日志只记录 gameId、请求状态和截断标记。

## 验证命令和真实输出

### 指定 Vitest 测试

命令：

```text
npx vitest run src/composables/__tests__/useMatchAnalysis.test.ts src/components/match-card/__tests__/MatchCardDetails.test.ts src/views/game-stats/__tests__/GameStatsView.test.ts src/views/match-detail/__tests__/MatchDetailView.test.ts
```

结果：

```text
Test Files  4 passed (4)
Tests       32 passed (32)
Duration    5.67s
```

### TypeScript 类型检查

命令：

```text
npm run typecheck
```

结果：退出码 `1`。本次改动新增的 `GameStatsView.vue` 模板类型错误已消除；仍有以下范围外既有错误：

- `src/components/match-card/widgets/RadarChart.vue` 6 项 Chart.js 类型错误。
- `src/views/game-stats/__tests__/adapter.test.ts` 4 项 `string | null` 类型错误。
- `src/views/match-detail/adapter/match-card-participants.ts` 1 项 `unknown` 类型错误。

最终 typecheck 输出还显示 `GameStatsView.vue` 中 profile 字段的 null 类型问题已通过 `?? undefined` 修正。

## 本轮定向复审补充

1. 列表 reasoning 测试改为从真实 `.ai-analysis-reasoning-toggle` DOM 点击开始，经 `GameCardItem`、`MatchCard`、`MatchCardDetails` 完整事件链路，断言 `.ai-analysis-reasoning` 真实可见。
2. GameStatsView 测试使用 reactive route，在同一实例中覆盖 A 对局分析完成、切换 B、切回 A 后复用结果；未测试组件卸载语义，也未清理 `analysisByKey`。
3. `useMatchAnalysis` 增加特殊字符 puuid 与不同 gameId+puuid 隔离测试，验证编码后的 Map/localStorage key 不碰撞且结果不串。
4. 修正 MatchDetailView 测试中关于“暂未显式更新”的过时注释。
5. `analysisByKey` 注释明确为当前 GameStatsView 实例级 Map，不再声称模块级；路由切换保留该实例级 Map，成功快照仍由 localStorage 持久化。

本轮真实验证：

```text
npx vitest run src/views/game-stats/__tests__/GameStatsView.test.ts
Test Files  1 passed (1)
Tests       10 passed (10)

npx vitest run src/composables/__tests__/useMatchAnalysis.test.ts
Test Files  1 passed (1)
Tests       14 passed (14)
```

提交哈希：`0f05d7c64ec680f5989d8608f2c9f00f92b452c3`

## 仍存在的疑虑

1. `analysisByKey` 是当前 `GameStatsView` 组件实例级 Map；同一实例内路由复用时保留，组件卸载后不保证保留。本任务要求保留跨路由状态，但长期运行时需要后续明确淘汰策略。
2. 当前 typecheck 仍被上述范围外既有错误阻断，未修改这些无关文件。

## 本轮文档措辞修正

- 将 `analysisByKey` 的“页面模块级 Map”及其暗示模块级生命周期的表述，统一修正为：当前 `GameStatsView` 组件实例级 Map；同一实例内路由复用时保留，组件卸载后不保证保留。
- 执行 `git diff --check`，实际输出：无输出（退出码 `0`）。
