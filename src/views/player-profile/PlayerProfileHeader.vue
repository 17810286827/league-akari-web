<script setup lang="ts">
/**
 * 玩家信息头部：英雄皮肤 Banner + 渐变遮罩 + 头像/等级 + ID/段位 + 社交/Update 按钮
 */
import { computed } from 'vue'

import { bannerSkinUrl, profileIconUrl } from './mockData'
import type { PlayerProfile } from './types'

// 页面数据源（props 注入，便于后续替换为接口数据）
const props = defineProps<{ profile: PlayerProfile }>()

/** Banner 背景图（英雄皮肤） */
const bannerStyle = computed(() => ({
  backgroundImage: `url(${bannerSkinUrl(props.profile.bannerSkinId, 1)})`
}))

/** 头像 CDN 地址 */
const avatarUrl = computed(() => profileIconUrl(props.profile.profileIconId))
</script>

<template>
  <!-- Banner 区域：皮肤大图 + 底部渐变遮罩，内容叠放其上 -->
  <header class="relative h-72 w-full overflow-hidden bg-surface">
    <div class="absolute inset-0 bg-cover bg-center" :style="bannerStyle" />
    <!-- 渐变遮罩：底部向背景色过渡，保证文字可读 -->
    <div class="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />

    <!-- 玩家信息主体 -->
    <div class="relative z-10 flex h-full items-end gap-6 px-10 pb-8">
      <!-- 头像 + 等级 -->
      <div class="relative shrink-0">
        <img
          :src="avatarUrl"
          alt="玩家头像"
          class="size-28 rounded-full border-4 border-surface bg-surface object-cover shadow-lg"
        />
        <!-- 等级角标：金色圆底数字 -->
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2.5 py-0.5 text-sm font-bold text-base tabular-nums"
        >
          {{ profile.level }}
        </span>
      </div>

      <!-- 中间信息：ID + 地区 / 段位 / 社交 -->
      <div class="flex flex-1 flex-col gap-2">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-bold text-ink">
            {{ profile.gameName }}<span class="text-ink-muted"> #{{ profile.tagLine }}</span>
          </h1>
          <!-- 地区标签 -->
          <span class="rounded-md bg-surface px-2 py-0.5 text-sm font-semibold text-ink-muted">
            {{ profile.region }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-lg text-ink-muted">
          <span class="font-semibold text-gold">{{ profile.ranked.tier }}</span>
          <span class="tabular-nums">{{ profile.ranked.lp }} LP</span>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <!-- 社交链接（Discord 占位图标） -->
          <a
            v-for="social in profile.socials"
            :key="social.type"
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-hover"
            :title="social.label"
          >
            <!-- Discord 风格图标（SVG 占位） -->
            <svg viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true">
              <path
                d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.4.8a17.3 17.3 0 0 0-7 0L8.1 3a19.8 19.8 0 0 0-4.4 1.4C1.2 8.3.4 12.1.8 15.9A20 20 0 0 0 6.6 18.7l1-1.6c-.8-.3-1.6-.7-2.3-1.2l.6-.4a14 14 0 0 0 12.2 0l.6.4c-.7.5-1.5.9-2.3 1.2l1 1.6a20 20 0 0 0 5.8-2.8c.5-4.4-.8-8.2-2.9-11.5zM8.7 13.7c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8z"
              />
            </svg>
            <span class="hidden sm:inline">{{ social.label }}</span>
          </a>
          <!-- Update 按钮：触发资料刷新 -->
          <button
            type="button"
            class="rounded-md bg-win px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            Update
          </button>
        </div>
      </div>

      <!-- 右侧：装饰性留白 -->
      <div class="hidden w-48 shrink-0 md:block" aria-hidden="true" />
    </div>
  </header>
</template>
