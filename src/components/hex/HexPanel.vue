<!--
  卡槽面板：双线金边框（border + outline 错位形成内外双线）+ 深蓝渐变底。
  gold 变体用于"名场面·战功簿"等鎏金强调区。
-->
<script setup lang="ts">
withDefaults(defineProps<{ /** 鎏金底色变体 */ gold?: boolean }>(), { gold: false })
</script>

<template>
  <div class="hex-panel" :class="gold ? 'hex-panel--gold' : ''">
    <slot />
  </div>
</template>

<style scoped>
/* 面板基础：双线金边 + 深蓝渐变（色值走 @theme 令牌） */
.hex-panel {
  border: 1px solid var(--color-hex-line);
  outline: 1px solid var(--color-hex-line);
  outline-offset: 3px;
  background: linear-gradient(180deg, var(--color-hex-blue-2) 0%, var(--color-hex-blue) 100%);
}

/* 鎏金变体：战功簿等强调区（琥珀暗底 + 亮金边） */
.hex-panel--gold {
  background: linear-gradient(180deg, #171208 0%, #12100a 100%);
  border-color: var(--color-hex-gold-3);
  outline-color: var(--color-hex-gold-3);
}
</style>
