<script setup lang="ts">
// 应用根组件：配置 Naive UI 全局主题与消息上下文，并用错误边界包裹路由出口
// 根组件不承载业务逻辑，仅负责应用级配置的组装
import { NConfigProvider, NMessageProvider } from 'naive-ui'

// 错误边界：捕获子组件渲染错误，避免白屏（详见组件内部实现）
import AppErrorBoundary from '@/components/AppErrorBoundary.vue'
</script>

<!-- 布局层级：主题提供者 > 消息提示提供者 > 错误边界 > 路由出口 -->
<template>
  <n-config-provider>
    <!-- 提供全局消息 API（n-message），供各页面调用 -->
    <n-message-provider>
      <AppErrorBoundary>
        <router-view />
      </AppErrorBoundary>
    </n-message-provider>
  </n-config-provider>
</template>
