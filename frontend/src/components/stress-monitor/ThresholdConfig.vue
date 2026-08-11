<template>
  <div class="threshold-config">
    <h3 class="text-sm font-semibold mb-4 text-(--color-text)">预警阈值</h3>
    <div class="space-y-4">
      <div v-for="t in thresholds" :key="t.key" class="threshold-row">
        <div class="flex justify-between text-xs mb-1">
          <span :class="t.color">{{ t.label }}</span>
          <span class="text-gray-400">{{ modelValue[t.key] }}</span>
        </div>
        <el-slider
          :model-value="modelValue[t.key]"
          :min="t.min"
          :max="t.max"
          :step="5"
          @update:model-value="(v: number) => updateThreshold(t.key, v)"
        />
      </div>
    </div>
    <el-button size="small" type="primary" class="mt-4" @click="$emit('save')">
      保存阈值
    </el-button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: { mild: number; moderate: number; severe: number }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: { mild: number; moderate: number; severe: number }]
  save: []
}>()

const thresholds = [
  { key: 'mild', label: '轻度预警', color: 'text-yellow-500', min: 20, max: 60 },
  { key: 'moderate', label: '中度预警', color: 'text-orange-500', min: 40, max: 80 },
  { key: 'severe', label: '重度预警', color: 'text-red-500', min: 60, max: 100 },
]

function updateThreshold(key: string, value: number) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>
