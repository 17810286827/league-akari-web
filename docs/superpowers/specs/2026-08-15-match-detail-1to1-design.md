# 对局详情 1:1 还原 League Akari 客户端 — 设计规格

> 日期：2026-08-15
> 状态：已批准设计，待实现
> 范围：league-akari-web（主体）、league-akari-server（时间线接口与列表 DTO）、LeagueAkari（match-sync frames 同步）

## 1. 背景与目标

league-akari-web 当前对局详情页为三段式布局（摘要头 + 双队表格 + 资源横幅），仅覆盖装备、KDA、
简化参与率等少量信息；缺少海克斯强化、召唤师技能渲染、多杀统计、符文、时间线等能力。

本设计目标：**完全 1:1 还原 League Akari（Electron 客户端）对局详情的布局与功能，一点都不能少**。
原版详情为"列表内展开卡片"形态：`MatchCardOverview` 折叠卡 + `MatchCardDetails` 展开面板
（Summary / Details / Runes / Events / Builds / Timeline 六个 Tab），组件体系约 8400 行。

### 明确纳入范围

- 折叠卡完整还原（英雄/技能/符文/海克斯/KDA/伤害/补刀/装备/标签/5v5 玩家列表）
- 展开面板 6 个 Tab 全部实现并接真实数据
- 列表页（game-stats）改造成原版展开式卡片交互
- 三仓库联调：Electron 同步 frames、后端提供 timeline API
- 海克斯强化：CDragon 图标 + gtimg 中文描述（原版同款组合）
- 多杀展示：行内彩色标签（原版 ManyTags，含去重逻辑）
- 装备详情：补合成路径（from/to）与合成价/总价区分

### 明确不做

- 登录鉴权、多用户、云部署（延续一期决策）
- 回放下载/观看按钮（web 无本地客户端文件，按钮降级隐藏）
- 原版 Details Tab 之外的统计扩展（18 组约 200 项已覆盖，不做增删）

## 2. 已确认决策

| 决策点       | 结论                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 布局         | 完全 1:1 还原客户端布局与功能                                                         |
| 海克斯数据源 | CDragon augments.json（图标/名称）+ 腾讯 gtimg kiwi_augments.json（中文描述/稀有度）  |
| 多杀展示     | 行内彩色标签（ManyTags 移植），复用原版去重逻辑                                      |
| 装备详情     | 补合成路径与售价（ItemDisplay 级）                                                    |
| 时间线数据   | 三仓库联调一次到位：Electron 同步 frames → server timeline API → web 真实数据        |
| 技术路线     | 引入 @vitejs/plugin-vue-jsx，文件级照搬原版组件结构，仅替换数据源与图片加载          |
| 入口形式     | 列表页（game-stats）改展开式卡片；/matches/:gameId 保留为深链（展开态）               |

## 3. 架构总览

```
┌─────────────────┐  对局结束+定时  ┌────────────────────┐   POST    ┌──────────────────┐
│ LeagueAkari     │ ─────────────► │ league-akari-server │ ────────► │ MySQL            │
│ (Electron)      │ frames 同步     │ (Spring Boot)       │           │ match            │
│ match-sync 扩展 │                 │ timeline 接口新增   │           │ participant      │
└─────────────────┘                 │ 列表 DTO 轻量扩展   │           │ match_timeline   │
                                    └─────────┬──────────┘           └──────────────────┘
                                              │ GET /api/matches*
                                              ▼
                                    ┌──────────────────────┐
                                    │ league-akari-web     │  ← 本任务主体
                                    │ match-card 全量移植   │
                                    └──────────────────────┘
```

数据流（单次对局）：

1. match-sync 对局结束钩子（复用现有 `_watchEndOfGameSave` 旁路）触发详情推送（已有）。
2. **新增**：同一流程内拉取该局 timeline（frames，LCU/SGP 双源），`POST /api/matches/{gameId}/timeline`。
3. 定时补同步（每 2 分钟最近 20 场）时，对"详情已同步但 timeline 未同步"的对局补拉 frames。
4. web 列表页用 `GET /api/matches`（轻量 participants 扩展）渲染折叠卡；
   展开时 `GET /api/matches/{gameId}`（详情）+ `GET /api/matches/{gameId}/timeline`（懒加载）。

## 4. league-akari-server 扩展

### 4.1 新增 match_timeline 表

