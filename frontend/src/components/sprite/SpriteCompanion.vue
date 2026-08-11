<template>
  <div ref="containerRef" class="sprite-container" :style="containerStyle"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { useSpriteStore } from '@/stores/sprite'
import { useTheme } from '@/composables/useTheme'
import {
  mapMoodToAnimation,
  lerpConfig,
  ANIMATION_CONFIGS,
} from './SpriteStateMachine'
import type { AnimationState, AnimationConfig } from './SpriteStateMachine'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  autoRotate?: boolean
}>(), {
  width: 280,
  height: 280,
  autoRotate: true,
})

const containerRef = ref<HTMLDivElement>()
const spriteStore = useSpriteStore()
const theme = useTheme()

const containerStyle = {
  width: `${props.width}px`,
  height: `${props.height}px`,
}

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let animationId: number
let clock: THREE.Timer

let eggGroup: THREE.Group
let body: THREE.Mesh
let leftEye: THREE.Group
let rightEye: THREE.Group
let leftPupil: THREE.Mesh
let rightPupil: THREE.Mesh
let mouth: THREE.Group
let mouthMesh: THREE.Mesh
let leftEar: THREE.Group
let rightEar: THREE.Group
let leftCheek: THREE.Mesh
let rightCheek: THREE.Mesh
let leftWing: THREE.Group
let rightWing: THREE.Group

// 材质引用（用于暗色模式海蓝配色切换）
let bodyMat: THREE.MeshStandardMaterial
let earMat: THREE.MeshStandardMaterial
let innerEarMat: THREE.MeshStandardMaterial
let wingMat: THREE.MeshStandardMaterial
let cheekMat: THREE.MeshStandardMaterial
let rightCheekMat: THREE.MeshStandardMaterial
let mouthMat: THREE.MeshStandardMaterial
let rimLight: THREE.DirectionalLight
let keyLight: THREE.DirectionalLight

/** 浅色/暗色主题下的精灵配色（暗色=壁纸9海蓝同色系，通透釉面质感） */
const THEME_COLORS = {
  light: {
    body: 0xfff5e6, ear: 0xffe8cc, innerEar: 0xf5c6aa, wing: 0xfff0d4,
    cheek: 0xf9b4ab, mouth: 0xd4786e,
  },
  dark: {
    body: 0x1e5a66, ear: 0x2a6a76, innerEar: 0x3d828e, wing: 0x143c44,
    cheek: 0x8a7a80, mouth: 0xc0847a,
  },
}

function applyThemeColors() {
  const dark = theme.isDark.value
  const c = dark ? THEME_COLORS.dark : THEME_COLORS.light
  if (bodyMat) {
    bodyMat.color.setHex(c.body)
    // 暗色：柔和釉面质感（适度金属度+微粗糙+微自发光），浅色：原磨砂质感
    bodyMat.metalness = dark ? 0.3 : 0.05
    bodyMat.roughness = dark ? 0.18 : 0.3
    bodyMat.emissive.setHex(dark ? 0x0a2a33 : 0x000000)
    bodyMat.emissiveIntensity = dark ? 0.18 : 0
  }
  if (earMat) earMat.color.setHex(c.ear)
  if (innerEarMat) innerEarMat.color.setHex(c.innerEar)
  if (wingMat) {
    wingMat.color.setHex(c.wing)
    wingMat.metalness = dark ? 0.25 : 0.05
    wingMat.roughness = dark ? 0.2 : 0.35
  }
  if (cheekMat) cheekMat.color.setHex(c.cheek)
  if (rightCheekMat) rightCheekMat.color.setHex(c.cheek)
  if (mouthMat) mouthMat.color.setHex(c.mouth)
  // 暗色：主光降强度+变冷青白，消除金属蛋上的白色过曝角
  if (keyLight) {
    keyLight.intensity = dark ? 1.6 : 2.5
    keyLight.color.setHex(dark ? 0xd8eef0 : 0xffffff)
  }
  // 暗色：增强青色轮廓光，让蛋从背景中透出高级层次感
  if (rimLight) rimLight.intensity = dark ? 2.4 : 1.2
}

// 主题切换时同步精灵颜色
watch(() => theme.isDark.value, () => applyThemeColors())

