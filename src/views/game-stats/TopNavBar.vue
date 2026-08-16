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
/* 顶部导航：近黑底 + 签名霓虹渐变光带（电竞终端）；
   三栏 grid：左空位 / 段位板块水平居中 / 右侧刷新按钮 */
.top-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  /* 签名元素：底部 2px 紫→玫红渐变光带，页面唯一的渐变装饰 */
  box-shadow:
    inset 0 -2px 0 0 linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.65), rgba(244, 63, 94, 0.4), transparent),
    0 1px 12px rgba(124, 58, 237, 0.08);
}

/* 段位板块：第二轨道（auto）→ 页面水平居中 */
.rank-sections {
  display: flex;
  gap: 28px;
  grid-column: 2;
}

.rank-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 段位图标：紫调环形（conic 渐变描边），未定级灰色星形 */
.rank-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-hover);
  box-shadow:
    inset 0 0 0 1px var(--border),
    0 0 12px rgba(124, 58, 237, 0.25);
}

.rank-icon-svg {
  width: 26px;
  height: 26px;
  fill: var(--primary-2);
  opacity: 0.85;
}

.rank-info {
  display: flex;
  flex-direction: column;
}

.rank-queue {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}

.rank-tier {
  font-size: 16px;
  color: var(--text-muted);
}

.rank-highest {
  font-size: 15px;
  color: var(--text-muted);
  opacity: 0.85;
}

/* 刷新按钮：第三轨道（1fr）右对齐 + hover 紫调提亮 */
.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius);
  background: var(--surface-hover);
  border: 1px solid var(--border);
  grid-column: 3;
  justify-self: end;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: var(--surface-active);
    border-color: var(--border-strong);
  }
}

.refresh-icon {
  width: 18px;
  height: 18px;
  fill: var(--text);
}
</style>
