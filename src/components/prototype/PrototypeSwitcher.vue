<!--
  【原型】五方案悬浮切换条（仅 dev 构建渲染，生产构建整条不输出）：
  - 底部居中胶囊，与被评审页面用高对比的品红色区分，明确"这不是设计本体"；
  - 左右箭头循环 ?variant=A~E，键盘 ←/→ 同步（输入框聚焦时不拦截）；
  - note 插槽用于展示评审上下文（如"示例数据 / 真实数据"）。
  评审完成后随整个 prototype 目录一起删除。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'

import { PROTOTYPE_VARIANTS } from './variants'

const props = defineProps<{
  /** 当前方案 key（A~E） */
  current: string
  /** 右侧附加说明（如数据来源标注） */
  note?: string
}>()

const router = useRouter()

/** 仅开发构建显示：静态替换为 false，生产包模板分支被折叠 */
const isDev = import.meta.env.DEV

/** 当前方案的元信息（切换条标签展示 key + 名称） */
const meta = computed(() => PROTOTYPE_VARIANTS.find((v) => v.key === props.current))

/** 循环切换到上一/下一方案并写入 URL（replace 不污染历史，可分享、刷新稳定） */
function cycle(delta: number): void {
  const index = PROTOTYPE_VARIANTS.findIndex((v) => v.key === props.current)
  const next =
    PROTOTYPE_VARIANTS[(index + delta + PROTOTYPE_VARIANTS.length) % PROTOTYPE_VARIANTS.length]
  router.replace({ query: { ...router.currentRoute.value.query, variant: next.key } })
}

/** 键盘 ←/→ 切换方案；输入类元素聚焦时不拦截，避免打字冲突 */
function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return
  }
  if (event.key === 'ArrowLeft') {
    cycle(-1)
  } else if (event.key === 'ArrowRight') {
    cycle(1)
  }
}

onMounted(() => {
  if (isDev) {
    window.addEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => {
  if (isDev) {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <div v-if="isDev" class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
    <div
      class="flex items-center gap-1 rounded-full border border-fuchsia-400/70 bg-fuchsia-950/90 py-1.5 pl-2 pr-3 shadow-xl shadow-black/50 backdrop-blur"
    >
      <!-- 上一方案 -->
      <button
        class="rounded-full p-1.5 text-fuchsia-200 hover:bg-fuchsia-500/30"
        data-testid="prototype-prev"
        aria-label="上一方案"
        @click="cycle(-1)"
      >
        <ChevronBackOutline :width="16" :height="16" />
      </button>
      <!-- 当前方案标签 -->
      <span class="min-w-32 text-center text-xs font-semibold tracking-wider text-fuchsia-100" data-testid="prototype-label">
        {{ meta?.key }} · {{ meta?.name }}
      </span>
      <!-- 下一方案 -->
      <button
        class="rounded-full p-1.5 text-fuchsia-200 hover:bg-fuchsia-500/30"
        data-testid="prototype-next"
        aria-label="下一方案"
        @click="cycle(1)"
      >
        <ChevronForwardOutline :width="16" :height="16" />
      </button>
      <!-- 评审上下文标注（数据来源等） -->
      <span
        v-if="note"
        class="ml-1 border-l border-fuchsia-400/40 pl-2 text-[11px] tracking-wider text-fuchsia-300/80"
      >
        {{ note }}
      </span>
    </div>
  </div>
</template>
