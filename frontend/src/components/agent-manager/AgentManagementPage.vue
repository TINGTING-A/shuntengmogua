<template>
  <div class="agent-manager-page p-6">
    <div class="sessions-header py-1 text-lg font-semibold flex justify-between items-center mb-2">
      <span>Agent</span>
    </div>
    <p class="text-gray-500 dark:text-gray-400 mb-6">{{ agents.length }} 个子智能体 · MAF StateGraph 编排</p>

    <div class="flex gap-2 mb-6 flex-wrap">
      <el-tag
        v-for="cat in categories"
        :key="cat.name"
        :type="selectedCat === cat.name ? 'primary' : 'info'"
        class="cursor-pointer"
        @click="selectedCat = selectedCat === cat.name ? '' : cat.name"
      >
        {{ cat.label }} ({{ cat.count }})
      </el-tag>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="agent in filteredAgents"
        :key="agent.id"
        class="agent-card p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-green-400 transition-colors cursor-pointer"
        :data-agent-id="agent.id"
        @click="selectedAgent = selectedAgent?.id === agent.id ? null : agent"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">{{ categoryIcon(agent.category) }}</span>
          <div>
            <h3 class="font-semibold text-(--color-text)">{{ agent.name }}</h3>
            <p class="text-xs text-gray-400">{{ agent.id }}</p>
          </div>
        </div>
        <p class="text-sm text-gray-500 mb-3 line-clamp-2">{{ agent.description }}</p>
        <div class="flex flex-wrap gap-1">
          <el-tag v-for="cap in agent.capabilities" :key="cap" size="small" type="success">{{ cap }}</el-tag>
        </div>
        <div class="mt-3 text-xs text-gray-400">
          Tools: {{ (agent.tools || []).join(', ') || '无' }}
        </div>

        <div v-if="selectedAgent?.id === agent.id" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <el-input
            v-model="execTask"
            size="small"
            placeholder="输入任务..."
            @keyup.enter="executeAgent(agent.id)"
          />
          <div class="flex gap-2 mt-2">
            <el-button size="small" type="primary" :loading="executing" @click="executeAgent(agent.id)">
              执行
            </el-button>
            <el-button size="small" @click="executeByIntent">
              意图路由
            </el-button>
          </div>
          <div v-if="execResult" class="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs font-mono whitespace-pre-wrap">
            {{ execResult }}
          </div>
        </div>
      </div>
    </div>

    <!-- 子智能体推荐 -->
    <div class="mt-8">
      <div class="sessions-header py-1 text-lg font-semibold flex items-center gap-3 mb-4">
        <span>子智能体推荐</span>
        <el-button link size="small" @click="recommendAgents">
          <template #icon>
            <el-icon>
              <Refresh />
            </el-icon>
          </template>
          换一批
        </el-button>
      </div>

      <div v-if="recommendedAgents.length === 0" class="rounded-lg border border-gray-200 dark:border-[#232428] bg-white dark:bg-[#232428] p-6 text-center unified-card">
        <el-icon size="32" class="mb-2 opacity-50 text-gray-400">
          <AlertCircle />
        </el-icon>
        <div class="text-sm text-gray-500 dark:text-[#8b8d95]">
          暂无推荐子智能体
        </div>
      </div>

      <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));">
        <div v-for="agent in recommendedAgents" :key="agent.id"
          class="agent-card rounded-lg border border-gray-200 dark:border-[#232428] overflow-hidden bg-white dark:bg-[#232428] transition-all hover:border-(--color-primary) unified-card">
          <div class="p-5 pb-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">{{ categoryIcon(agent.category) }}</span>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-[#e8e9ed] flex-1 truncate">
                  {{ agent.name }}
                </h3>
              </div>
              <el-tag size="small" type="success">{{ agent.id }}</el-tag>
            </div>

            <p class="text-sm text-gray-600 dark:text-[#8b8d95] mb-3 line-clamp-3 min-h-[3.75rem]">
              {{ agent.description || '暂无描述' }}
            </p>

            <div class="flex items-center justify-between">
              <div class="flex flex-wrap gap-1.5">
                <el-tag v-for="cap in (agent.capabilities || []).slice(0, 3)" :key="cap" size="small" effect="light">
                  {{ cap }}
                </el-tag>
              </div>
              <el-button size="small" type="primary" plain @click="selectRecommendedAgent(agent)">
                使用
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh, AlertCircle } from '@vicons/ionicons5'

