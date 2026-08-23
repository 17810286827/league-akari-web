# 0001-mvp-svp-badge-display.md

# MVP/SVP 徽章只在展开卡队伍表格展示

对局详情接口返回的 mvp/svp（称号持有者档案）只在展开卡 TeamTable 玩家行以文字徽章形式展示（MVP 金色 `--gold-accent`、SVP 银灰白），挂在对应对家名字旁；纯展示无点击交互，不展示评分分数。

## Status

accepted

## Considered Options

- **展示位置**：折叠卡标签行 / 折叠卡头像角标 → 否决——mvp/svp 数据只在详情接口（MatchDetail），列表接口（MatchSummary）未返回；折叠卡首次渲染用伪造 detail（无此数据），展开缓存后才有，体验"时有时无"。选定展开卡 TeamTable：数据必可用，且 10 人全景表是评奖语义最自然的场景
- **形式**：皇冠图标 → 否决——皇冠语义是"第一名"（CHERRY 模式已占用），与 MVP/SVP 称号语义混淆；图标+文字组合 → 否决——TeamTable 行内信息密度已高。选定小型文字徽章，配色沿用玩家最熟悉的约定（金 MVP / 银 SVP）
- **分数展示**：全员 10 人评分列 → 否决——match_mvp 表只落库 MVP/SVP 两条，全员分数需后端实时重算或扩表，先不做；MVP/SVP 悬浮分数 → 一并搁置（"先不展示分数"），后续想加再说
- **交互**：点击徽章跳转该玩家战绩 → 否决——TeamTable 玩家名本身无跳转逻辑，单独给徽章加跳转形成交互孤岛，保持纯展示

## Consequences

- 后端零改动：详情接口现有 mvp/svp 字段（null 表示未评选的老数据，前端不渲染徽章）
- 前端以 puuid 匹配徽章归属（MatchParticipant 无 participantId 直连字段，适配层才有）
- 若未来要在折叠卡展示，需后端列表接口补 mvp/svp 字段（本 ADR 的数据约束是决策依据）
- 全员评分展示若重启，需后端支持（实时重算或落库全量评分），见"分数展示"否决原因