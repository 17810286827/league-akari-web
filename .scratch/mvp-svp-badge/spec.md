# MVP/SVP 徽章前端适配规格

> Status: ready-for-agent
> ADR: docs/adr/0001-mvp-svp-badge-display.md（展示决策与否决选项）

## Problem Statement

后端已完成 MVP/SVP 评选并在对局详情接口（`GET /api/matches/{gameId}`）返回 `mvp`/`svp` 字段（称号持有者的 participantId/puuid/summonerName/championId/score，未评选的老对局为 null），但前端没有任何展示——用户展开一局对战详情后，无法知道这局谁是 MVP、谁是 SVP，评选结果对用户不可见。

## Solution

在展开卡的队伍表格（TeamTable，10 人全景表）中，为获得称号的玩家挂上文字徽章：`MVP`（金色，胜方最佳）与 `SVP`（银灰白，负方最佳），显示在对应玩家名字旁。纯展示、无交互、不带评分数字；未评选的老对局不渲染任何徽章。后端零改动。

## User Stories

1. 作为战绩查询用户，我想在展开的对局详情表格里看到 MVP 徽章，以便一眼知道这局胜方谁表现最佳
2. 作为战绩查询用户，我想在展开的对局详情表格里看到 SVP 徽章，以便知道负方虽败犹荣的最佳选手
3. 作为战绩查询用户，我想让徽章直接挂在对应玩家的名字旁（而不是表格顶部孤立展示），以便自然地对应到具体英雄和玩家
4. 作为战绩查询用户，我想让 MVP 用金色、SVP 用银色区分，以便凭借熟悉的配色约定（OP.GG/WeGame 同款认知）无需思考就能分辨
5. 作为战绩查询用户，我想在查看未评选的老对局时看不到任何徽章（而不是看到空占位或报错），以便界面保持干净
6. 作为战绩查询用户，我想让 MVP/SVP 徽章出现在胜负两队的表格中（MVP 挂胜方行、SVP 挂负方行），以便在各自队伍语境下理解称号
7. 作为战绩查询用户，我想让徽章不遮挡玩家行内其他信息（头像/等级/召唤师技能/符文/KDA/伤害/补刀/金币/出装），以便表格信息密度不受影响
8. 作为开发者，我希望 mvp/svp 的类型是可选字段（`?: ... | null`），以便与后端未升级/老数据的兼容惯例一致
9. 作为开发者，我希望徽章匹配用 puuid（前端玩家主键），以便不依赖适配层才有的 participantId
10. 作为开发者，我希望徽章文案走 match-card i18n 字典，以便与卡片体系文案管理方式一致
11. 作为开发者，我希望 TeamTable 组件测试覆盖有数据/null/跨队三种场景，以便回归时锁住渲染契约

## Implementation Decisions

- **类型层**：`MatchDetail` 新增可选字段 `mvp?: MvpAward | null`、`svp?: MvpAward | null`；`MvpAward` 结构与后端响应一致（participantId/puuid/summonerName/championId/score），score 本期不展示但类型保留。老数据兼容惯例参照 `MatchParticipantLight` 的 `?: ... | null` 写法
- **展示组件**：TeamTable 玩家行的名字区域挂徽章；通过 match-card 上下文（`useMatchCard().summary`）读取 `mvp/svp`，以 `puuid` 与行玩家匹配（一行至多一个徽章）
- **视觉**：小型圆角文字徽章（与现有标签体系观感一致）；MVP 使用全局金色变量（`--gold-accent`，opgg.css 注释明确"等级/徽章"用途），SVP 使用银灰白系；徽章不参与任何点击交互
- **数据流零改造**：详情页与列表页展开卡均已将 MatchDetail 传入卡片（detailCache），徽章数据自动可用；折叠卡不展示（列表接口无 mvp/svp，见 ADR 否决记录）
- **文案**：`match-card-i18n.ts` 补充 `matchCard.tags.mvp.label` / `matchCard.tags.svp.label`（如" MVP"/" SVP"或"MVP"/"SVP"，实现时定）
- **约束**：后端不改、列表接口不加字段、不做全员评分列、不做悬浮分数（用户明确"先不展示分数"）、徽章无跳转

## Testing Decisions

- 唯一测试接缝：**TeamTable 组件测试**（扩展现有 `widgets/__tests__/TeamTable.test.ts`），不新建接缝
- 好测试标准：只断言外部可见行为（徽章是否渲染、挂在哪个玩家行、颜色类名），不断言内部实现
- 用例覆盖：
  1. summary 携带 mvp/svp → 徽章渲染在对应 puuid 的玩家行名字旁，MVP/SVP 颜色类区分
  2. mvp/svp 为 null → 无徽章渲染
  3. MVP/SVP 分属两队 → 各自挂载正确
- Prior art：现有 TeamTable.test.ts 的挂载模式（`mount` + `NConfigProvider` 包裹 naive-ui、`provideMatchCard()` 注入 summary、`vi.mock('@/utils/game-resource')` 避免网络、`lcuParticipantFixture` 构造参与者）

## Out of Scope

- 全员 10 人评分展示（后端 match_mvp 只落库 MVP/SVP 两条，需后端实时重算或扩表，暂缓）
- MVP/SVP 评分数字展示（悬浮或内联，均搁置）
- 折叠卡（MatchCardOverview）徽章展示（列表接口无该数据）
- 徽章点击跳转该玩家战绩
- 后端任何改动（含列表接口补字段）
- MVP/SVP 评选算法调整

## Further Notes

- 匹配键说明：`MatchParticipant`（详情接口实体）没有 participantId 字段，前端以 puuid 为玩家主键；适配层 `MatchCardParticipant` 的 participantId（1-10）是本地序号，不能用于与后端 mvp.participantId 匹配
- 大乱斗（CHERRY）的 subteamPlacement 皇冠是独立特性，与 MVP/SVP 徽章并存不冲突
- 若后端未来在列表接口补 mvp/svp，折叠卡展示可参照本 spec 的视觉与匹配方案（见 ADR Consequences）