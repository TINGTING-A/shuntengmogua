<template>
  <div class="trend-chart">
    <h3 class="text-sm font-semibold mb-4 text-(--color-text)">7天趋势</h3>
    <div class="chart-area h-40 flex items-end gap-2 px-2">
      <div v-for="(day, idx) in trendData" :key="idx" class="flex-1 flex flex-col items-center">
        <div
          class="w-full rounded-t transition-all duration-500"
          :class="barColor(day.score)"
          :style="{ height: `${Math.max(4, (day.score / 100) * 100)}%` }"
        />
        <span class="text-xs text-gray-400 mt-1 whitespace-nowrap">{{ day.date.slice(5) }}</span>
      </div>
    </div>
    <div v-if="trendData.length === 0" class="text-center py-8 text-gray-400 text-sm">
      暂无趋势数据
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  trendData: Array<{ date: string; score: number }>
}>()

function barColor(score: number) {
  if (score >= 80) return 'bg-red-400'
  if (score >= 60) return 'bg-orange-400'
  if (score >= 40) return 'bg-yellow-400'
  return 'bg-green-400'
}
</script>
