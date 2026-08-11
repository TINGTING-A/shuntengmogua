<template>
  <div class="sprite-enhance-page h-full overflow-y-auto">
    <div class="p-6 max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold mb-2 text-(--color-text)">精灵增强</h1>
      <p class="text-gray-500 dark:text-gray-400 mb-8">3D数字生命体 · 进化树 · 语音对话 · 表情控制</p>

      <div class="sprite-preview flex justify-center mb-8 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
        <SpriteCompanion :width="200" :height="200" :auto-rotate="true" />
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="进化树" name="evolution">
          <EvolutionTree />
        </el-tab-pane>
        <el-tab-pane label="语音对话" name="voice">
          <VoiceChat />
        </el-tab-pane>
        <el-tab-pane label="表情控制" name="expression">
          <ExpressionPanel />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SpriteCompanion from './SpriteCompanion.vue'
import EvolutionTree from './enhancements/EvolutionTree.vue'
import VoiceChat from './enhancements/VoiceChat.vue'
import ExpressionPanel from './enhancements/ExpressionPanel.vue'

const activeTab = ref('evolution')
</script>
