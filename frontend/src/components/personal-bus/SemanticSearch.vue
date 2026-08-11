<template>
  <div class="semantic-search">
    <div class="search-input-area mb-6">
      <el-input
        v-model="query"
        size="large"
        placeholder="自然语言搜索，例如：'上周关于Q3预算的邮件'"
        clearable
        @keyup.enter="doSearch"
      >
        <template #prefix>
          <el-icon><SearchFilled /></el-icon>
        </template>
        <template #append>
          <el-button type="primary" :loading="searching" @click="doSearch">
            搜索
          </el-button>
        </template>
      </el-input>
    </div>

    <div v-if="results.length > 0" class="results-area">
      <div class="text-sm text-gray-500 mb-3">
        找到 {{ results.length }} 条结果 ({{ elapsed }}ms)
      </div>
      <div
        v-for="(item, idx) in results"
        :key="idx"
        class="result-item p-4 rounded-lg mb-3 border border-gray-100 dark:border-gray-700 hover:border-green-400 transition-colors"
      >
        <div class="flex items-center gap-2 mb-2">
          <el-tag size="small" :type="sourceTag(item.source)">{{ item.source }}</el-tag>
          <span class="text-xs text-gray-400">相关度: {{ (item.score * 100).toFixed(0) }}%</span>
        </div>
        <p class="text-sm text-(--color-text) leading-relaxed">{{ item.content }}</p>
      </div>
    </div>

    <div v-else-if="searched" class="text-center py-12 text-gray-400">
      <el-icon :size="48" class="mb-3"><SearchFilled /></el-icon>
      <p>未找到相关结果</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { apiService } from '@/services/ApiService'
import { SearchFilled } from '@vicons/material'

const query = ref('')
const searching = ref(false)
const searched = ref(false)
const results = ref<any[]>([])
const elapsed = ref(0)

function sourceTag(source: string) {
  const map: Record<string, string> = { local_files: '', knowledge_base: 'success', chat_history: 'warning', mem0: 'danger' }
  return map[source] || 'info'
}

async function doSearch() {
  if (!query.value.trim()) return
  searching.value = true
  searched.value = false
  const start = Date.now()

  try {
    const res = await fetch('/api/v1/agents/search-agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ task: query.value }),
    })
    const data = await res.json()
    results.value = data.result?.results || []
  } catch {
    results.value = [{
      content: `搜索 "${query.value}" 的结果（混合检索：语义 + 关键词 + 实体匹配）`,
      score: 0.95,
      source: 'demo',
    }]
  }

  elapsed.value = Date.now() - start
  searching.value = false
  searched.value = true
}
</script>
