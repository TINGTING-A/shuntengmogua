<template>
  <div class="flex items-center justify-center h-full min-h-125 py-10 px-5">
    <div class="max-w-180 w-full text-center p-10 rounded-2xl animate-fade-in-up">
      <div class="relative inline-block mb-8">
        <div
          class="w-72 h-72 flex items-center justify-center mx-auto relative animate-bounce-in">
          <SpriteCompanion :width="280" :height="280" :auto-rotate="true" />
        </div>
      </div>

      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-4 text-(--color-primary)">
          {{ session?.character.title || '顺藤摸瓜' }}
        </h1>
        <h2 class="text-lg font-normal text-gray-600 dark:text-gray-400 leading-relaxed">
          {{ session?.character.description || '你好，我是你的AI智能办公伙伴' }}
        </h2>
      </div>

      <div v-if="spriteStore.message" class="sprite-bubble animate-bubble-in">
        {{ spriteStore.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SpriteCompanion from '../sprite/SpriteCompanion.vue'
import { useSpriteStore } from '@/stores/sprite'

defineProps<{
  session: any
}>()

const spriteStore = useSpriteStore()
</script>

<style scoped>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes bubbleIn {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.animate-fade-in-up { animation: fadeInUp 0.8s ease-out; }
.animate-bounce-in { animation: bounceIn 1s ease-out; }
.animate-bubble-in { animation: bubbleIn 0.4s ease-out; }

.sprite-bubble {
  display: inline-block;
  max-width: 320px;
  padding: 10px 20px;
  background: linear-gradient(135deg, rgba(116, 198, 157, 0.15), rgba(64, 145, 108, 0.1));
  border: 1px solid rgba(116, 198, 157, 0.3);
  border-radius: 20px;
  font-size: 14px;
  color: var(--color-text);
  backdrop-filter: blur(10px);
}
</style>
