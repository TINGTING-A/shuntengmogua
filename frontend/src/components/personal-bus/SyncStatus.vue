<template>
  <div class="sync-status">
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="stat-card p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
        <div class="text-3xl font-bold text-green-500">{{ docCount }}</div>
        <div class="text-sm text-gray-500 mt-1">同步文档</div>
      </div>
      <div class="stat-card p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
        <div class="text-3xl font-bold text-blue-500">{{ syncStatus }}</div>
        <div class="text-sm text-gray-500 mt-1">同步状态</div>
      </div>
      <div class="stat-card p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
        <div class="text-3xl font-bold text-purple-500">{{ conflictCount }}</div>
        <div class="text-sm text-gray-500 mt-1">冲突数</div>
      </div>
    </div>

    <div class="sync-info p-4 rounded-xl bg-gray-50 dark:bg-gray-800 mb-4">
      <h3 class="font-semibold mb-2 text-(--color-text)">CRDT 同步引擎</h3>
      <div class="text-sm text-gray-500 space-y-1">
        <p>技术: Yjs CRDT (Notion/Linear 生产验证)</p>
        <p>同步方式: 增量更新 (仅传输差异)</p>
        <p>冲突解决: CRDT 数学保证自动合并</p>
        <p>离线支持: 编辑后联网自动同步</p>
      </div>
    </div>

    <div v-if="documents.length > 0" class="doc-list">
      <h3 class="font-semibold mb-3 text-(--color-text)">同步中的文档</h3>
      <div
        v-for="doc in documents"
        :key="doc"
        class="doc-item flex items-center justify-between p-3 rounded-lg mb-2 border border-gray-100 dark:border-gray-700"
      >
        <span class="text-sm">{{ doc }}</span>
        <el-tag size="small" type="success">已同步</el-tag>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-400">
      <p>暂无同步文档，发送消息后自动创建</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const docCount = ref(0)
const syncStatus = ref('就绪')
const conflictCount = ref(0)
const documents = ref<string[]>([])

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/agents/sync-agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ task: '状态' }),
    })
    const data = await res.json()
    docCount.value = data.result?.docCount || 0
    documents.value = data.result?.documents || []
  } catch {
    docCount.value = 0
  }
})
</script>
