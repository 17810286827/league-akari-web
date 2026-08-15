<script setup lang="ts">
/**
 * 顶部导航栏：左侧显示单双排位/灵活排位段位板块，右侧刷新图标
 * 段位图标未定级时使用灰色问号占位
 */
import type { RankSection } from './types'

defineProps<{ sections: RankSection[] }>()

// 刷新按钮事件（由父组件处理，当前仅占位）
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <nav class="top-nav">
    <!-- 左侧：段位板块列表 -->
    <div class="rank-sections">
      <div v-for="section in sections" :key="section.queue" class="rank-section">
        <!-- 段位图标：未定级灰色占位 -->
        <div class="rank-icon">
          <svg viewBox="0 0 24 24" class="rank-icon-svg" aria-hidden="true">
            <path d="M12 2 15 8l6 .5-4.5 4L18 19l-6-3.5L6 19l1.5-6.5L3 8.5 9 8z" />
          </svg>
        </div>
        <div class="rank-info">
          <p class="rank-queue">{{ section.queue }}</p>
          <p class="rank-tier">{{ section.tier }}</p>
          <p class="rank-highest">{{ section.highestTier }}</p>
        </div>
      </div>
    </div>

    <!-- 右侧：刷新按钮 -->
    <button type="button" class="refresh-btn" title="刷新" @click="emit('refresh')">
      <svg viewBox="0 0 24 24" class="refresh-icon" aria-hidden="true">
        <path
          d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"
        />
      </svg>
    </button>
  </nav>
</template>

<style lang="scss" scoped>
/* 顶部导航：深色底 + 左右分栏 */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

/* 段位板块：图标 + 文字竖排 */
.rank-sections {
  display: flex;
  gap: 28px;
}

.rank-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 段位图标：圆形灰底 + 未定级灰色 */
.rank-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-hover);
}

.rank-icon-svg {
  width: 26px;
  height: 26px;
  fill: var(--text-muted);
  opacity: 0.6;
}

.rank-info {
  display: flex;
  flex-direction: column;
}

.rank-queue {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.rank-tier {
  font-size: 12px;
  color: var(--text-muted);
}

.rank-highest {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.75;
}

/* 刷新按钮：hover 提亮 */
.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius);
  background: var(--surface-hover);
  transition: background-color 0.15s;

  &:hover {
    background: var(--surface-active);
  }
}

.refresh-icon {
  width: 18px;
  height: 18px;
  fill: var(--text);
}
</style>