let currentConfig: AnimationConfig = ANIMATION_CONFIGS.idle
let targetConfig: AnimationConfig = ANIMATION_CONFIGS.idle
let transitionProgress = 1
let blinkTimer = 0
let isBlinking = false
let renderFrameCount = 0

function createMouthGeometry(smile: number): THREE.BufferGeometry {
  const w = 0.12
  const h = 0.03 + smile * 0.07
  const shape = new THREE.Shape()
  shape.moveTo(-w, 0)
  shape.quadraticCurveTo(0, -h, w, 0)
  shape.quadraticCurveTo(0, h * 0.3, -w, 0)
  return new THREE.ShapeGeometry(shape, 16)
}

let lastSmileBlend = -1

function updateMouth(smile: number) {
  if (Math.abs(smile - lastSmileBlend) < 0.01) return
  lastSmileBlend = smile
  mouthMesh.geometry.dispose()
  mouthMesh.geometry = createMouthGeometry(smile)
}

function createMouthGroup() {
  const group = new THREE.Group()
  mouthMat = new THREE.MeshStandardMaterial({ color: 0xd4786e, roughness: 0.4, side: THREE.DoubleSide })
  mouthMesh = new THREE.Mesh(createMouthGeometry(0.3), mouthMat)
  group.add(mouthMesh)
  group.position.set(0, -0.12, 0.95)
  return group
}

function createEggCharacter(): THREE.Group {
  const group = new THREE.Group()

  const bodyGeom = new THREE.SphereGeometry(1, 48, 48)
  bodyGeom.scale(1, 1.25, 0.85)
  bodyMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e6,
    roughness: 0.3,
    metalness: 0.05,
  })
  body = new THREE.Mesh(bodyGeom, bodyMat)
  body.castShadow = true
  body.renderOrder = 0
  group.add(body)

  const eyeWhiteGeom = new THREE.SphereGeometry(0.22, 32, 32)

  function createEye(px: number, py: number) {
    const eyeGroup = new THREE.Group()
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, depthTest: true, depthWrite: true })
    const white = new THREE.Mesh(eyeWhiteGeom, whiteMat)
    eyeGroup.add(white)

    const pupilGeom = new THREE.SphereGeometry(0.13, 16, 16)
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.1, depthTest: true, depthWrite: true })
    const pupil = new THREE.Mesh(pupilGeom, pupilMat)
    pupil.position.z = 0.12
    eyeGroup.add(pupil)

    const highlight1Geom = new THREE.SphereGeometry(0.05, 8, 8)
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
    const highlight1 = new THREE.Mesh(highlight1Geom, highlightMat)
    highlight1.position.set(0.06, 0.08, 0.18)
    eyeGroup.add(highlight1)

    const highlight2Geom = new THREE.SphereGeometry(0.025, 8, 8)
    const highlight2 = new THREE.Mesh(highlight2Geom, highlightMat)
    highlight2.position.set(-0.04, -0.02, 0.17)
    eyeGroup.add(highlight2)

    eyeGroup.position.set(px, py, 1.1)
    eyeGroup.renderOrder = 1
    return { group: eyeGroup, pupil }
  }

  const leftEyeObj = createEye(-0.28, 0.22)
  const rightEyeObj = createEye(0.28, 0.22)
  leftEye = leftEyeObj.group
  rightEye = rightEyeObj.group
  leftPupil = leftEyeObj.pupil
  rightPupil = rightEyeObj.pupil
  group.add(leftEye)
  group.add(rightEye)

  const mouthGroup = createMouthGroup()
  group.add(mouthGroup)
  mouth = mouthGroup

  function createEar(px: number) {
    const earGroup = new THREE.Group()
    const earGeom = new THREE.ConeGeometry(0.15, 0.35, 16, 8)
    // 左右耳朵共享同一材质（保证主题切换同步染色）
    if (!earMat) {
      earMat = new THREE.MeshStandardMaterial({
        color: 0xffe8cc,
        roughness: 0.4,
        metalness: 0.05,
      })
    }
    const ear = new THREE.Mesh(earGeom, earMat)
    ear.position.y = 0.12
    earGroup.add(ear)

    const innerEarGeom = new THREE.ConeGeometry(0.08, 0.22, 16, 8)
    if (!innerEarMat) {
      innerEarMat = new THREE.MeshStandardMaterial({
        color: 0xf5c6aa,
        roughness: 0.5,
      })
    }
    const innerEar = new THREE.Mesh(innerEarGeom, innerEarMat)
    innerEar.position.y = 0.1
    earGroup.add(innerEar)

    earGroup.position.set(px, 1.15, 0.1)
    earGroup.rotation.z = px > 0 ? 0.25 : -0.25
    earGroup.rotation.x = -0.15
    return earGroup
  }

  leftEar = createEar(-0.4)
  rightEar = createEar(0.4)
  group.add(leftEar)
  group.add(rightEar)

  const cheekGeom = new THREE.CircleGeometry(0.15, 24)
  cheekMat = new THREE.MeshStandardMaterial({
    color: 0xf9b4ab,
    roughness: 0.6,
    transparent: true,
    opacity: 0.25,
  })
  leftCheek = new THREE.Mesh(cheekGeom, cheekMat)
  leftCheek.position.set(-0.45, -0.15, 0.88)
  group.add(leftCheek)

  rightCheekMat = new THREE.MeshStandardMaterial({
    color: 0xf9b4ab,
    roughness: 0.6,
    transparent: true,
    opacity: 0.25,
  })
  rightCheek = new THREE.Mesh(cheekGeom.clone(), rightCheekMat)
  rightCheek.position.set(0.45, -0.15, 0.88)
  group.add(rightCheek)

  function createWing(px: number) {
    const wingGroup = new THREE.Group()
    const wingGeom = new THREE.SphereGeometry(0.22, 16, 8)
    wingGeom.scale(0.35, 0.5, 0.15)
    // 左右翅膀共享同一材质（保证主题切换同步染色）
    if (!wingMat) {
      wingMat = new THREE.MeshStandardMaterial({
        color: 0xfff0d4,
        roughness: 0.35,
        metalness: 0.05,
      })
    }
    const wing = new THREE.Mesh(wingGeom, wingMat)
    wingGroup.add(wing)
    wingGroup.position.set(px, 0.05, 0.3)
    wingGroup.rotation.z = px > 0 ? -0.5 : 0.5
    wingGroup.rotation.x = 0.6
    return wingGroup
  }

  leftWing = createWing(-0.85)
  rightWing = createWing(0.85)
  group.add(leftWing)
  group.add(rightWing)

  const crownGeom = new THREE.ConeGeometry(0.08, 0.2, 8, 8)
  const crown = new THREE.Mesh(crownGeom, new THREE.MeshStandardMaterial({
    color: 0xffd700,
    roughness: 0.2,
    metalness: 0.6,
  }))
  crown.position.y = 1.28
  crown.name = 'crown'
  group.add(crown)

  return group
}

