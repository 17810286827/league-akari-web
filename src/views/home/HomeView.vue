<script setup lang="ts">
/**
 * 首页：居中召唤师搜索框（淡绿终端风格）
 * 输入"昵称#tag" → Riot Account 搜索（后端 JVM 缓存）→ 成功跳转到该玩家的战绩页；
 * 默认不展示任何战绩，必须先搜索指定玩家。
 * 车队名单预置：挂载时拉取开黑小队成员昵称，聚焦输入框时下拉展示（可输入过滤），
 * 点击成员直接发起搜索；名单拉取失败静默降级，不影响手动输入搜索。
 */
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { searchRiotAccount } from '@/api/matches'
import { getTeamMembers } from '@/api/team'
import type { TeamMember } from '@/api/team'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Home')
const message = useMessage()
const router = useRouter()

/** 搜索输入框内容（"昵称#tag"） */
const summonerInput = ref('')
/** 搜索请求中标记（防止重复提交） */
const searching = ref(false)
/** 车队名单（开黑小队成员，下拉预置用；拉取失败为空数组） */
const roster = ref<TeamMember[]>([])
/** 下拉框显隐（聚焦输入框时展示） */
const showSuggestions = ref(false)

/** 下拉候选项：按输入子串过滤车队昵称（不区分大小写），最多展示 8 条 */
const suggestions = computed(() => {
  const keyword = summonerInput.value.trim().toLowerCase()
  const matched = keyword
    ? roster.value.filter((m) => m.riotId.toLowerCase().includes(keyword))
    : roster.value
  return matched.slice(0, 8)
})

/** 挂载时拉取车队名单；失败静默降级（下拉不展示，手动搜索不受影响） */
async function loadRoster(): Promise<void> {
  try {
    roster.value = await getTeamMembers()
  } catch (error) {
    logger.info('车队名单拉取失败，下拉预置降级', error)
    roster.value = []
  }
}

/** 点击下拉成员：填充输入框并直接发起搜索 */
function selectMember(riotId: string): void {
  summonerInput.value = riotId
  showSuggestions.value = false
  void submitSearch()
}

/**
 * 提交搜索：校验非空 → 调用 Riot 搜索 → 成功后跳转到战绩页（/players/:puuid）
 * 失败（召唤师不存在 / API Key 未配置等）时提示后端返回的明确原因
 */
async function submitSearch(): Promise<void> {
  const riotName = summonerInput.value.trim()
  if (!riotName || searching.value) {
    return
  }
  searching.value = true
  try {
    const account = await searchRiotAccount(riotName)
    logger.info('Summoner found, navigate to matches', { puuid: account.puuid })
    // 携带昵称/尾号跳转：战绩页顶部展示当前查询玩家
    await router.push({
      path: `/players/${account.puuid}`,
      query: { name: account.gameName, tag: account.tagLine }
    })
  } catch (error) {
    // 优先取后端返回的 message（如"Riot API Key 未配置"/"召唤师不存在"）
    const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    const reason = detail ?? (error instanceof Error ? error.message : '未知错误')
    logger.error('Failed to search summoner', { riotName, error })
    message.error(`召唤师查询失败：${reason}`)
  } finally {
    searching.value = false
  }
}

onMounted(loadRoster)
</script>

<template>
  <div class="home">
    <!-- 品牌标题：淡绿终端签名（Russo One 数字字体 + 柔和绿渐变） -->
    <h1 class="home-title">
      LEAGUE<span class="home-title-accent">AKARI</span>
    </h1>
    <p class="home-subtitle">输入召唤师名，查询对局记录</p>

    <!-- 居中搜索框：大输入框（含车队昵称预置下拉）+ 绿调渐变按钮 -->
    <div class="search-box">
      <div class="search-input-wrap">
        <input
          v-model="summonerInput"
          class="search-input"
          placeholder="昵称#tag，如 赌书消得泼茶香#iKun"
          data-testid="search-input"
          @focus="showSuggestions = true"
          @blur="showSuggestions = false"
          @keyup.enter="submitSearch"
        />
        <!-- 车队名单预置下拉：聚焦/输入时展示，点击成员直接搜索 -->
        <ul
          v-if="showSuggestions && suggestions.length"
          class="roster-suggestions"
          data-testid="roster-suggestions"
        >
          <li v-for="member in suggestions" :key="member.riotId">
            <button
              type="button"
              class="roster-item"
              data-testid="roster-item"
              @mousedown.prevent
              @click="selectMember(member.riotId)"
            >
              <span class="roster-item-name">{{ member.riotId }}</span>
              <span class="roster-item-meta">{{ member.games }}场</span>
            </button>
          </li>
        </ul>
      </div>
      <button type="button" class="search-button" :disabled="searching" @click="submitSearch">
        {{ searching ? '查询中...' : '查询战绩' }}
      </button>
    </div>

    <!-- 车队功能区入口：周报与榜单中心 -->
    <nav class="home-team-nav">
      <RouterLink class="home-team-link" to="/weekly">车队周报</RouterLink>
      <RouterLink class="home-team-link" to="/leaderboards">榜单中心</RouterLink>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