| 字段        | 类型            | 约束                          | 说明                                   |
| ----------- | --------------- | ----------------------------- | -------------------------------------- |
| id          | BIGINT UNSIGNED | PK, AUTO_INCREMENT            | 主键                                   |
| game_id     | BIGINT UNSIGNED | UNIQUE, NOT NULL              | 对局 ID，幂等键                       |
| frames_json | JSON            | NOT NULL                      | 时间线 frames 全量（原样存储）        |
| created_at  | DATETIME        | NOT NULL                      | 落库时间                               |

索引：`game_id` 唯一索引承担幂等兜底（与 match 表策略一致）。

### 4.2 新增 API

- `POST /api/matches/{gameId}/timeline`：body 为 frames 原始对象；200 幂等（已存在不报错）、400 参数错误。
- `GET /api/matches/{gameId}/timeline`：返回 `{ data: frames }`；404 当不存在。

分层遵循项目规范：controller 只做参数校验与返回处理，业务下沉 service（幂等 upsert），统一异常处理。

### 4.3 列表 DTO 轻量扩展（折叠卡数据支撑）

折叠卡需要：self 的海克斯（3 枚）/符文（2 枚）/装备/技能/多杀/标签数据 + 双方 10 人基本档案。
当前 `MatchSummary`（self/teamTotals/teammates）缺这些。变更：

- `MatchSelf` 增加：`items`、`summonerSpells`、`augments`（1-6）、`perks`（主/副系 + 碎片）、
  `doubleKills / tripleKills / quadraKills / pentaKills`。
- 新增 `MatchParticipantLight`：`puuid / summonerName / championId / teamId / position / win /
  kills / deaths / assists / items / summonerSpells / augments / perks`（**不含 statsJson**，
  控制分页体积）；`MatchSummary.participants: MatchParticipantLight[]`（10 人，含 self 冗余）。
- 后端从 stats_json 提取上述字段（LCU/SGP 双源，提取逻辑与详情页适配层共享口径）。

## 5. LeagueAkari（Electron）match-sync 扩展

- **对局结束推送**：详情推送成功后拉取 timeline（frames）并推送（失败仅记日志，不阻塞详情推送）。
- **定时补同步**：每 2 分钟任务对已同步对局检查 timeline 缺失并补拉（复用现有幂等集合逻辑）。
- **转换**：`convert.ts` 新增 `toSyncTimelineDto`，LCU/SGP 双源 frames 原样透传（不做字段挑选）。
- **重试**：沿用指数退避重试 3 次（1s/2s/4s），最终失败 Winston error 日志。
- **字段补充**：LCU 队伍数据补 `voidGrubKills`、`atakhanKills` 透传（当前 SyncTeamDto 只有 5 种
  野怪计数，web 端 TeamTable 表头 7 种图标需要）；SGP 侧对应字段同步检查。

## 6. web 端技术路线

引入 `@vitejs/plugin-vue-jsx`（Vue 官方插件，与现有 vite + naive-ui 栈兼容），
原版 TSX 组件（`utils/tags.tsx`、`utils/details-table/renderers.tsx`、`utils/theme.tsx` 等）与
`.vue` 文件按原目录结构照搬，改动收敛到 4 个面：

1. **图片加载**：`akari://league-client/...` 协议 → 现有 `resolveAssetUrl`（CDN CommunityDragon 镜像）。
2. **i18n**：原版 `t('...')` → web 中文常量模块（`src/utils/match-card-i18n.ts`，键名保持原版 key，
   值为中文文案；后续如需多语言可平滑替换为正式 i18n）。
3. **数据适配层**：原版 LCU/SGP 数据模型 → web 的 `MatchDetail + statsJson` 模型（见第 7 节）。
4. **目录组织**：`src/components/match-card/`（照搬原版 `renderer-shared/components/match-card/` 结构），
   共享 widgets 进 `src/components/widgets/`；新增原版完整版 `ItemDisplay.vue`（含合成路径），
   现有简化版 `ItemIcon.vue` / `SummonerSpellDisplay.vue` 升级为完整实现的薄包装
   （props 与现有调用点保持兼容，game-stats / player-profile 页面无需改动）。

## 7. 数据适配层设计（web 特有，核心新增）

新建 `src/views/match-detail/adapter/` 下的 `match-card.ts`（或独立 `src/utils/match-card-data.ts`），
将 `MatchDetail`（participants + statsJson + teamsJson）解析为原版组件所需的统一参与者模型。
组件不感知数据源，仅消费适配层输出。

