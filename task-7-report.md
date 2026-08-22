# 任务 7 类型检查与构建报告

`npm run typecheck` 与 `npm run build` 均因范围外现有 TypeScript 错误失败。本次未修改以下范围外文件。

```text
src/components/match-card/widgets/RadarChart.vue(219,21): error TS18048: 'chart.options.plugins' is possibly 'undefined'.
src/components/match-card/widgets/RadarChart.vue(219,43): error TS2339: Property 'radarValueLabels' does not exist on type '_DeepPartialObject<PluginOptionsByType<"radar">>'.
src/components/match-card/widgets/RadarChart.vue(228,32): error TS2339: Property 'xCenter' does not exist on type 'Scale<CoreScaleOptions>'.
src/components/match-card/widgets/RadarChart.vue(228,51): error TS2339: Property 'yCenter' does not exist on type 'Scale<CoreScaleOptions>'.
src/components/match-card/widgets/RadarChart.vue(230,28): error TS2339: Property 'getDistanceFromCenterForValue' does not exist on type 'Scale<CoreScaleOptions>'.
src/components/match-card/widgets/RadarChart.vue(236,26): error TS2339: Property 'getPointPosition' does not exist on type 'Scale<CoreScaleOptions>'.
src/views/game-stats/__tests__/adapter.test.ts(74,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/views/game-stats/__tests__/adapter.test.ts(86,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/views/game-stats/__tests__/adapter.test.ts(110,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/views/game-stats/__tests__/adapter.test.ts(124,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/views/match-detail/adapter/match-card-participants.ts(406,24): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number | null | undefined'.
```

`npm run build` 输出同上，因为构建脚本先执行 `vue-tsc -b`。