function initScene() {
  if (!containerRef.value) return

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(props.width, props.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  containerRef.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(40, props.width / props.height, 0.1, 50)
  camera.position.set(0, 0.1, 5)
  camera.lookAt(0, 0.15, 0)

  const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.8)
  scene.add(ambientLight)

  keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
  keyLight.position.set(3, 5, 5)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(256, 256)
  keyLight.shadow.camera.near = 0.5
  keyLight.shadow.camera.far = 20
  scene.add(keyLight)

  rimLight = new THREE.DirectionalLight(0x74c69d, 1.2)
  rimLight.position.set(-3, 0, -2)
  scene.add(rimLight)

  const fillLight = new THREE.DirectionalLight(0xd4a574, 0.8)
  fillLight.position.set(0, -2, 1)
  scene.add(fillLight)

  eggGroup = createEggCharacter()
  scene.add(eggGroup)

  clock = new THREE.Timer()
  currentConfig = ANIMATION_CONFIGS.idle
  targetConfig = ANIMATION_CONFIGS.idle
  transitionProgress = 1

  applyThemeColors()

  animate()
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function animate() {
  animationId = requestAnimationFrame(animate)

  // 性能优化：页面不可见时跳过渲染（隐藏 tab / 窗口最小化时零 GPU 开销）
  if (typeof document !== 'undefined' && document.hidden) return

  const dt = Math.min(clock.update(), 0.1)
  const elapsed = clock.getElapsed()

  transitionProgress = Math.min(1, transitionProgress + dt * 3)
  const eased = easeInOutCubic(transitionProgress)
  const cfg = lerpConfig(currentConfig, targetConfig, eased)

  const blinkInterval = 3 + Math.random() * 2
  blinkTimer += dt
  if (blinkTimer > blinkInterval && !isBlinking && targetConfig === ANIMATION_CONFIGS.idle) {
    isBlinking = true
    setTimeout(() => { isBlinking = false }, 150)
    blinkTimer = 0
  }

  const bodyScale = 1 + Math.sin(elapsed * 2.5) * 0.06
  eggGroup.scale.setScalar(bodyScale)
  eggGroup.position.y = Math.sin(elapsed * 2.5) * 0.25

  eggGroup.rotation.z = Math.sin(elapsed * 1.8) * 0.2
  eggGroup.rotation.y = Math.sin(elapsed * 1.5) * 0.35

  const smileBlend = isBlinking ? 0 : cfg.blendShapes.smile || 0
  const surpriseBlend = isBlinking ? 0 : cfg.blendShapes.surprise || 0
  const frownBlend = cfg.blendShapes.frown || 0

  if (mouthMesh) {
    updateMouth(smileBlend)
  }

  if (surpriseBlend > 0.1) {
    mouth.scale.set(1, 1 + surpriseBlend * 2, 1)
    mouth.position.y = -0.12 - surpriseBlend * 0.05
  } else if (frownBlend > 0.1) {
    mouth.rotation.z = frownBlend * 0.6
    mouth.scale.set(1, 1, 1)
    mouth.position.y = -0.12
  } else {
    mouth.rotation.z = 0
    mouth.scale.set(1, 1, 1)
    mouth.position.y = -0.12
  }

  leftEye.scale.setScalar(cfg.eyeScale.x + surpriseBlend * 0.3)
  rightEye.scale.setScalar(cfg.eyeScale.x + surpriseBlend * 0.3)

  if (isBlinking) {
    leftEye.scale.y = 0.1
    rightEye.scale.y = 0.1
  }

  const earWiggle = cfg.earWiggle ? Math.sin(elapsed * 6) * 0.15 : 0
  leftEar.rotation.z = -0.25 + earWiggle
  rightEar.rotation.z = 0.25 - earWiggle

  const smileForCheek = cfg.blendShapes.smile || 0
  const cheekOpacity = 0.25 + Math.max(0, smileForCheek * 0.5)
  ;(leftCheek.material as THREE.MeshStandardMaterial).opacity = cheekOpacity
  ;(rightCheek.material as THREE.MeshStandardMaterial).opacity = cheekOpacity

  const wingFlap = cfg.bodyBounce.frequency > 2 ? Math.sin(elapsed * cfg.bodyBounce.frequency * 2) * 0.3 : 0
  leftWing.rotation.z = 0.5 + wingFlap
  rightWing.rotation.z = -0.5 - wingFlap

  // 性能优化：每 2 帧渲染一次（约 30fps）。小尺寸精灵动画平滑度无差别，GPU 开销减半
  renderFrameCount++
  if (renderFrameCount % 2 === 0) {
    renderer.render(scene, camera)
  }
}

function cleanup() {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    if (containerRef.value && renderer.domElement.parentElement) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }
}

function handleResize() {
  if (!renderer || !containerRef.value) return
  const w = props.width || containerRef.value.clientWidth
  const h = props.height || containerRef.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
}

watch(() => spriteStore.mood, () => {
  updateTargetAnimation()
})

watch(() => spriteStore.isSpeaking, () => {
  updateTargetAnimation()
})

watch(() => spriteStore.needsAttention, () => {
  updateTargetAnimation()
})

function updateTargetAnimation() {
  const newAnim = mapMoodToAnimation(
    spriteStore.mood,
    spriteStore.isSpeaking,
    spriteStore.needsAttention,
  )
  targetConfig = ANIMATION_CONFIGS[newAnim]
  if (targetConfig !== currentConfig) {
    currentConfig = lerpConfig(currentConfig, targetConfig, 0.01)
    transitionProgress = 0
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  initScene()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cleanup()
})
</script>

<style scoped>
.sprite-container {
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.sprite-container :deep(canvas) {
  display: block;
}
</style>
