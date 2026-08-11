import { onMounted, onUnmounted } from 'vue'
import { useSpriteStore } from '@/stores/sprite'
import { apiService } from '@/services/ApiService'
import type { SpriteMood, StressLevel } from '@/stores/sprite'

interface SpriteStatePayload {
  mood?: SpriteMood
  stressLevel?: StressLevel
  stressScore?: number
  taskProgress?: number
  taskDescription?: string
  message?: string | null
  isSpeaking?: boolean
  form?: string
}

export function useSpriteEvents() {
  const spriteStore = useSpriteStore()
  let unsubscribers: (() => void)[] = []

  function onSpriteState(event: any) {
    const payload = event.payload as SpriteStatePayload
    if (!payload) return

    if (payload.mood) spriteStore.mood = payload.mood
    if (payload.stressLevel) spriteStore.stressLevel = payload.stressLevel
    if (payload.stressScore !== undefined) spriteStore.stressScore = payload.stressScore
    if (payload.taskProgress !== undefined) spriteStore.taskProgress = payload.taskProgress
    if (payload.taskDescription !== undefined) spriteStore.taskDescription = payload.taskDescription
    if (payload.isSpeaking !== undefined) spriteStore.isSpeaking = payload.isSpeaking
    if (payload.form) spriteStore.form = payload.form

    if (payload.message) {
      spriteStore.speak(payload.message, 5000)
    } else if (payload.message === null) {
      spriteStore.stopSpeaking()
    }
  }

  function connect() {
    const unsub1 = apiService.onSessionEvent('sprite_state', onSpriteState)
    unsubscribers.push(unsub1)
  }

  function disconnect() {
    unsubscribers.forEach(fn => fn())
    unsubscribers = []
  }

  return { connect, disconnect, onSpriteState }
}
