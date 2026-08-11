<template>
  <div class="connector-market p-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-(--color-text)">连接器市场</h1>
        <p class="text-sm text-gray-500 mt-1">统一管理顺藤摸瓜的所有外部连接器 — 配置后即可跨工具智能调度</p>
      </div>
      <el-tag size="large" :type="configuredCount > 0 ? 'success' : 'warning'">
        {{ configuredCount }}/{{ connectors.length }} 已配置
      </el-tag>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <div v-for="c in connectors" :key="c.id"
        class="connector-card p-5 rounded-xl border border-green-300/70 bg-white/35 dark:bg-gray-900/40 backdrop-blur-md transition-all cursor-pointer hover:shadow-md"
        @click="openDetail(c)">
        <div class="flex items-center justify-between mb-3">
          <span class="text-2xl">{{ c.icon }}</span>
          <el-tag :type="c.categoryTag" size="small">{{ c.category }}</el-tag>
        </div>
        <h3 class="font-semibold text-(--color-text) mb-1">{{ c.name }}</h3>
        <p class="text-xs text-gray-500 mb-3 line-clamp-2">{{ c.description }}</p>
        <div class="flex flex-wrap gap-1 mb-3">
          <el-tag v-for="cap in c.capabilities.slice(0, 3)" :key="cap" size="small" type="info" effect="plain">{{ cap }}</el-tag>
          <el-tag v-if="c.capabilities.length > 3" size="small" type="info" effect="plain">+{{ c.capabilities.length - 3 }}</el-tag>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span :class="c.configured ? 'text-green-600' : 'text-orange-500'">
            {{ c.configured ? '● 已配置' : '○ 待配置' }}
          </span>
          <span class="text-gray-400">v{{ c.version }}</span>
        </div>
      </div>
    </div>

    <el-dialog v-model="showDetail" :title="selectedConnector?.name" width="560px" destroy-on-close>
      <template v-if="selectedConnector">
        <div class="mb-4 text-sm text-gray-600 dark:text-gray-300">{{ selectedConnector.description }}</div>
        <el-alert :title="selectedConnector.configured ? '连接器已就绪' : selectedConnector.configHint" :type="selectedConnector.configured ? 'success' : 'warning'" show-icon class="mb-4" />
        <div class="mb-4">
          <h4 class="text-sm font-semibold mb-2 text-(--color-text)">能力列表</h4>
          <ul class="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li v-for="cap in selectedConnector.capabilities" :key="cap">{{ cap }}</li>
          </ul>
        </div>
        <div>
          <h4 class="text-sm font-semibold mb-2 text-(--color-text)">操作</h4>
          <div class="flex gap-2">
            <el-button size="small" @click="executeAgent(selectedConnector.id)">
              🔧 测试连接
            </el-button>
            <el-button size="small" type="primary" @click="goToAgent(selectedConnector.id)">
              📋 Agent 详情
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showDetail = ref(false)
const selectedConnector = ref<any>(null)

interface Connector {
  id: string
  name: string
  icon: string
  description: string
  category: string
  categoryTag: 'success' | 'warning' | 'info' | 'danger' | ''
  capabilities: string[]
  version: string
  configured: boolean
  configHint: string
}

