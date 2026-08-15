<script setup lang="ts">
// 占位视图：对局详情页由任务 4 实现
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="placeholder">
    <h2>对局详情（待实现）</h2>
    <p>MatchDetailView 占位组件，当前路由参数 gameId：{{ route.params.gameId }}。</p>
  </div>
</template>