### 7.1 statsJson 双源兼容

- **LCU**：平铺字段——`playerAugment1-6`、`perk0-4`、`perkPrimaryStyle`、`perkSubStyle`、
  `statPerks*` 均在 stats 对象内。
- **SGP**：整体透传 `{...p}`——顶层同名字段，且含嵌套 `perks` 对象。
- 适配层采用"双路径探测 + 可选链"：先查嵌套 `perks`，缺失回退平铺 `perk0-4`；强化统一取
  `playerAugment1-6`（双源字段名一致，已验证）。字段缺失不阻塞渲染（原版 `noZero` 同款兜底）。

### 7.2 统计计算（口径与原版 data-adapter 一致）

- KDA：`(kills + assists) / noZero(deaths)`；死亡 0 显示 Perfect。
- 参与率：`(kills + assists) / noZero(该队总击杀)`；队总击杀按 teamId 累加（CHERRY 模式按
  subteam 累加，沿用原版 `isCherrySubteam` 判定）。
- 多杀：`doubleKills / tripleKills / quadraKills / pentaKills / unrealKills` 从 statsJson 解析，
  原版 `computeMultikillTags` 去重逻辑（五杀优先、四杀减五杀、三杀减四五杀之和），按 priority
  排序（penta > quadra > triple > double），红色主题标签。

### 7.3 队伍数据

teamsJson → 塔/水晶/龙/男爵/先锋/巢虫/阿塔坎计数；缺字段按 0 处理（老数据无 voidGrub/atakhan）。
首龙/首塔/首血标记解析沿用现有 `parseTeamsJson` 逻辑扩展。

### 7.4 时间线数据（Events/Builds/Timeline Tab）

`GET /api/matches/{gameId}/timeline` 返回 frames；适配层转换为：

- Events：击杀/一血/多杀/推塔/野怪事件序列（含位置坐标，供 MapPosition 点位图）。
- Builds：技能加点序列（Q/W/E/R 等级）+ 购买时间线（物品 + 时间戳，间隔 >30s 插 `→` 分隔）。
- Timeline：帧序列 → 经济差折线图 / 数据折线图两组数据。

## 8. 组件移植清单

### 8.1 共享 widgets（src/components/widgets/）

| 组件                    | 说明                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| ItemDisplay             | 图标 + popover：大图标/名称/ID、总价+合成价、合成路径 from/to、HTML 描述 |
| AugmentDisplay          | 稀有度渐变边框（bronze/silver/gold/prismatic）+ 名字/稀有度/中文 tooltip |
| SummonerSpellDisplay    | 图标 + popover：名字/冷却/等级要求/描述                           |
| PerkDisplay / PerkstyleDisplay | 符文/符文系图标 + 描述                                        |
| ChampionIcon            | 英雄头像（CDN）+ 等级角标 + 边框着色                              |
| DamageBar / DamageBarWithPopover | 伤害条形图（物理/魔法/真实占比，悬停弹窗）                |
| ManyTags                | 多杀/最高伤害/最高承伤等标签渲染                                  |
| RadarChart              | 六维雷达图（悬停 KDA 区域弹出）                                   |
| StatsBarChart           | 数据表行 hover 横向对比条形图                                     |
| MapPosition             | 小地图点位图（本地 map-images 资源）                              |
| TabSwitch               | Tab 切换（按胜负着色）                                            |
| VictimDamageDetails     | 击杀受害者伤害明细                                                |
| TeamTable               | 核心玩家表格（表头 7 野怪图标 + Ban 列表 + 三模式列配置）          |

### 8.2 卡片主体与 Tabs（src/components/match-card/）

- `MatchCard.vue`（provide/inject 上下文）+ `MatchCardOverview.vue`（折叠卡）+ `MatchCardDetails.vue`
  （TabSwitch + KeepAlive）。
