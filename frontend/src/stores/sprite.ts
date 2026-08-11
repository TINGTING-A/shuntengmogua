import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type SpriteForm = 'egg' | 'bird' | 'fox' | 'dragon'
export type SpriteMood = 'idle' | 'happy' | 'sad' | 'surprised' | 'thinking' | 'evolving'
export type StressLevel = 'normal' | 'mild' | 'moderate' | 'severe'

export interface SpriteState {
  mood: SpriteMood
  form: SpriteForm
  stressLevel: StressLevel
  stressScore: number
  taskProgress: number
  taskDescription: string
  message: string | null
  isSpeaking: boolean
  evolutionProgress: number
  useDepth: number
  interactionCount: number
}

export const useSpriteStore = defineStore('sprite', () => {
  const mood = ref<SpriteMood>('idle')
  const form = ref<SpriteForm>('egg')
  const stressLevel = ref<StressLevel>('normal')
  const stressScore = ref<number>(0)
  const taskProgress = ref<number>(0)
  const taskDescription = ref<string>('')
  const message = ref<string | null>(null)
  const isSpeaking = ref(false)
  const evolutionProgress = ref(0)
  const useDepth = ref(0)
  const interactionCount = ref(0)

  const isEvolving = computed(() => mood.value === 'evolving')
  const needsAttention = computed(() => stressLevel.value === 'moderate' || stressLevel.value === 'severe')

  function setMood(newMood: SpriteMood) {
    mood.value = newMood
  }

  function setForm(newForm: SpriteForm) {
    form.value = newForm
  }

  function setStress(score: number) {
    stressScore.value = Math.max(0, Math.min(100, score))
    if (score >= 80) stressLevel.value = 'severe'
    else if (score >= 60) stressLevel.value = 'moderate'
    else if (score >= 40) stressLevel.value = 'mild'
    else stressLevel.value = 'normal'
  }

  function setTaskProgress(progress: number, description?: string) {
    taskProgress.value = Math.max(0, Math.min(100, progress))
    if (description !== undefined) taskDescription.value = description
  }

  function speak(text: string, duration?: number) {
    message.value = text
    isSpeaking.value = true
    if (duration && duration > 0) {
      setTimeout(() => {
        isSpeaking.value = false
      }, duration)
    }
  }

  function stopSpeaking() {
    isSpeaking.value = false
  }

  function celebrate() {
    mood.value = 'happy'
    setTimeout(() => {
      if (mood.value === 'happy') mood.value = 'idle'
    }, 5000)
  }

  function startEvolution(targetForm: SpriteForm) {
    mood.value = 'evolving'
    evolutionProgress.value = 0
    const interval = setInterval(() => {
      evolutionProgress.value += 5
      if (evolutionProgress.value >= 100) {
        clearInterval(interval)
        form.value = targetForm
        mood.value = 'happy'
        setTimeout(() => { mood.value = 'idle' }, 3000)
      }
    }, 100)
  }

  function addInteraction() {
    interactionCount.value++
    useDepth.value += 0.1
    if (useDepth.value >= 100 && form.value === 'egg') startEvolution('bird')
    else if (useDepth.value >= 250 && form.value === 'bird') startEvolution('fox')
    else if (useDepth.value >= 500 && form.value === 'fox') startEvolution('dragon')
  }

  function reset() {
    mood.value = 'idle'
    form.value = 'egg'
    stressLevel.value = 'normal'
    stressScore.value = 0
    taskProgress.value = 0
    taskDescription.value = ''
    message.value = null
    isSpeaking.value = false
    evolutionProgress.value = 0
    useDepth.value = 0
    interactionCount.value = 0
  }

  return {
    mood,
    form,
    stressLevel,
    stressScore,
    taskProgress,
    taskDescription,
    message,
    isSpeaking,
    evolutionProgress,
    useDepth,
    interactionCount,
    isEvolving,
    needsAttention,
    setMood,
    setForm,
    setStress,
    setTaskProgress,
    speak,
    stopSpeaking,
    celebrate,
    startEvolution,
    addInteraction,
    reset,
  }
})
