<template>
  <div class="personal-bus-page p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 text-(--color-text)">个人总线</h1>
    <p class="text-gray-500 dark:text-gray-400 mb-8">跨工具统一搜索 · CRDT实时同步 · 端到端加密</p>

    <el-tabs v-model="activeTab" class="bus-tabs">
      <el-tab-pane label="智能搜索" name="search">
        <SemanticSearch />
      </el-tab-pane>
      <el-tab-pane label="同步状态" name="sync">
        <SyncStatus />
      </el-tab-pane>
      <el-tab-pane label="安全加密" name="security">
        <EncryptionIndicator />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SemanticSearch from './SemanticSearch.vue'
import SyncStatus from './SyncStatus.vue'
import EncryptionIndicator from './EncryptionIndicator.vue'

const activeTab = ref('search')
</script>

<style scoped>
.bus-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}
</style>
