<script setup lang="ts">
/**
 * 首页：居中召唤师搜索框（电竞终端风格）
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
    <!-- 品牌标题：电竞终端签名（Russo One 数字字体 + 霓虹紫渐变） -->
    <h1 class="home-title">
      LEAGUE<span class="home-title-accent">AKARI</span>
    </h1>
    <p class="home-subtitle">输入召唤师名，查询对局记录</p>

    <!-- 居中搜索框：大输入框 + 紫调渐变按钮 -->
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
  </div>
</template>

<style lang="scss" scoped>
/* 首页容器：全屏居中，近黑底 + 顶部微紫光晕（与战绩页背景一致） */
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 12px;
  background:
    radial-gradient(900px 420px at 50% 30%, rgba(124, 58, 237, 0.18), transparent 65%),
    #09090b;
}

/* 品牌标题：Russo One 字体，紫→玫红渐变点缀 */
.home-title {
  font-family: 'Russo One', 'Segoe UI', sans-serif;
  font-size: 44px;
  letter-spacing: 0.12em;
  color: #f4f2fa;
  text-shadow: 0 0 24px rgba(124, 58, 237, 0.35);
}

.home-title-accent {
  background: linear-gradient(90deg, #a78bfa, #f43f5e);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-left: 10px;
}

.home-subtitle {
  font-size: 15px;
  color: #a6acbf;
}

/* 搜索区：输入框 + 按钮一行 */
.search-box {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  width: min(560px, 90vw);
}

/* 大输入框：玻璃质感 + 紫调描边 */
.search-input {
  flex: 1;
  padding: 14px 18px;
  font-size: 16px;
  border-radius: 12px;
  border: 1px solid rgba(124, 58, 237, 0.35);
  background: rgba(18, 16, 28, 0.85);
  backdrop-filter: blur(8px);
  color: #f4f2fa;
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder {
    color: #8b93a7;
  }

  &:focus {
    outline: none;
    border-color: #a78bfa;
    box-shadow: 0 0 16px rgba(124, 58, 237, 0.35);
  }
}

/* 查询按钮：紫调渐变 + 发光 */
.search-button {
  flex-shrink: 0;
  padding: 14px 26px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  color: #fff;
  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35);
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