const connectors = ref<Connector[]>([
  { id: 'wechat-agent', name: '微信连接器', icon: '💬', description: '微信数据管理：聊天记录提取、收藏整理、文件导出。通过 iLink Bot HTTP API 接入个人微信号。', category: '通讯', categoryTag: 'success', capabilities: ['聊天记录提取', '收藏整理', '文件导出', '消息搜索', '链接收集'], version: '1.0.0', configured: false, configHint: '需要微信扫码授权 — 前往 Bot 管理中心启动微信个人号连接' },
  { id: 'notion-agent', name: 'Notion 连接器', icon: '📝', description: 'Notion 知识管理：页面创建/读取/更新、数据库查询/写入、工作区内容搜索。', category: '知识', categoryTag: 'info', capabilities: ['页面读取', '页面写入', '数据库查询', '内容搜索'], version: '1.0.0', configured: false, configHint: '需要 NOTION_API_KEY — 前往 https://www.notion.so/my-integrations 创建' },
  { id: 'email-agent', name: '邮箱连接器', icon: '📧', description: '邮件智能管理：支持 Gmail/Outlook/QQ邮箱 IMAP，邮件搜索、附件提取、自动归档。', category: '通讯', categoryTag: 'success', capabilities: ['邮件搜索', '附件管理', '自动归档', '收件箱列表'], version: '1.0.0', configured: false, configHint: '需要配置 EMAIL_IMAP_HOST / EMAIL_USER / EMAIL_PASS 环境变量' },
  { id: 'browser-agent', name: '浏览器连接器', icon: '🌐', description: '网页自动化：Browser Use 云端引擎（87.4%准确率）+ 自有 Chromium 引擎（隐私操作）。', category: '采集', categoryTag: 'danger', capabilities: ['网页自动化', '内容提取', '表单填写', '竞品数据采集'], version: '1.0.0', configured: false, configHint: '需要 BROWSER_USE_API_KEY — 或在 Electron 桌面端使用内置 Chromium' },
  { id: 'file-agent', name: '文件系统连接器', icon: '📁', description: '本地文件系统管理：深度搜索、智能分类、实时监听文件变化。', category: '系统', categoryTag: '', capabilities: ['文件深度搜索', '智能分类', '实时监听', '文件读写'], version: '1.0.0', configured: true, configHint: '无需配置，自动连接本地文件系统' },
  { id: 'search-agent', name: '语义搜索连接器', icon: '🔍', description: '跨工具统一搜索：BGE-M3 向量嵌入 + sqlite-vec + BM25 混合检索，自然语言秒级定位。', category: '知识', categoryTag: 'info', capabilities: ['自然语言搜索', '向量语义匹配', 'BM25 关键词', '混合打分'], version: '1.0.0', configured: true, configHint: '需要 EMBEDDING_API_BASE 指向 Ollama/BGE-M3 服务' },
  { id: 'knowledge-graph-agent', name: '知识图谱连接器', icon: '🕸️', description: 'GraphRAG 知识建模：实体提取、关系识别、图谱检索。解决传统 RAG "没有关系概念"的致命问题。', category: '知识', categoryTag: 'info', capabilities: ['实体提取', '关系建模', '图谱检索', '路径查找'], version: '1.0.0', configured: true, configHint: '默认使用内存图谱 — 连接 Neo4j/Kuzu 以获得持久化能力' },
  { id: 'sync-agent', name: '同步引擎连接器', icon: '🔄', description: 'CRDT 数据同步：Yjs 实时同步 + E2EE 端到端加密 + 离线编辑自动合并。', category: '同步', categoryTag: '', capabilities: ['CRDT 实时同步', '端到端加密', '离线编辑', '冲突自动解决'], version: '1.0.0', configured: true, configHint: 'E2EE 加密已就绪 — libsodium XChaCha20-Poly1305' },
])

const configuredCount = computed(() => connectors.value.filter(c => c.configured).length)

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/agents', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    const data = await res.json()
    if (data.agents) {
      for (const c of connectors.value) {
        const agent = data.agents.find((a: any) => a.id === c.id)
        if (agent) {
          c.configured = c.configured || agent.status === 'active' || agent.status === 'ready'
        }
      }
    }
  } catch { /* use default statuses */ }
})

function openDetail(c: Connector) {
  selectedConnector.value = c
  showDetail.value = true
}

function executeAgent(agentId: string) {
  router.push({ name: 'AgentManagement', query: { focus: agentId } })
}

function goToAgent(agentId: string) {
  router.push({ name: 'AgentManagement', query: { focus: agentId } })
}
</script>
