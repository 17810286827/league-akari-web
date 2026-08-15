<script setup lang="ts">
// 应用根组件：配置 Naive UI 全局主题与消息上下文，并用错误边界包裹路由出口
import { NConfigProvider, NMessageProvider } from 'naive-ui'

import AppErrorBoundary from '@/components/AppErrorBoundary.vue'
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <AppErrorBoundary>
        <router-view />
      </AppErrorBoundary>
    </n-message-provider>
  </n-config-provider>
</template>
