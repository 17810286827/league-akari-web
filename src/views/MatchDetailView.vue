<script setup lang="ts">
/**
 * 对局详情页（OP.GG 两队对比布局）
 * 顶部概要条展示模式/时长/版本/日期/获胜方；
 * 下方蓝红两队并排对比（宽屏两栏、窄屏堆叠），
 * 每行玩家展示英雄头像、召唤师名（自我金色徽章）、KDA、出装与统计。
 *
 * 页面布局结构（自上而下）：
 * 1. 概要条：模式 · 时长 · 版本 · 日期 · 获胜方徽章（蓝/红/未知）；
 * 2. 两队面板：每队一张卡片，队首色条 + 队名 + 获胜"胜"标记；
 * 3. 玩家行：三列布局（头像 | 名称+统计 | KDA+出装），
 *    胜者行使用 --bg-win / --bg-loss 半透明底色区分胜负。
 *
 * 性能约定：statsJson 与 items 的解析全部在 teams computed 中预执行，
 * 模板渲染时零次 JSON.parse（任务 4 重复解析问题的修正）。
 * 数据来源：后端 /api/matches/{gameId}，stats_json 解析失败不阻塞页面展示。
 */
import { getMatchDetail } from '@/api/matches'
import type { MatchDetail, MatchParticipant, ParsedStats } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { parseIdArray } from '@/utils/parse-json'
import { championIconUrl, itemIconFallbackUrl, itemIconUrl } from '@/utils/icon-url'
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

// 日志器：来源标签固定为 MatchDetail，便于在 DevTools 中按标签过滤日志
const logger = createLogger('MatchDetail')
// 全局消息提示：详情加载失败时向用户展示错误原因
const message = useMessage()
// 路由实例：从路由参数中读取对局 ID
const route = useRoute()

// 对局 ID：由路由参数转换而来，用于请求后端详情接口
const gameId = Number(route.params.gameId)
// 详情加载状态：为 true 时展示全局加载动画
const loading = ref(false)
// 对局详情数据：加载成功后填充，404 时保持 null 并展示空态
const detail = ref<MatchDetail | null>(null)

// 出装槽位数：OP.GG 展示风格固定 6 格，不足补占位、多余截断
// 槽位渲染在模板中以 v-for 展开，空位由 .item-slot-empty 占位保持对齐
const ITEM_SLOTS = 6

// 游戏模式 -> 中文名映射（未知模式原样展示后端值）
// CHERRY 为特殊模式，胜负语义与标准模式不同，概要不做蓝红判定
const modeNames: Record<string, string> = {
  CLASSIC: '经典模式',
  ARAM: '极地大乱斗',
  CHERRY: '特殊模式'
}

// 队列 ID -> 中文名映射（用于概要条补充展示）
const queueNames: Record<number, string> = {
  420: '单双排位',
  440: '灵活排位',
  430: '匹配',
  450: '极地大乱斗'
}

/** 队伍玩家：在参与者基础上预处理统计与出装，模板不再重复解析 */
interface TeamPlayer extends MatchParticipant {
  /** 预解析的 stats_json：模板只读该字段，避免多次 JSON.parse */
  stats: ParsedStats
  /** 预解析的出装物品 ID 数组（最多取前 6 个） */
  itemIds: number[]
}

/** 队伍分组结果：包含队伍 ID、是否获胜与预处理后的玩家列表 */
interface TeamGroup {
  teamId: number
  /** 该队是否为获胜方（详情接口 winnerTeamId 与 teamId 一致） */
  isWinner: boolean
  players: TeamPlayer[]
}

/**
 * 解析 stats_json；解析失败返回空对象并记 warn 日志（不阻塞展示）
 * 注意：仅在 teams computed 中调用，保证每个玩家只解析一次
 * 返回的 ParsedStats 为可选字段结构，缺失字段在模板中以 '-' 兜底
 */
function parseStats(statsJson: string | null): ParsedStats {
  if (!statsJson) {
    return {}
  }
  try {
    return JSON.parse(statsJson) as ParsedStats
  } catch (error) {
    // 单条记录解析失败只影响该玩家的统计行，页面其余部分继续渲染
    logger.warn('Failed to parse statsJson', { gameId, statsJson, error })
    return {}
  }
}

