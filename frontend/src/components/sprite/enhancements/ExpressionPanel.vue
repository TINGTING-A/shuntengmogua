<template>
  <div class="expression-panel p-6 max-w-2xl mx-auto">
    <h2 class="text-xl font-bold mb-2 text-(--color-text)">精灵表情控制</h2>
    <p class="text-gray-500 dark:text-gray-400 mb-6">Morph Target面部表情 · 5种动画状态 · 气泡消息</p>

    <div class="mb-6">
      <h3 class="text-sm font-semibold mb-3 text-(--color-text)">表情</h3>
      <div class="flex flex-wrap gap-2">
        <el-button
          v-for="m in moods"
          :key="m.key"
          :type="spriteStore.mood === m.key ? 'primary' : 'default'"
          size="small"
          @click="setMood(m.key)"
        >
          {{ m.icon }} {{ m.label }}
        </el-button>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-semibold mb-3 text-(--color-text)">气泡消息</h3>
      <div class="flex gap-2">
        <el-input v-model="message" size="small" placeholder="输入精灵要说的话..." @keyup.enter="sendMessage" />
        <el-button type="primary" size="small" @click="sendMessage">发送</el-button>
      </div>
    </div>

    <div class="state-info p-4 rounded-xl bg-gray-50 dark:bg-gray-800 grid grid-cols-2 gap-3 text-sm">
      <div><span class="text-gray-400">形态:</span> {{ formLabel }}</div>
      <div><span class="text-gray-400">表情:</span> {{ moodLabel }}</div>
      <div><span class="text-gray-400">压力:</span> {{ spriteStore.stressScore }}</div>
      <div><span class="text-gray-400">任务:</span> {{ spriteStore.taskProgress }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSpriteStore } from '@/stores/sprite'

const spriteStore = useSpriteStore()
const message = ref('')

const moods = [
  { key: 'idle', label: '待机', icon: '😐' },
  { key: 'happy', label: '开心', icon: '😊' },
  { key: 'sad', label: '沮丧', icon: '😢' },
  { key: 'surprised', label: '惊讶', icon: '😲' },
  { key: 'thinking', label: '思考', icon: '🤔' },
]

const moodLabel = computed(() => moods.find(m => m.key === spriteStore.mood)?.label || spriteStore.mood)
const formLabel = computed(() => {
  const m: Record<string, string> = { egg: '🥚 蛋', bird: '🐦 鸟', fox: '🦊 狐', dragon: '🐉 龙' }
  return m[spriteStore.form] || spriteStore.form
})

function setMood(mood: string) {
  spriteStore.mood = mood as any
}

function sendMessage() {
  if (!message.value.trim()) return
  spriteStore.speak(message.value, 5000)
  message.value = ''
}
</script>