- `tabs/MatchCardSummaryTab.vue`（双队 TeamTable）
- `tabs/MatchCardDetailsTab.vue`（转置统计表：18 组约 200 项，sticky 行列表头 + 滚轮横滚 + hover 条形图 + 关键字过滤）
- `tabs/MatchCardRunesTab.vue`（天赋树 + 选手导航器）
- `tabs/MatchCardEventsTab.vue`（NTimeline 事件流 + 地图点位 + 受害者明细）
- `tabs/MatchCardBuildsTab.vue`（技能加点 + 购买时间线）
- `tabs/timeline/MatchCardTimelineTab.vue`（经济差/数据折线图两个子 Tab）
- `utils/`：tags.tsx、theme.tsx、game-details.ts、game-map.ts、text.ts、time.ts、details-table/（groups.ts、raw-details.ts、renderers.tsx、types.ts、index.ts）
- `icons/`：Atakhan/Baron/Dragon/Inhibitor/RiftHerald/Tower/VoidGrub 七个 SVG 图标
- `match-card.css` 样式文件

### 8.3 详情页组装

- `MatchDetailView.vue` 重写：挂载 `MatchCard`（默认展开态），数据来自详情 API + timeline API。
- 现有 `MatchSummaryHeader / TeamStatsTable / ResourceStatsBanner` 三个旧组件及其专用 adapter
  由新体系替代，直接删除（git 历史可追溯，commit message 中注明）。
- `/matches/:gameId` 路由保留，作为列表展开与 player-profile 跳转的深链。

## 9. game-resource 扩展（src/utils/game-resource.ts）

- **augments**：新增 `loadAugments()` 加载 CDragon `augments.json`（图标/名称），
  `augmentDisplay(id)` 返回 `{ name, iconUrl, rarity, descriptionHtml? }`；
  gtimg `kiwi_augments.json`（中文描述 + 稀有度）经 `gtimgAugmentDisplay(id)` 合并，
  优先中文描述，缺失回退 CDragon 英文。
- **perks**：新增 `loadPerks()`（perkstyles + perks，CDragon `perkstyles.json` / `perks.json`），
  `perkDisplay(id)` / `perkstyleDisplay(id)`。
- **items 增强**：`itemDisplay` 返回值补充 `from` / `to`（合成路径数组）与 `priceTotal` / `price`
  （总价/合成费）。
- **champions**：`championName(id)`（CDragon `champions.json` 名称，用于标签与页头）。
- 沿用现有缓存 Promise + 请求序号防竞态模式；gtimg 若 CORS 受限，走 vite dev proxy 或后端代理。

## 10. 列表页改造（game-stats）

- 列表项替换为 `MatchCardOverview` 折叠卡（原版布局：左侧英雄/技能/符文/海克斯/KDA/伤害/补刀/
  装备/标签，右侧 5v5 玩家头像列表，最右展开箭头）。
- 点击卡片展开 `MatchCardDetails`（懒加载：先展示折叠卡数据，展开时拉详情 + timeline）。
- 数据源：`listMatches`（含扩展后的轻量 participants）。
- game-stats 页现有"侧栏统计 + 列表"布局保留，仅列表项形态替换。

## 11. 测试策略

| 模块         | 测试                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| web 适配层   | vitest：LCU 平铺 fixture + SGP 嵌套 fixture 解析、KDA/参与率公式、多杀标签去重、时间线转换 |
| web 组件     | 组件冒烟（MatchCardOverview 渲染、TabSwitch 切换、TeamTable 排序）               |
| server       | JUnit：timeline 幂等写入、GET 200/404、列表 DTO 字段提取                          |
| match-sync   | vitest：frames 转换（双源 fixture）、重试、补拉跳过逻辑                           |

遵循主项目测试原则：只测用户可见行为、业务不变量、协议契约，不测实现细节。

## 12. 风险与实施顺序

- **移植体积**：约 8400 行，分阶段 commit，每阶段可运行验证：
  1. 基础设施（vue-jsx、i18n 常量、CDN 图片、game-resource 扩展）
  2. 共享 widgets（含 ItemDisplay 合成路径、AugmentDisplay）
  3. 折叠卡 + 列表页改造（后端列表 DTO 变更同步）
  4. 展开面板 + Summary/Details/Runes Tab（详情适配层）
  5. Events/Builds/Timeline Tab（依赖后端 timeline API 联调）
  6. 测试补齐与回归
- **gtimg CORS**：kiwi_augments.json 浏览器直连受限时走 vite proxy。
- **历史对局**：frames 数据量大，POST 分批/超时；补拉只在 timeline 缺失时触发。
- **CHERRY 模式**：subteam 队伍逻辑与 5v5 不同，移植后单独验证。
- **双仓库变更**：LeagueAkari 与 league-akari-server 为独立 git 仓库，改动分别在各自仓库
  提交；本规格存放于 league-akari-web，作为三仓库的联合契约。
