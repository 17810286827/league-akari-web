# 任务 456 最终审查修复报告

## 修复内容

- 新分析请求开始时立即收起 `reasoning`。
- 同一 composable/cache key 只允许一个活动请求，重复调用记录 warning 并返回，原请求继续完成。
- `useMatchAnalysis` 新增可选 `onNetworkError` 回调；网络 reject 调用回调，流内 `onError` 不调用。
- `GameStatsView` 和 `MatchDetailView` 注入 `useMessage().error` 展示网络错误正文。
- 请求开始、首 chunk、失败、成功提交日志包含 `gameId`、`puuid`、`requestId`；正文仅记录长度元数据，不写入日志。
- 缓存成功读取记录正文/思考长度和截断元数据。
- `puuid` 使用 `trim()` 校验，缓存键编码异常安全降级。
- 删除 `MatchCardDetails` 未使用的 `useMatchCard` 调用，保持文件末尾换行。

## 验证结果

- 相关四文件测试：通过，4 个测试文件、38 个测试通过。
- `npm test`：通过，24 个测试文件、139 个测试通过。
- `git diff --check`：通过。
- `npm run typecheck`：失败，仍为范围外既有错误，完整错误见 `task-7-report.md`。
- `npm run build`：失败，因先执行 `vue-tsc -b`，同一组范围外错误阻断构建，完整错误见 `task-7-report.md`。
