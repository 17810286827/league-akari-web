<script setup lang="ts">
/**
 * 首页：居中召唤师搜索框（淡绿终端风格）
 * 输入"昵称#tag" → Riot Account 搜索（后端 JVM 缓存）→ 成功跳转到该玩家的战绩页；
 * 默认不展示任何战绩，必须先搜索指定玩家
 */
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { searchRiotAccount } from '@/api/matches'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Home')
const message = useMessage()
const router = useRouter()

/** 搜索输入框内容（"昵称#tag"） */
const summonerInput = ref('')
/** 搜索请求中标记（防止重复提交） */
const searching = ref(false)

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
</script>

<template>
  <div class="home">
    <!-- 品牌标题：淡绿终端签名（Russo One 数字字体 + 柔和绿渐变） -->
    <h1 class="home-title">
      LEAGUE<span class="home-title-accent">AKARI</span>
    </h1>
    <p class="home-subtitle">输入召唤师名，查询对局记录</p>

    <!-- 居中搜索框：大输入框 + 绿调渐变按钮 -->
    <div class="search-box">
      <input
        v-model="summonerInput"
        class="search-input"
        placeholder="昵称#tag，如 赌书消得泼茶香#iKun"
        @keyup.enter="submitSearch"
      />
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
  min-height: 100vh;
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

/* 搜索区：输入框 + 按钮一行 */
.search-box {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  width: min(560px, 90vw);
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
  background: rgba(17, 22, 17, 0.85);
  backdrop-filter: blur(8px);
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
