<template>
  <div class="evolution-tree p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-2 text-(--color-text)">精灵进化</h1>
    <p class="text-gray-500 dark:text-gray-400 mb-6">使用深度: {{ usageDepth.toFixed(0) }}% · 精灵形态随使用增长自动进化</p>

    <div class="model-generation mb-8 p-4 rounded-xl border border-dashed border-purple-300 dark:border-purple-700">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-semibold text-(--color-text)">AI 3D模型生成 (Meshy API)</span>
        <el-tag size="small" type="warning">{{ apiConfigured ? 'MESHY_API_KEY 已配置' : '演示模式' }}</el-tag>
      </div>
      <div class="flex gap-3">
        <el-input v-model="modelPrompt" placeholder="描述你想要的精灵形态..." size="small" class="flex-1" />
        <el-button type="primary" size="small" :loading="generating" @click="generateModel">
          🎨 生成模型
        </el-button>
      </div>
      <div v-if="modelResult" class="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm">
        <span class="text-green-600">生成成功:</span> {{ modelResult }}
      </div>
    </div>

    <div class="evolution-path flex items-center justify-center gap-4 mb-10 flex-wrap">
      <div v-for="(stage, idx) in stages" :key="stage.form" class="flex items-center gap-4">
        <div class="stage-node flex flex-col items-center p-4 rounded-xl border-2 transition-all min-w-24"
          :class="currentStageIdx >= idx ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'">
          <span class="text-4xl mb-2">{{ stage.icon }}</span>
          <span class="text-sm font-semibold text-(--color-text)">{{ stage.label }}</span>
          <span class="text-xs text-gray-400">{{ stage.threshold }}%</span>
          <el-tag v-if="currentStageIdx === idx" size="small" type="success" class="mt-1">当前</el-tag>
        </div>
        <div v-if="idx < stages.length - 1" class="arrow text-gray-400 text-2xl">→</div>
      </div>
    </div>

    <div class="progress-container mb-6">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>蛋</span><span>鸟</span><span>狐</span><span>龙</span>
      </div>
      <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-yellow-300 via-green-400 to-purple-500 rounded-full transition-all duration-700"
          :style="{ width: `${Math.min(100, usageDepth)}%` }" />
      </div>
    </div>

    <div class="current-form p-5 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
      <p class="text-sm text-gray-500">当前形态</p>
      <p class="text-xl font-bold text-(--color-text) mt-1">{{ currentStage.label }} {{ currentStage.icon }}</p>
      <p class="text-xs text-gray-400 mt-1">互动次数: {{ interactionCount }} · 距下一形态还差 {{ Math.max(0, nextThreshold - usageDepth).toFixed(0) }} 使用深度</p>
    </div>

    <div class="model-tips mt-8 p-4 text-sm text-gray-500 dark:text-gray-400">
      <p>💡 提示：</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>在下方输入框中用中文描述你想要的精灵形态</li>
        <li>配置 MESHY_API_KEY 环境变量启用 AI 3D 模型生成</li>
        <li>生成的 glTF 模型会自动加载到 Three.js 精灵视图中</li>
        <li>蛋 → 鸟 → 狐 → 龙 四阶段模型均可独立生成</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSpriteStore } from '@/stores/sprite'

const spriteStore = useSpriteStore()

const stages = [
  { form: 'egg', label: '蛋形态', icon: '🥚', threshold: 0 },
  { form: 'bird', label: '鸟形态', icon: '🐦', threshold: 30 },
  { form: 'fox', label: '狐形态', icon: '🦊', threshold: 60 },
  { form: 'dragon', label: '龙形态', icon: '🐉', threshold: 100 },
]

const usageDepth = computed(() => Math.min(100, spriteStore.useDepth))
const interactionCount = computed(() => spriteStore.interactionCount)
const currentStageIdx = computed(() => {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (usageDepth.value >= stages[i].threshold) return i
  }
  return 0
})
const currentStage = computed(() => stages[currentStageIdx.value])
const nextThreshold = computed(() => {
  const next = stages[currentStageIdx.value + 1]
  return next ? next.threshold : 100
})

const modelPrompt = ref('')
const generating = ref(false)
const modelResult = ref('')
const apiConfigured = ref(false)

async function checkApiStatus() {
  try {
    const res = await fetch('/api/v1/sprite/generate-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ prompt: '_status_check_' }),
    })
    const data = await res.json()
    apiConfigured.value = data.error !== 'MESHY_API_KEY not configured'
  } catch { apiConfigured.value = false }
}

checkApiStatus()

async function generateModel() {
  if (!modelPrompt.value.trim()) return
  generating.value = true
  modelResult.value = ''
  try {
    const res = await fetch('/api/v1/sprite/generate-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ prompt: `${currentStage.value.label} - ${modelPrompt.value}` }),
    })
    const data = await res.json()
    if (data.success) {
      modelResult.value = `模型ID: ${data.taskId} · 状态: ${data.status} · 预计${data.estimatedTime || '3-5分钟'}`
      apiConfigured.value = true
    } else {
      const isDemo = data.error === 'MESHY_API_KEY not configured'
      modelResult.value = isDemo
        ? `演示模式: 提示词"${modelPrompt.value}"已记录 — 配置MESHY_API_KEY后启用AI生成`
        : `生成失败: ${data.message || data.error}`
    }
  } catch {
    modelResult.value = `网络错误: 无法连接到3D模型服务`
  } finally {
    generating.value = false
  }
}
</script>

