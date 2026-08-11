<template>
  <div class="dimension-chart">
    <h3 class="text-sm font-semibold mb-4 text-(--color-text)">维度评分</h3>
    <div v-for="dim in dimensions" :key="dim.key" class="dim-row mb-3">
      <div class="flex justify-between text-xs mb-1">
        <span class="text-gray-500">{{ dim.label }}</span>
        <span class="text-gray-400">权重 {{ (dim.weight * 100).toFixed(0) }}%</span>
      </div>
      <div class="h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
        <div
          class="h-full rounded-full transition-all duration-700"
          :class="barColor(dim.score)"
          :style="{ width: `${dim.score}%` }"
        />
        <span class="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-white drop-shadow">
          {{ dim.score }}
        </span>
      </div>
      <p class="text-xs text-gray-400 mt-0.5">{{ dim.detail }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  dimensions: Array<{ key: string; label: string; score: number; weight: number; detail: string }>
}>()

function barColor(score: number) {
  if (score >= 80) return 'bg-red-500'
  if (score >= 60) return 'bg-orange-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-green-500'
}
</script>
