<!--
  符文分隔线：中间符文（✦）+ 两侧渐隐金线，海克斯魔典的版式签名元素，
  用于页面首尾与区块分隔。
-->
<template>
  <div class="flex items-center gap-3" aria-hidden="true">
    <span class="rune-line rune-line--left" />
    <span class="text-hex-gold/80">✦</span>
    <span class="rune-line rune-line--right" />
  </div>
</template>

<style scoped>
/* 两侧渐隐线：向中间符文聚拢的金色渐变 */
.rune-line {
  height: 1px;
  flex: 1;
}
.rune-line--left {
  background: linear-gradient(90deg, transparent, rgba(200, 170, 110, 0.5));
}
.rune-line--right {
  background: linear-gradient(90deg, rgba(200, 170, 110, 0.5), transparent);
}
</style>
