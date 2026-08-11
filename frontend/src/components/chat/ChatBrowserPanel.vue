<template>
  <transition name="browser-panel">
    <div v-if="visible" class="chat-browser-panel fixed right-0 top-0 bottom-0 z-40 flex flex-col bg-white dark:bg-[#1b1c1f] border-l border-gray-200 dark:border-[#2e3035] shadow-2xl"
      style="width: 760px; max-width: 92vw;">
      <!-- 标题栏 -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#2e3035] shrink-0">
        <el-icon class="text-[#fb7299]"><GlobalOutlined /></el-icon>
        <span class="text-sm font-medium truncate flex-1">网页预览</span>
        <el-button size="small" text @click="openExternal">
          <el-icon><ExportOutlined /></el-icon>
        </el-button>
        <el-button size="small" text @click="closePanel">
          <el-icon><CloseOutlined /></el-icon>
        </el-button>
      </div>

      <!-- 地址栏 -->
      <div class="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-[#2e3035] shrink-0">
        <el-input v-model="address" size="small" class="flex-1" clearable @keyup.enter="reload">
          <template #prefix><el-icon class="text-gray-400"><LinkOutlined /></el-icon></template>
        </el-input>
        <el-button size="small" :loading="loading" @click="reload">
          <el-icon><ReloadOutlined /></el-icon>
        </el-button>
      </div>

      <!-- 内容区：iframe 阅读 -->
      <div class="flex-1 min-h-0 relative">
        <div v-if="loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/70 dark:bg-black/50">
          <el-icon class="is-loading text-2xl text-[#fb7299]"><Loading3QuartersOutlined /></el-icon>
          <span class="text-xs text-gray-500">正在打开网页，渲染内容中...</span>
        </div>

        <!-- 文件模式：.pptx 等文件不嵌入 iframe，提供下载 -->
        <div v-if="isFileMode" class="h-full flex flex-col items-center justify-center gap-3 text-gray-400 p-6 text-center">
          <el-icon size="36"><FileTextOutlined /></el-icon>
          <div class="text-sm text-gray-600 dark:text-gray-300">这是一个文件（{{ fileExt }}），不支持在预览面板中显示</div>
          <el-button size="small" type="primary" plain @click="openExternal">下载 / 打开文件</el-button>
        </div>

        <iframe v-else-if="iframeUrl" :src="iframeUrl" class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          @load="onIframeLoad" @error="onIframeError"></iframe>

        <div v-if="iframeError && !isFileMode" class="h-full flex flex-col items-center justify-center gap-3 text-gray-400 p-6 text-center">
          <el-icon size="36"><WarningOutlined /></el-icon>
          <div class="text-sm">该网站拒绝在框架中显示（X-Frame-Options）</div>
          <div class="text-xs opacity-80">可点击右上角图标在新标签页打开</div>
          <el-button size="small" type="primary" plain @click="openExternal">新标签页打开</el-button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  CloseOutlined, ReloadOutlined, GlobalOutlined, LinkOutlined,
  Loading3QuartersOutlined, ExportOutlined, WarningOutlined, FileTextOutlined,
} from '@vicons/antd'

const props = defineProps<{
  visible: boolean
  url: string
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const address = ref('')
const loading = ref(false)
const iframeUrl = ref('')
const iframeError = ref(false)
let loadTimer: ReturnType<typeof setTimeout> | null = null

function clearLoadTimer() {
  if (loadTimer) {
    clearTimeout(loadTimer)
    loadTimer = null
  }
}

// 显示加载遮罩并设置兜底：外部资源（图片/脚本）慢或卡住时，
// load 事件可能长时间不触发，18 秒后强制隐藏遮罩，让用户看到已渲染内容
function startLoading() {
  loading.value = true
  clearLoadTimer()
  loadTimer = setTimeout(() => {
    loading.value = false
    loadTimer = null
  }, 18000)
}

watch(
  () => [props.visible, props.url] as const,
  ([vis, url]) => {
    if (vis && url) {
      const clean = normalizeUrl(url)
      address.value = clean
      // 文件链接（.pptx/.docx/.pdf 等）→ 显示下载提示，不嵌入 iframe
      if (isDownloadFileUrl(clean)) {
        iframeUrl.value = ''
        iframeError.value = false
        loading.value = false
        return
      }
      iframeUrl.value = proxyUrl(clean)
      iframeError.value = false
      startLoading()
    }
  },
  { immediate: true },
)

// 是否为文件下载链接（办公文档、压缩包、媒体文件或上传目录资源）。
// PDF/图片（png/jpg/gif/webp）走 iframe 原生渲染预览，不在此列
function isDownloadFileUrl(url: string): boolean {
  const lower = (url || '').split('?')[0].toLowerCase()
  if (lower.includes('/uploads/')) return true
  return /\.(pptx?|docx?|xlsx?|zip|rar|7z|svg|mp4|mp3|wav|txt)$/.test(lower)
}

const isFileMode = computed(() => {
  const u = (address.value || '').split('?')[0].toLowerCase()
  return isDownloadFileUrl(u)
})

const fileExt = computed(() => {
  const u = (address.value || '').split('?')[0]
  const m = u.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toUpperCase() : '文件'
})

function normalizeUrl(u: string): string {
  const t = (u || '').trim()
  if (!t) return ''
  if (!/^https?:\/\//i.test(t)) return 'https://' + t
  return t
}

// 走后端代理加载，绕过目标站的 X-Frame-Options 拒绝嵌入
function proxyUrl(u: string): string {
  return '/api/v1/browser-proxy?url=' + encodeURIComponent(u)
}

function onIframeLoad() {
  clearLoadTimer()
  loading.value = false
  iframeError.value = false
}

function onIframeError() {
  clearLoadTimer()
  loading.value = false
  iframeError.value = true
}

function reload() {
  const clean = normalizeUrl(address.value)
  if (!clean) return
  // 文件链接 → 显示下载提示，不嵌入 iframe
  if (isDownloadFileUrl(clean)) {
    loading.value = false
    iframeError.value = false
    iframeUrl.value = ''
    return
  }
  startLoading()
  iframeError.value = false
  // 通过重置 src 强制刷新
  iframeUrl.value = ''
  setTimeout(() => {
    iframeUrl.value = proxyUrl(clean)
  }, 50)
}

function openExternal() {
  const clean = normalizeUrl(address.value)
  if (clean) window.open(clean, '_blank', 'noopener,noreferrer')
}

function closePanel() {
  emit('update:visible', false)
}

onUnmounted(() => {
  clearLoadTimer()
  // 无后端会话资源需要清理（纯 iframe 模式）
})
</script>

<style scoped>
.chat-browser-panel {
  animation: panelSlideIn 0.25s ease;
}
@keyframes panelSlideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
</style>
