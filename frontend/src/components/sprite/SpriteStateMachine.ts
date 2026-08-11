export type AnimationState =
  | 'idle'
  | 'idle_blink'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'speaking'
  | 'evolving'
  | 'stressed'

export interface AnimationConfig {
  blendShapes: Record<string, number>
  bodyBounce: { amplitude: number; frequency: number }
  headTilt: { angle: number; speed: number }
  earWiggle: boolean
  eyeScale: { x: number; y: number }
  duration?: number
}

export const ANIMATION_CONFIGS: Record<AnimationState, AnimationConfig> = {
  idle: {
    blendShapes: { smile: 0.3, frown: 0, surprise: 0, eyeClose: 0 },
    bodyBounce: { amplitude: 0.2, frequency: 1.8 },
    headTilt: { angle: 0.06, speed: 1.0 },
    earWiggle: false,
    eyeScale: { x: 1.15, y: 0.92 },
  },
  idle_blink: {
    blendShapes: { smile: 0, frown: 0, surprise: 0, eyeClose: 1 },
    bodyBounce: { amplitude: 0.1, frequency: 1.5 },
    headTilt: { angle: 0.03, speed: 0.8 },
    earWiggle: false,
    eyeScale: { x: 1, y: 1 },
    duration: 150,
  },
  happy: {
    blendShapes: { smile: 1, frown: 0, surprise: 0.3, eyeClose: 0 },
    bodyBounce: { amplitude: 0.4, frequency: 3 },
    headTilt: { angle: 0.15, speed: 2 },
    earWiggle: true,
    eyeScale: { x: 1, y: 0.85 },
  },
  sad: {
    blendShapes: { smile: 0, frown: 1, surprise: 0, eyeClose: 0 },
    bodyBounce: { amplitude: 0.05, frequency: 0.8 },
    headTilt: { angle: -0.1, speed: 0.5 },
    earWiggle: false,
    eyeScale: { x: 1, y: 1 },
  },
  surprised: {
    blendShapes: { smile: 0, frown: 0, surprise: 1, eyeClose: 0 },
    bodyBounce: { amplitude: 0.5, frequency: 4 },
    headTilt: { angle: 0.1, speed: 3 },
    earWiggle: true,
    eyeScale: { x: 1.3, y: 1.3 },
  },
  thinking: {
    blendShapes: { smile: 0, frown: 0, surprise: 0, eyeClose: 0 },
    bodyBounce: { amplitude: 0.1, frequency: 1 },
    headTilt: { angle: 0.2, speed: 1.2 },
    earWiggle: false,
    eyeScale: { x: 0.9, y: 1 },
  },
  speaking: {
    blendShapes: { smile: 0.3, frown: 0, surprise: 0, eyeClose: 0 },
    bodyBounce: { amplitude: 0.2, frequency: 2 },
    headTilt: { angle: 0.1, speed: 1.5 },
    earWiggle: false,
    eyeScale: { x: 1, y: 1 },
  },
  evolving: {
    blendShapes: { smile: 0, frown: 0, surprise: 0.5, eyeClose: 0.5 },
    bodyBounce: { amplitude: 0.3, frequency: 2.5 },
    headTilt: { angle: 0.15, speed: 2 },
    earWiggle: true,
    eyeScale: { x: 1, y: 1 },
  },
  stressed: {
    blendShapes: { smile: 0, frown: 0.8, surprise: 0, eyeClose: 0 },
    bodyBounce: { amplitude: 0.08, frequency: 0.6 },
    headTilt: { angle: -0.08, speed: 0.4 },
    earWiggle: false,
    eyeScale: { x: 0.85, y: 0.85 },
  },
}

export function mapMoodToAnimation(mood: string, isSpeaking: boolean, needsAttention: boolean): AnimationState {
  if (isSpeaking) return 'speaking'
  if (needsAttention) return 'stressed'
  switch (mood) {
    case 'happy': return 'happy'
    case 'sad': return 'sad'
    case 'surprised': return 'surprised'
    case 'thinking': return 'thinking'
    case 'evolving': return 'evolving'
    default: return 'idle'
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpConfig(from: AnimationConfig, to: AnimationConfig, t: number): AnimationConfig {
  const allKeys = new Set([...Object.keys(from.blendShapes), ...Object.keys(to.blendShapes)])
  const blendShapes: Record<string, number> = {}
  allKeys.forEach((key) => {
    blendShapes[key] = lerp(from.blendShapes[key] || 0, to.blendShapes[key] || 0, t)
  })
  return {
    blendShapes,
    bodyBounce: {
      amplitude: lerp(from.bodyBounce.amplitude, to.bodyBounce.amplitude, t),
      frequency: lerp(from.bodyBounce.frequency, to.bodyBounce.frequency, t),
    },
    headTilt: {
      angle: lerp(from.headTilt.angle, to.headTilt.angle, t),
      speed: lerp(from.headTilt.speed, to.headTilt.speed, t),
    },
    earWiggle: t > 0.5 ? to.earWiggle : from.earWiggle,
    eyeScale: {
      x: lerp(from.eyeScale.x, to.eyeScale.x, t),
      y: lerp(from.eyeScale.y, to.eyeScale.y, t),
    },
  }
}
