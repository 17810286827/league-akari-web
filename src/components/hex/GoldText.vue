<!--
  金渐变文字：海克斯标题/榜单数值的鎏金效果（上亮下暗的金色垂直渐变）。
  仅包裹行内元素，颜色透明由渐变填充——请勿在外层再设置 color。
-->
<template>
  <span class="gold-text"><slot /></span>
</template>

<style scoped>
/* 鎏金渐变：金亮端 → 主金 → 金暗端（令牌见 tailwind.css @theme） */
.gold-text {
  background: linear-gradient(
    180deg,
    var(--color-hex-gold-2) 0%,
    var(--color-hex-gold) 55%,
    var(--color-hex-gold-3) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
