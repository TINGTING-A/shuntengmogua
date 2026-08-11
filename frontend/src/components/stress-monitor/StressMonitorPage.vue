<template>
  <div class="stress-monitor-page p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-2 text-(--color-text)">压力监测</h1>
    <p class="text-gray-500 dark:text-gray-400 mb-8">工作健康守护 · 本地AI分析 · 数据绝不出设备</p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="p-6 rounded-xl border border-gray-100 dark:border-gray-700 unified-card flex flex-col items-center">
        <PressureGauge
          :score="scoreData.total"
          :level="scoreData.level"
          :recommendation="scoreData.recommendation"
        />
      </div>

      <div class="lg:col-span-2 p-6 rounded-xl border border-gray-100 dark:border-gray-700 unified-card">
        <DimensionChart :dimensions="dimensions" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="p-6 rounded-xl border border-gray-100 dark:border-gray-700 unified-card">
        <TrendChart :trend-data="trendData" />
      </div>
      <div class="p-6 rounded-xl border border-gray-100 dark:border-gray-700 unified-card">
        <ThresholdConfig v-model="thresholds" @save="saveThresholds" />
      </div>
    </div>

    <div class="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-400 text-center">
      所有数据本地处理，API调用不涉及原始数据 · 联邦学习可选(Phase 2) · 用户可随时关闭监测
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PressureGauge from './PressureGauge.vue'
import DimensionChart from './DimensionChart.vue'
import TrendChart from './TrendChart.vue'
import ThresholdConfig from './ThresholdConfig.vue'

const scoreData = ref({
  total: 0,
  level: 'normal' as string,
  recommendation: '暂无数据',
  dimensions: {} as Record<string, any>,
})

const thresholds = ref({ mild: 40, moderate: 60, severe: 80 })
const trendData = ref<Array<{ date: string; score: number }>>([])

const dimensions = computed(() => {
  const dims = scoreData.value.dimensions
  return [
    { key: 'replySpeed', label: '回复速度', score: dims.replySpeed?.score || 0, weight: dims.replySpeed?.weight || 0.3, detail: dims.replySpeed?.detail || '' },
    { key: 'overtimeHours', label: '加班时长', score: dims.overtimeHours?.score || 0, weight: dims.overtimeHours?.weight || 0.25, detail: dims.overtimeHours?.detail || '' },
    { key: 'meetingDensity', label: '会议密度', score: dims.meetingDensity?.score || 0, weight: dims.meetingDensity?.weight || 0.25, detail: dims.meetingDensity?.detail || '' },
    { key: 'documentEdits', label: '文档修改', score: dims.documentEdits?.score || 0, weight: dims.documentEdits?.weight || 0.2, detail: dims.documentEdits?.detail || '' },
  ]
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  try {
    const res = await fetch('/api/v1/agents/stress-agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ task: '评分' }),
    })
    const data = await res.json()
    if (data.success) {
      scoreData.value = {
        total: data.result?.total || 0,
        level: data.result?.level || 'normal',
        recommendation: data.result?.recommendation || '',
        dimensions: data.result?.dimensions || {},
      }
    }
  } catch {
    scoreData.value = {
      total: 35,
      level: 'normal',
      recommendation: '今天状态不错，保持节奏！(演示数据)',
      dimensions: {
        replySpeed: { score: 30, weight: 0.3, detail: '平均回复: 45秒' },
        overtimeHours: { score: 25, weight: 0.25, detail: '在线8.5h, 加班0.5h' },
        meetingDensity: { score: 40, weight: 0.25, detail: '会议3.2h' },
        documentEdits: { score: 20, weight: 0.2, detail: '文档修改8次' },
      },
    }
  }
}

async function saveThresholds() {
  try {
    await fetch('/api/v1/agents/stress-agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        task: `阈值 ${thresholds.value.mild} ${thresholds.value.moderate} ${thresholds.value.severe}`,
      }),
    })
  } catch { /* */ }
}
</script>
