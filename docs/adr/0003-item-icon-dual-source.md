# 装备图标双源策略：Data Dragon 动态版本 + CDragon 兜底

装备图标（`itemIconUrl`）主源为 Data Dragon 写死版本 `16.16.1`，而物品中文名取自
CommunityDragon `latest`——两个数据源版本天然错位。版本交界期新装备在中文名里存在、
图标却 404（实例：16.17.1 新增的 ARAM 装备 226668 终极九头蛇，全量 868 件中唯一缺图）。
现为：主源版本号启动时从 `https://ddragon.leagueoflegends.com/api/versions.json` 动态探测
（失败回退写死值、可重试、Promise 去重）；`itemDisplay()` 由 items.json 自带的
LCU `iconPath` 解析出 CDragon 资源 URL 作 `fallbackIconUrl`；`CdnImage` 新增可选
`fallback` 属性——主源失败换兜底源重试一次，再失败才渲染灰占位。

## Status

accepted

## Considered Options

- **只手动升级写死版本号（16.16.1 → 16.17.1）** → 否决——最快但每个版本交界期复发，
  维持成本随时间累积（本次问题即由此产生）
- **只动态探测版本号** → 否决——新版本发布后 ddragon 滚动更新可能落后于
  CDragon latest（中文名数据源），交界期仍会缺图；且 versions.json 网络失败时无兜底
- **图标全面切到 CDragon（iconPath 派生，与中文名同源）** → 否决——
  raw.communitydragon.org 的速度与稳定性不如 ddragon CDN，全量切换劣化大多数
  （99.9%）正常图标的加载体验，为 0.1% 的边界情况买单
- **选定双源**：主源承担绝大多数流量（快、稳），兜底只在新装备/版本交界期/探测失败时
  被动触发；两源各自独立失败，互为保险

## Consequences

- `icon-url.ts` 的 `DD_DRAGON_VERSION` 常量变为 `FALLBACK_DD_DRAGON_VERSION`（仅探测失败回退用）；
  每次页面会话首个物品加载多一个 versions.json 请求（约 200B，Promise 缓存后仅一次）
- `ItemDisplayResource` 新增可选字段 `fallbackIconUrl`（iconPath 缺失的老数据为 undefined，
  CdnImage 按无兜底处理，行为同旧版）
- `CdnImage` 无 `fallback` 属性时行为与旧版完全一致（失败直接灰占位），其它消费方
  （英雄头像/符文/海克斯强化等）零改动
- 召唤师头像 `profileIconUrl` 与装备同源同版本，一并受益于动态版本
- 服务端战报图（Java2D）与 Electron 客户端不受影响：前者只画英雄头像（CDragon champion-icons），
  后者走 LCU 本地 `akari://` 资源