/** 把秒数格式化为 mm:ss，供概要条与列表统一展示 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  // 补零到两位并配合 tabular-nums，保证概要条内数字视觉对齐
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** 游戏模式 -> 中文名；未知模式回退为后端原始值 */
// 映射表与列表页 modeNames 保持一致，保证两页对同一模式命名统一
function modeLabel(mode: string): string {
  return modeNames[mode] ?? mode
}

/** 队列 ID -> 中文名；未知队列回退为 "队列 {ID}" */
// 详情页仅作展示辅助，未匹配的队列 ID 仍可正常渲染
function queueName(id: number): string {
  return queueNames[id] ?? `队列 ${id}`
}

/**
 * 按队伍分组（100/200），组内按击杀排序；
 * 分组同时预解析每个玩家的 stats 与出装，修正任务 4 中模板内重复 JSON.parse 的问题
 */
const teams = computed<TeamGroup[]>(() => {
  // detail 为空（未加载/加载失败）时返回空数组，模板走空态分支
  if (!detail.value) {
    return []
  }
  // 以 teamId 为键分组，同一队伍的所有玩家归入一个列表
  const groups = new Map<number, TeamPlayer[]>()
  for (const p of detail.value.participants) {
    // 预处理：统计解析 + 出装解析各执行一次，结果供模板直接消费
    // stats 供伤害/承伤/视野列取值；itemIds 截断到 6 槽并驱动出装图标
    const player: TeamPlayer = {
      ...p,
      stats: parseStats(p.statsJson),
      itemIds: parseIdArray(p.items).slice(0, ITEM_SLOTS)
    }
    const list = groups.get(p.teamId) ?? []
    list.push(player)
    groups.set(p.teamId, list)
  }
  // 队伍按 ID 升序保证蓝方（100）恒在前；isWinner 由 winnerTeamId 与队 ID 比对得出
  // 组内玩家按击杀降序，突出本队贡献最高的玩家（OP.GG 列表惯例）
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, players]) => ({
      teamId,
      isWinner: detail.value?.winnerTeamId === teamId,
      players: [...players].sort((a, b) => b.kills - a.kills)
    }))
})

/** 出装图标加载失败：降级到 Data Dragon（CommunityDragon items 路径当前已失效） */
function onItemError(event: Event, itemId: number) {
  const img = event.target as HTMLImageElement
  // 已降级过一次则不再处理，避免失败后反复触发死循环
  if (img.dataset.fallback === 'true') {
    return
  }
  // dataset.fallback 标记保证每个 img 最多降级一次，防止 404 循环请求
  img.dataset.fallback = 'true'
  img.src = itemIconFallbackUrl(itemId)
}

/** 英雄头像加载失败：隐藏图片，露出容器占位底色 */
// 头像 CDN 已验证可用，此处理仅作网络异常兜底，不额外请求降级源
function onChampionError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.visibility = 'hidden'
}

