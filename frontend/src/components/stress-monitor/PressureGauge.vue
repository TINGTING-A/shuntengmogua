<template>
  <div class="pressure-gauge flex flex-col items-center">
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r="80" fill="none" stroke="#e5e7eb" stroke-width="12" />
      <circle
        cx="90" cy="90" r="80"
        fill="none"
        :stroke="gaugeColor"
        stroke-width="12"
        stroke-linecap="round"
        :stroke-dasharray="`${(score / 100) * 502} 502`"
        transform="rotate(-90 90 90)"
        class="gauge-arc"
      />
      <text x="90" y="85" text-anchor="middle" class="text-3xl font-bold" :fill="gaugeColor">
        {{ score }}
      </text>
      <text x="90" y="110" text-anchor="middle" class="text-sm" fill="#9ca3af">
        / 100
      </text>
    </svg>
    <div class="level-badge mt-3 px-4 py-1 rounded-full text-sm font-semibold" :class="levelClass">
      {{ levelLabel }}
    </div>
    <p class="text-xs text-gray-400 mt-2 text-center max-w-48">{{ recommendation }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  score: number
  level: string
  recommendation?: string
}>()

const gaugeColor = computed(() => {
  if (props.score >= 80) return '#ef4444'
  if (props.score >= 60) return '#f97316'
  if (props.score >= 40) return '#eab308'
  return '#22c55e'
})

const levelLabel = computed(() => {
  const labels: Record<string, string> = { normal: '正常', mild: '轻度', moderate: '中度', severe: '重度' }
  return labels[props.level] || props.level
})

const levelClass = computed(() => {
  const classes: Record<string, string> = {
    normal: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    mild: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return classes[props.level] || classes.normal
})
</script>