/* 首页容器：全屏居中，近黑底 + 顶部柔和绿光晕（与战绩页背景一致） */
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: 12px;
  background:
    radial-gradient(900px 420px at 50% 30%, rgba(74, 222, 128, 0.18), transparent 65%),
    #0b0f0c;
}

/* 品牌标题：Russo One 字体，绿→淡绿渐变点缀 */
.home-title {
  font-family: 'Russo One', 'Segoe UI', sans-serif;
  font-size: 44px;
  letter-spacing: 0.12em;
  color: #ecfdf5;
  text-shadow: 0 0 24px rgba(74, 222, 128, 0.35);
}

/* 手机（≤640px）：标题字号降为 30px——44px 桌面字号在 375px 视口
   占比过大，且 0.12em 字距会把"LEAGUE AKARI"挤出首行 */
@media (max-width: 640px) {
  .home-title {
    font-size: 30px;
  }
}

.home-title-accent {
  background: linear-gradient(90deg, #86efac, #f87171);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-left: 10px;
}

.home-subtitle {
  font-size: 15px;
  color: #9ca3af;
}

/* 搜索区：输入框（含预置下拉）+ 按钮一行 */
.search-box {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  width: min(560px, 90vw);
}

/* 输入框容器：下拉面板的定位锚点 */
.search-input-wrap {
  position: relative;
  display: flex;
  flex: 1;
}

/* 车队名单预置下拉：深底玻璃面板 + 绿调描边，覆盖在页面内容之上 */
.roster-suggestions {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 12px;
  border: 1px solid rgba(74, 222, 128, 0.35);
  background: rgba(17, 22, 17, 0.97);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}

.roster-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  font-size: 15px;
  color: #ecfdf5;
  border-radius: 8px;
  text-align: left;
  transition: background 0.12s;

  &:hover {
    background: rgba(74, 222, 128, 0.14);
  }
}

.roster-item-meta {
  font-size: 12px;
  color: #8b93a7;
}

/* 车队功能区入口：两个玻璃质感链接 */
.home-team-nav {
  display: flex;
  gap: 14px;
  margin-top: 22px;
}

.home-team-link {
  padding: 8px 20px;
  font-size: 14px;
  color: #9ca3af;
  border: 1px solid rgba(74, 222, 128, 0.25);
  border-radius: 6px;
  transition: all 0.2s;
}

.home-team-link:hover {
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.6);
  text-shadow: 0 0 12px rgba(74, 222, 128, 0.4);
}

/* 大输入框：玻璃质感 + 绿调描边 */
.search-input {
  flex: 1;
  padding: 14px 18px;
  font-size: 16px;
  border-radius: 12px;
  border: 1px solid rgba(74, 222, 128, 0.35);
  background: rgba(17, 22, 17, 0.92);
  color: #ecfdf5;
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder {
    color: #8b93a7;
  }

  &:focus {
    outline: none;
    border-color: #86efac;
    box-shadow: 0 0 16px rgba(74, 222, 128, 0.35);
  }
}

/* 查询按钮：绿调渐变 + 发光 */
.search-button {
  flex-shrink: 0;
  padding: 14px 26px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(90deg, #4ade80, #86efac);
  color: #fff;
  box-shadow: 0 4px 20px rgba(74, 222, 128, 0.35);
  transition: filter 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.12);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
