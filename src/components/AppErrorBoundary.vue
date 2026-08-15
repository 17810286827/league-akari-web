<script setup lang="ts">
// 错误边界组件：捕获渲染期错误并降级显示，避免白屏
// 使用场景：包裹路由出口或页面级组件，作为渲染的最后兜底
import { createLogger } from '@/utils/logger'
import { onErrorCaptured, ref } from 'vue'

// 日志标签：便于在 DevTools 中按来源过滤错误日志
const logger = createLogger('ErrorBoundary')
// 标记是否发生渲染错误：为 true 时切换到降级 UI
// 错误发生后仍可点击“重试”按钮恢复，无需刷新页面
const hasError = ref(false)

// 捕获后代组件渲染 / 生命周期钩子中抛出的错误
// 记录日志后切换到降级 UI，并阻止错误继续向上传播
onErrorCaptured((error, instance, info) => {
  logger.error('Render error captured', error, info, instance)
  hasError.value = true
  return false // 阻止继续向上传播，避免白屏
})
</script>

<!-- 出错时显示降级提示与重试按钮，正常时渲染默认插槽内容 -->
<template>
  <div v-if="hasError" class="error-fallback">
    <h3>页面渲染出错</h3>
    <p>请查看浏览器控制台日志，或刷新重试。</p>
    <button @click="hasError = false">重试</button>
  </div>
  <slot v-else />
</template>
