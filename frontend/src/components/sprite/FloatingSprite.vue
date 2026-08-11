<template>
  <Teleport to="body">
    <Transition name="sprite-float">
      <div
        v-if="visible"
        class="sprite-float-btn"
        :class="{ 'sprite-expanded': expanded }"
        @click="toggleExpanded"
      >
        <div class="sprite-mini">
          <SpriteCompanion :width="80" :height="80" :auto-rotate="false" />
        </div>
        <Transition name="bubble-pop">
          <div v-if="expanded && spriteStore.message" class="sprite-speech-bubble">
            {{ spriteStore.message }}
          </div>
        </Transition>
        <Transition name="bubble-pop">
          <div v-if="expanded" class="sprite-info-panel">
            <div class="info-row">
              <span class="info-label">形态</span>
              <span class="info-value">{{ formLabel }}</span>
            </div>
            <div class="info-row" v-if="spriteStore.taskProgress > 0">
              <span class="info-label">任务进度</span>
              <span class="info-value">{{ spriteStore.taskProgress }}%</span>
            </div>
            <div class="info-row" v-if="spriteStore.stressScore > 0">
              <span class="info-label">压力指数</span>
              <span class="info-value" :class="stressColor">{{ spriteStore.stressScore }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSpriteStore } from '@/stores/sprite'
import SpriteCompanion from './SpriteCompanion.vue'

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: true,
})

const spriteStore = useSpriteStore()
const expanded = ref(false)

const formLabel = computed(() => {
  const labels: Record<string, string> = {
    egg: '🥚 蛋形态',
    bird: '🐦 鸟形态',
    fox: '🦊 狐形态',
    dragon: '🐉 龙形态',
  }
  return labels[spriteStore.form] || spriteStore.form
})

const stressColor = computed(() => {
  if (spriteStore.stressScore >= 80) return 'text-red-500'
  if (spriteStore.stressScore >= 60) return 'text-orange-500'
  if (spriteStore.stressScore >= 40) return 'text-yellow-500'
  return 'text-green-500'
})

function toggleExpanded() {
  expanded.value = !expanded.value
}
</script>

<style scoped>
.sprite-float-btn {
  position: fixed;
  top: 65%;
  right: 40px;
  transform: translateY(-50%);
  width: 80px;
  height: 80px;
  z-index: 9999;
  cursor: pointer;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.sprite-float-btn:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.4));
}

.sprite-expanded {
  width: auto;
  height: auto;
}

.sprite-mini {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle, rgba(116, 198, 157, 0.15), rgba(10, 30, 20, 0.5));
  border: 2px solid rgba(116, 198, 157, 0.4);
}

.sprite-speech-bubble {
  position: absolute;
  top: 50%;
  right: 90px;
  transform: translateY(-50%);
  max-width: 240px;
  padding: 10px 16px;
  background: rgba(20, 35, 45, 0.9);
  border: 1px solid rgba(116, 198, 157, 0.3);
  border-radius: 16px;
  font-size: 13px;
  color: #e0f0e0;
  backdrop-filter: blur(10px);
  white-space: normal;
}

.sprite-info-panel {
  position: absolute;
  top: 50%;
  right: 90px;
  transform: translateY(-50%);
  min-width: 160px;
  padding: 12px 16px;
  background: rgba(20, 35, 45, 0.9);
  border: 1px solid rgba(116, 198, 157, 0.3);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  gap: 12px;
}

.info-label {
  font-size: 12px;
  color: #6b9080;
}

.info-value {
  font-size: 12px;
  color: #c0d8c8;
  font-weight: 600;
}

.sprite-float-enter-active,
.sprite-float-leave-active {
  transition: all 0.4s ease;
}

.sprite-float-enter-from,
.sprite-float-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}

.bubble-pop-enter-active {
  transition: all 0.3s ease;
}

.bubble-pop-leave-active {
  transition: all 0.2s ease;
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
