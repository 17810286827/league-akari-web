<script setup lang="ts">
// 占位视图：对局详情页由任务 4 实现
// 将展示单局详情，包括双方阵容、战绩与时间线等数据
import { useRoute } from 'vue-router'

// 读取当前路由：gameId 为对局唯一标识，详情页后续按它请求数据
const route = useRoute()
</script>

<!-- 占位内容：当前仅回显路由参数，任务 4 将整体替换 -->
<template>
  <div class="placeholder">
    <h2>对局详情（待实现）</h2>
    <p>MatchDetailView 占位组件，当前路由参数 gameId：{{ route.params.gameId }}。</p>
  </div>
</template>
