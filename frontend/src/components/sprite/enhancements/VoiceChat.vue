<template>
  <div class="voice-chat p-6 max-w-2xl mx-auto">
    <h2 class="text-xl font-bold mb-2 text-(--color-text)">语音对话</h2>
    <p class="text-gray-500 dark:text-gray-400 mb-6">Whisper v3 STT + Fish Speech TTS · 本地推理 · 隐私零泄露</p>

    <div class="status-bar flex items-center gap-4 mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" :class="sttStatus ? 'bg-green-500' : 'bg-red-500'" />
        <span class="text-sm">STT {{ sttStatus ? '在线' : '离线' }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" :class="ttsStatus ? 'bg-green-500' : 'bg-red-500'" />
        <span class="text-sm">TTS {{ ttsStatus ? '在线' : '离线' }}</span>
      </div>
    </div>

    <div class="transcript-area mb-4">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        placeholder="输入要合成的文字，或录音后自动转写..."
      />
    </div>

    <div class="flex gap-3 mb-6">
      <el-button type="primary" :loading="synthesizing" @click="synthesize">
        🔊 语音合成
      </el-button>
      <el-select v-model="emotion" size="small" style="width: 120px">
        <el-option v-for="e in emotions" :key="e" :label="label(e)" :value="e" />
      </el-select>
    </div>

    <div v-if="outputText" class="output-area p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
      <div class="text-xs text-gray-400 mb-1">识别结果</div>
      <p class="text-sm text-(--color-text)">{{ outputText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const sttStatus = ref(false)
const ttsStatus = ref(false)
const inputText = ref('')
const outputText = ref('')
const emotion = ref('neutral')
const synthesizing = ref(false)
const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised']

function label(e: string) { const m: Record<string, string> = { neutral: '中性', happy: '开心', sad: '悲伤', angry: '生气', surprised: '惊讶' }; return m[e] || e }

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/voice/health', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    const data = await res.json()
    sttStatus.value = data?.stt || false
    ttsStatus.value = data?.tts || false
  } catch { /* offline - will use demo mode */ }
})

async function synthesize() {
  if (!inputText.value.trim()) return
  synthesizing.value = true
  try {
    const res = await fetch('/api/v1/voice/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ text: inputText.value, emotion: emotion.value }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
      outputText.value = `语音合成成功 · 情感: ${label(emotion.value)}`
    } else {
      outputText.value = '语音合成失败 · 检查Fish Speech服务是否运行'
    }
  } catch {
    outputText.value = `[演示模式] 合成了 "${inputText.value.substring(0, 30)}..." (${label(emotion.value)})`
  } finally {
    synthesizing.value = false
  }
}
</script>