const route = useRoute()

interface AgentItem {
  id: string; name: string; description: string; category: string; capabilities: string[]; tools: string[]; version: string
}

const agents = ref<AgentItem[]>([])
const selectedCat = ref('')
const selectedAgent = ref<AgentItem | null>(null)
const execTask = ref('')
const executing = ref(false)
const execResult = ref('')
const recommendedAgents = ref<AgentItem[]>([])

// 随机推荐子智能体（每次 6 个）
function recommendAgents() {
  const pool = [...agents.value]
  // Fisher-Yates 洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  recommendedAgents.value = pool.slice(0, 6)
}

// 使用推荐子智能体：选中并滚动到对应卡片
function selectRecommendedAgent(agent: AgentItem) {
  selectedAgent.value = agent
  selectedCat.value = agent.category
  setTimeout(() => {
    const el = document.querySelector(`[data-agent-id="${agent.id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 200)
}

const categoryMap: Record<string, string> = {
  planner: '🧠', connector: '🔌', knowledge: '📚', interaction: '💬', health: '❤️', sync: '🔄',
}

function categoryIcon(cat: string) { return categoryMap[cat] || '🤖' }

// 兼容"记住我"关闭时 token 存于 sessionStorage 的情况（与 auth store 策略一致）
const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')

const categories = computed(() => {
  const map = new Map<string, number>()
  for (const a of agents.value) map.set(a.category, (map.get(a.category) || 0) + 1)
  const labels: Record<string, string> = { planner: '编排', connector: '连接器', knowledge: '知识', interaction: '交互', health: '健康', sync: '同步' }
  return Array.from(map.entries()).map(([name, count]) => ({ name, label: labels[name] || name, count }))
})

const filteredAgents = computed(() =>
  selectedCat.value ? agents.value.filter(a => a.category === selectedCat.value) : agents.value
)

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/agents', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json()
    agents.value = data.agents || []
    recommendAgents()

    const focusId = route.query.focus as string
    if (focusId) {
      const target = agents.value.find((a: AgentItem) => a.id === focusId)
      if (target) {
        selectedAgent.value = target
        selectedCat.value = target.category
        setTimeout(() => {
          const el = document.querySelector(`[data-agent-id="${focusId}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    }
  } catch { /* */ }
})

async function executeAgent(id: string) {
  if (!execTask.value.trim()) return
  executing.value = true
  try {
    const res = await fetch(`/api/v1/agents/${id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ task: execTask.value }),
    })
    const data = await res.json()
    execResult.value = JSON.stringify(data, null, 2)
  } catch (e: any) {
    execResult.value = `Error: ${e.message}`
  } finally {
    executing.value = false
  }
}

async function executeByIntent() {
  if (!execTask.value.trim()) return
  executing.value = true
  try {
    const res = await fetch('/api/v1/agents/execute-by-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ task: execTask.value }),
    })
    const data = await res.json()
    execResult.value = `匹配: ${data.matchedAgent} (score: ${data.matchScore})\n${JSON.stringify(data, null, 2)}`
  } catch (e: any) {
    execResult.value = `Error: ${e.message}`
  } finally {
    executing.value = false
  }
}
</script>

<style scoped>
/* 暗色模式：能力标签(success)绿色字体改为蓝色 */
html.dark .agent-card :deep(.el-tag--success) {
  --el-tag-text-color: #60a5fa;
  --el-tag-border-color: rgba(96, 165, 250, 0.6);
  --el-tag-bg-color: rgba(96, 165, 250, 0.12);
  --el-tag-hover-bg-color: rgba(96, 165, 250, 0.22);
}
</style>