// 组件挂载后请求详情：失败时提示用户对局不存在或后端未启动
onMounted(async () => {
  loading.value = true
  try {
    detail.value = await getMatchDetail(gameId)
    logger.info('Match detail loaded', { gameId, participants: detail.value.participants.length })
  } catch (error) {
    // 404 或网络错误统一走这里：记录日志并向用户提示，页面展示空态
    logger.error('Failed to load match detail', { gameId, error })
    message.error('对局详情加载失败：对局不存在或后端未启动')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- 加载动画包裹整个详情区域，请求期间展示转圈 -->
  <!-- 加载完成后按分支渲染：详情内容 / 404 空态 -->
  <n-spin :show="loading">
    <template v-if="detail">
      <div class="match-detail">
        <!-- 顶部概要条：模式 · 时长 · 版本 · 日期 · 获胜方 -->
        <!-- 概要条为信息总览，不承载交互；日期使用本地化格式展示 -->
        <div class="summary-bar">
          <!-- 模式与队列合并展示，如 "经典模式 · 单双排位" -->
          <div class="summary-item">
            <span class="summary-label">模式</span>
            <span class="summary-value">{{ modeLabel(detail.gameMode) }} · {{ queueName(detail.queueId) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">时长</span>
            <span class="summary-value tabular-nums">{{ formatDuration(detail.gameDuration) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">版本</span>
            <span class="summary-value">{{ detail.gameVersion }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">日期</span>
            <span class="summary-value tabular-nums">{{ new Date(detail.gameCreation).toLocaleString() }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">获胜方</span>
            <!-- 胜方徽章：蓝方蓝 / 红方红 / 未知灰色 -->
            <!-- 三级判定：winnerTeamId === 100 蓝方，=== 200 红方，其余未知 -->
            <span
              class="winner-badge"
              :class="detail.winnerTeamId === 100 ? 'win' : detail.winnerTeamId === 200 ? 'loss' : 'tie'"
            >
              {{ detail.winnerTeamId === 100 ? '蓝方' : detail.winnerTeamId === 200 ? '红方' : '未知' }}
            </span>
          </div>
        </div>

        <!-- 两队对比：宽屏两栏并排，窄屏上下堆叠 -->
        <!-- 每队渲染一个面板；isWinner 驱动"胜"标记与队首色条 -->
        <div class="teams">
          <section v-for="team in teams" :key="team.teamId" class="team-panel">
            <!-- 队首标题：色条标识阵营（100 蓝 / 200 红），"胜"标记使用金色点缀 -->
            <header class="team-title">
              <span class="team-bar" :class="team.teamId === 100 ? 'blue' : 'red'" aria-hidden="true" />
              <span class="team-name">
                {{ team.teamId === 100 ? '蓝方' : '红方' }} · {{ team.teamId }}
              </span>
              <!-- 获胜队伍标记：仅胜方显示，金色描边呼应 LOL 主题色 -->
              <span v-if="team.isWinner" class="team-winner-tag">胜</span>
            </header>

            <!-- 玩家行列表：胜者行背景 --bg-win / --bg-loss，逐行对比展示 -->
            <ul class="player-list">
              <!-- 玩家行三列结构：[头像] [名称+统计] [KDA+出装] -->
              <!-- 行底色随玩家胜负：win 用 --bg-win 蓝底、loss 用 --bg-loss 红底 -->
              <li
                v-for="p in team.players"
                :key="p.puuid"
                class="player-row"
                :class="p.win ? 'win' : 'loss'"
              >
                <!-- 英雄头像：CDN 48px 圆角，加载失败露出占位底色 -->
                <img
                  class="avatar"
                  :src="championIconUrl(p.championId)"
                  :alt="`英雄 ${p.championId}`"
                  @error="onChampionError"
                />
                <!-- 玩家信息列：召唤师名 + 自我徽章 + 统计行 -->
                <div class="player-info">
                  <div class="name-line">
                    <span class="summoner-name">{{ p.summonerName }}</span>
                    <!-- 自我标记：selfPuuid 匹配的玩家加金色"我"徽章 -->
                    <!-- 比对对象为详情接口的 selfPuuid 字段，与后端同步写入一致 -->
                    <span v-if="p.puuid === detail.selfPuuid" class="me-badge">我</span>
                    <span class="position">{{ p.position ?? '-' }}</span>
                  </div>
                  <!-- 统计行：伤害/承伤/视野/CS/金币，等宽数字表格化对齐，缺失显示 - -->
                  <div class="stat-line tabular-nums">
                    <div class="stat-item">
                      <span class="stat-label">伤害</span>
                      <span class="stat-value">{{ p.stats.totalDamageDealtToChampions ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">承伤</span>
                      <span class="stat-value">{{ p.stats.totalDamageTaken ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">视野</span>
                      <span class="stat-value">{{ p.stats.visionScore ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">CS</span>
                      <span class="stat-value">{{ p.cs ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">金币</span>
                      <span class="stat-value">{{ p.goldEarned ?? '-' }}</span>
                    </div>
                  </div>
                </div>
                <!-- KDA 与出装列：死亡数红色，出装 6 槽位不足显示占位 -->
                <!-- KDA 三数等宽排布；deaths 使用 --loss-color 突出警示 -->
                <div class="kda-items">
                  <div class="kda tabular-nums">
                    <span class="kda-num">{{ p.kills }}</span>
                    <span class="kda-sep">/</span>
                    <span class="kda-num kda-death">{{ p.deaths }}</span>
                    <span class="kda-sep">/</span>
                    <span class="kda-num">{{ p.assists }}</span>
                  </div>
                  <div class="items">
                    <!-- 出装槽位：固定 6 格，有物品显示图标，空槽位显示占位 -->
                    <!-- 图标加载失败由 onItemError 降级到 Data Dragon，避免空白 -->
                    <template v-for="slot in ITEM_SLOTS" :key="slot">
                      <img
                        v-if="p.itemIds[slot - 1] != null"
                        class="item-icon"
                        :src="itemIconUrl(p.itemIds[slot - 1])"
                        :alt="`物品 ${p.itemIds[slot - 1]}`"
                        @error="onItemError($event, p.itemIds[slot - 1])"
                      />
                      <span v-else class="item-slot-empty" aria-hidden="true" />
                    </template>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
    <!-- 空态：请求完成且无数据（如无效 gameId 导致 404）时展示 -->
    <!-- 说明文案与加载/错误提示相互独立，用户可区分三种状态 -->
    <n-empty v-else-if="!loading" description="对局不存在" />
  </n-spin>
</template>

<style scoped>
/* 页面容器：居中限定最大宽度，与列表页容器宽度保持一致 */
/* 上 24px 下 40px 留白，与列表页视觉节奏统一 */
.match-detail {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

/* 顶部概要条：横向排列信息项，窄屏自动换行 */
/* 使用卡片背景色与 8px 圆角，与下方队伍面板形成统一层级 */
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 32px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 14px 20px;
}

/* 概要信息项：小标签在上、数值在下 */
/* 纵向排列避免标签与数值混排，信息密度高但易扫描 */
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-label {
  font-size: 11px;
  color: var(--text-secondary);
}
/* 概要标签：11px 次要色，弱于数值但保持可读 */
/* 概要数值：主文本色 14px，日期/时长等数字由模板 tabular-nums 对齐 */
.summary-value {
  font-size: 14px;
}

/* 胜方徽章：与列表页徽章一致的色块风格 */
.winner-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  align-self: flex-start;
}
.winner-badge.win {
  color: var(--win-color);
  background: var(--bg-win);
}
.winner-badge.loss {
  color: var(--loss-color);
  background: var(--bg-loss);
}
.winner-badge.tie {
  color: var(--text-secondary);
  background: rgba(139, 147, 167, 0.1);
}

/* 两队对比容器：宽屏两栏并排 */
/* grid 两列等宽；900px 以下切为单列堆叠（见文件底部媒体查询） */
.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

/* 队伍面板：卡片背景，容纳标题与玩家行列表 */
/* 蓝红两面板结构完全对称，方便逐行对比双方数据 */
.team-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px;
}

/* 队首标题行：色条 + 队名 + 获胜标记横排 */
/* 标题不参与网格对齐，仅作为面板的分区标识 */
.team-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 10px;
}
/* 队首色条：蓝方蓝 / 红方红，标识队伍阵营 */
/* 与列表页卡片色条同尺寸体系，视觉语言全局统一 */
.team-bar {
  width: 4px;
  height: 18px;
  border-radius: 2px;
}
.team-bar.blue {
  background: var(--win-color);
}
.team-bar.red {
  background: var(--loss-color);
}
.team-name {
  font-weight: 600;
  font-size: 15px;
}
/* 队名文字：加粗 15px，与玩家行名称形成层级差异 */
/* 获胜队伍标记：LOL 金点缀，用于签名元素 */
/* 金色描边 + 同色文字，属于全局最克制的点缀用法之一 */
.team-winner-tag {
  color: var(--gold-accent);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--gold-accent);
  border-radius: 4px;
  padding: 0 6px;
}

/* 玩家列表：去除默认列表样式，行间 8px 间距 */
/* 纵向 flex 排列，逐行底色对比让胜负一目了然 */
.player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 玩家行：头像 | 信息统计 | KDA与出装 三列布局 */
/* 三列宽度：头像固定 48px，信息列自适应，KDA 列按内容收缩 */
.player-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
}
/* 胜者行底色：胜利蓝 / 失败红（半透明），队伍对比一目了然 */
/* 半透明底色叠加在 --bg-card 上，保证文字对比度与暗色氛围 */
.player-row.win {
  background: var(--bg-win);
}
.player-row.loss {
  background: var(--bg-loss);
}

/* 英雄头像：48px 圆角，深色占位底在加载失败时可见 */
/* 加载失败时 onChampionError 隐藏 img，露出此处背景色占位 */
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(139, 147, 167, 0.12);
}

/* 玩家信息列：名称行 + 统计行 纵向排列 */
/* 两行信息共享同一列宽，视觉上归为一个信息单元 */
.player-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 名称行：召唤师名（可截断）+ 自我徽章 + 位置 */
/* min-width: 0 允许 flex 子项收缩，长名称以省略号截断 */
.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
/* 召唤师名：600 字重，超长时省略号截断（配合 .name-line 的收缩） */
.summoner-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 自我徽章：LOL 金色描边，标识当前用户 */
/* 与 .team-winner-tag 共用金色体系，保持视觉语言一致 */
.me-badge {
  flex: 0 0 auto;
  color: var(--gold-accent);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--gold-accent);
  border-radius: 4px;
  padding: 0 5px;
}
/* 对线位置：次要小字 */
/* position 可能为 null，模板中以 '-' 兜底展示 */
.position {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-secondary);
}

/* 统计行：五列等宽，数字等宽对齐 */
/* repeat(5, minmax(52px, 1fr))：窄屏下自动收缩而非溢出 */
.stat-line {
  display: grid;
  grid-template-columns: repeat(5, minmax(52px, 1fr));
  gap: 4px;
}
/* 统计项：标签在上、数值在下 */
/* 五列共享同一结构，扫描时只需横向比对数值列 */
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-label {
  font-size: 10px;
  color: var(--text-secondary);
}
/* 统计数值：12px 主文本色，比标签大一级形成主次 */
.stat-value {
  font-size: 12px;
}

/* KDA 与出装列：右对齐纵向排列 */
/* 右对齐使两队玩家行的数字列在视觉上互相参照 */
.kda-items {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* KDA 数字：击杀/助攻主色，死亡数字红色，等宽对齐 */
/* 数字用 inline-block + min-width 保证个位数与两位数宽度一致 */
.kda {
  font-size: 16px;
  font-weight: 600;
}
.kda-num {
  display: inline-block;
  min-width: 1.1em;
  text-align: center;
}
/* 单个 KDA 数字：固定最小宽度居中，三位数字对齐 */
.kda-death {
  color: var(--loss-color);
}
/* 死亡数单独着色：失败红警示，与胜方蓝底形成语义对照 */
.kda-sep {
  color: var(--text-secondary);
  font-weight: 400;
}

/* 出装图标行：6 槽位横排 */
/* 槽位尺寸与 .item-slot-empty 一致，空槽位不破坏对齐 */
.items {
  display: flex;
  gap: 4px;
}
/* 出装图标：28px 圆角小图标 */
/* 背景底色在图标加载期间/失败后可见，与空槽位占位风格一致 */
.item-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: rgba(139, 147, 167, 0.12);
}
/* 空出装槽位：浅色占位块，保持 6 槽位对齐 */
/* 与 .item-icon 同尺寸同圆角，有图无图时行高恒定 */
.item-slot-empty {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: rgba(139, 147, 167, 0.1);
}

/* 窄屏（≤900px）：两队上下堆叠 */
/* 队伍面板保持内部布局不变，仅切换为单列 grid */
@media (max-width: 900px) {
  .teams {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  /* 极窄屏（≤560px）：头像与信息列保持，KDA/出装列换行到下一行 */
  /* grid-column: 1 / -1 让 KDA 行占满整行，避免挤压统计列 */
  .player-row {
    grid-template-columns: 48px 1fr;
  }
  .kda-items {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
}
</style>
