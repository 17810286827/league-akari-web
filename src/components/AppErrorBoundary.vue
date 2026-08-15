<script setup lang="ts">
import { createLogger } from '@/utils/logger'
import { onErrorCaptured, ref } from 'vue'

const logger = createLogger('ErrorBoundary')
const hasError = ref(false)

onErrorCaptured((error, instance, info) => {
  logger.error('Render error captured', error, info, instance)
  hasError.value = true
  return false // 阻止继续向上传播，避免白屏
})
</script>

<template>
  <div v-if="hasError" class="error-fallback">
    <h3>页面渲染出错</h3>
    <p>请查看浏览器控制台日志，或刷新重试。</p>
    <button @click="hasError = false">重试</button>
  </div>
  <slot v-else />
</template>
