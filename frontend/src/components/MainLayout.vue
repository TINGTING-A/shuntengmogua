<template>
  <SidebarLayout v-model:sidebarVisible="layoutStore.sidebarVisible" :sidebarWidth="280" :showToggleButton="false"
    sidebarPosition="left" :z-index="20" class="flex-1">
    <template #sidebar>
      <GlobalSidebar />
    </template>
    <template #content>
      <div class="fixed -z-2 sidebar-transparent-bg w-10 h-10">
      </div>
      <div
        class="relative h-full flex-1 min-w-0 overflow-auto rounded-tl-xl border-l border-t border-gray-100 dark:border-[#2f2f2f] content-clear-wallpaper">
        <RouterView />
      </div>
    </template>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useLayoutStore } from '@/stores/layout'
import { apiService } from '@/services/ApiService'
import { useSpriteEvents } from '@/composables/useSpriteEvents'
import SidebarLayout from './ui/SidebarLayout.vue'
import GlobalSidebar from './GlobalSidebar.vue'

const layoutStore = useLayoutStore()
const { connect: connectSprite, disconnect: disconnectSprite } = useSpriteEvents()

onMounted(() => {
  console.log('[MainLayout] 启动 SSE 连接')
  apiService.connectSessionEvents()
  connectSprite()
  layoutStore.loadAppearanceSettings()
})

onUnmounted(() => {
  console.log('[MainLayout] 断开 SSE 连接')
  disconnectSprite()
  apiService.disconnectSessionEvents()
})
</script>

<style scoped>
/* 布局样式由 Tailwind 处理 */
</style>
