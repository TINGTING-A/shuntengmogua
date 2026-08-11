<template>
  <div class="login-page">
    <!-- 漂浮粒子背景 -->
    <div class="bg-particles">
      <span v-for="n in 20" :key="n" class="particle" :style="particleStyle(n)"></span>
    </div>
    <!-- 荧光滤镜定义 -->
    <svg width="0" height="0" style="position:absolute"><defs>
      <filter id="leafGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs></svg>
    <!-- 上升小叶片 -->
    <div class="floating-leaves">
      <span v-for="n in 6" :key="'lf'+n" class="float-leaf" :style="floatLeafStyle(n)">
        <svg viewBox="0 0 20 14" fill="none"><path d="M2 7 Q10 0 18 7 Q10 14 2 7Z" fill="#7cff7c" opacity="0.7" filter="url(#leafGlow)"/></svg>
      </span>
    </div>

    <div class="flex-1 flex items-center justify-end pr-52 relative z-10">
    <div class="w-full max-w-md p-10 transition-all duration-300 ease-in-out relative z-10 login-card">
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-1">
          <img src="/watermelon-head.jpg" alt="西瓜头" class="watermelon-logo" />
          <h1 class="text-4xl font-semibold m-0 login-title">顺藤摸瓜</h1>
        </div>
        <p class="text-sm m-0 mt-2 login-subtitle">欢迎回来，请登录您的账户</p>
      </div>

      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" class="flex flex-col gap-5" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" clearable>
            <template #prefix>
              <el-icon class="text-gray-400">
                <UserIcon />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="密码" size="large">
            <template #prefix>
              <el-icon class="text-gray-400">
                <LockIcon />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <div class="flex justify-between items-center">
          <el-checkbox v-model="rememberMe">记住我</el-checkbox>
        </div>

        <el-button type="primary" size="large" :loading="loading" @click="handleLogin" class="mt-2 h-11 text-base font-medium rounded-xl">
          {{ loading ? '登录中...' : '登 录' }}
        </el-button>
      </el-form>
    </div>
  </div>
  </div>
</template>

<!-- @ts-ignore - Element Plus 组件类型缺失 -->
<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  PersonOutlined as UserIcon,
  LockOutlined as LockIcon,
  LogInOutlined as LoginIcon
} from '@vicons/material'

import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import { usePopup } from '../composables/usePopup'
import { useStorage } from '@vueuse/core'

// Element Plus 组件导入
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElIcon,
  ElCheckbox,
  ElButton
} from 'element-plus'

const authStore = useAuthStore()
// 消息提示
const { toast } = usePopup()

const router = useRouter()

// 登录方式 - 固定为邮箱登录
const loginType = 'email'

function particleStyle(n: number) { const s = 2+Math.random()*3; return { width:s+'px',height:s+'px',left:(Math.random()*100)+'%',animationDelay:(Math.random()*6)+'s',animationDuration:(4+Math.random()*5)+'s',opacity:0.15+Math.random()*0.3 } }
function floatLeafStyle(n: number) { return { left:(5+(n-1)*16+Math.random()*8)+'%',animationDelay:(Math.random()*8)+'s',animationDuration:(6+Math.random()*7)+'s',fontSize:(12+Math.random()*10)+'px',opacity:0.3+Math.random()*0.3 } }

// 表单数据 - 类型化
interface LoginForm {
  username: string;
  password: string;
}

const form = reactive<LoginForm>({
  username: '',
  password: ''
})

// 记住我 - 类型化
const rememberMe = ref(false)

// 加载状态 - 类型化
const loading = ref(false)

// 表单验证规则 - 类型化
const rules = reactive({
  username: {
    required: true,
    trigger: ['input', 'blur'],
    validator: (rule: any, value: string, callback: any) => {
      if (!value) {
        callback(new Error('请输入用户名'))
        return
      }
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
      if (!usernameRegex.test(value)) {
        callback(new Error('用户名只能包含字母、数字和下划线，长度为3-20位'))
        return
      }
      callback()
    }
  },
  password: {
    required: true,
    trigger: ['input', 'blur'],
    message: '请输入密码'
  }
})

// 表单引用 - 类型化
const formRef = ref<any>(null)

// 登录处理 - 类型化
const handleLogin = async (): Promise<void> => {
  formRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true
      try {
        // 构建登录参数
        const loginData = {
          type: 'email' as const,
          username: form.username,
          password: form.password,
          rememberMe: rememberMe.value  // 传递记住我状态
        }

        await authStore.login(loginData)
        router.replace('/')
      } catch (error: any) {
        console.error('登录失败:', error)
        
        // 根据错误类型显示友好的提示信息
        let errorMessage = '登录失败，请稍后重试'
        
        // 网络错误
        if (error.isNetworkError || error.message?.includes('无法连接到后端服务')) {
          errorMessage = '无法连接到服务器，请检查网络连接或稍后重试'
        }
        // 用户名或密码错误（401）
        else if (error.statusCode === 401 || error.message?.includes('用户名或密码错误')) {
          errorMessage = '用户名或密码错误，请检查后重试'
        }
        // 必填字段缺失（400）
        else if (error.statusCode === 400 || error.message?.includes('不能为空')) {
          errorMessage = '请输入用户名和密码'
        }
        // 其他已知错误
        else if (error.message) {
          errorMessage = error.message
        }
        
        toast.error(errorMessage)
      } finally {
        loading.value = false
      }
    } else {
      toast.error('请检查输入信息')
    }
  })
}
</script>

<style scoped>
/* ===== 背景主体 ===== */
.login-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  background: url('/login-bg.jpg') center / cover no-repeat;
  background-color: #1a2a1a;
}

/* 漂浮粒子 */
.bg-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.particle {
  position: absolute;
  bottom: -10px;
  background: #52b788;
  border-radius: 50%;
  animation: rise 8s ease-in infinite;
}
@keyframes rise {
  0% { bottom: -10px; opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { bottom: 105%; opacity: 0; }
}

/* 漂浮叶片 */
.floating-leaves {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.float-leaf {
  position: absolute;
  bottom: 60px;
  width: 22px;
  height: 16px;
  filter: drop-shadow(0 0 6px rgba(124,255,124,0.6)) drop-shadow(0 0 12px rgba(124,255,124,0.3));
  animation: leafFloat 8s ease-in infinite;
}
@keyframes leafFloat {
  0% { bottom: 60px; opacity: 0; transform: rotate(0deg) translateX(0); }
  15% { opacity: 0.7; }
  50% { transform: rotate(180deg) translateX(30px); }
  85% { opacity: 0.4; }
  100% { bottom: 102%; opacity: 0; transform: rotate(360deg) translateX(-20px); }
}

/* 登录卡片背景微调 */
:deep(.bg-surface) {
  background: transparent !important;
}

/* Element Plus 深度样式定制 */
:deep(.el-input__wrapper) {
  background: rgba(45, 106, 79, 0.04) !important;
  border: 1px solid rgba(45, 106, 79, 0.18) !important;
  box-shadow: none !important;
  border-radius: 10px;
  transition: all 0.2s ease;
  padding: 4px 12px;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(45, 106, 79, 0.35) !important;
  background: rgba(45, 106, 79, 0.07) !important;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #40916c !important;
  box-shadow: 0 0 0 3px rgba(64, 145, 108, 0.15) !important;
  background: rgba(45, 106, 79, 0.06) !important;
}

:deep(.el-checkbox__label) {
  font-size: 14px;
  color: #4a7a5a;
}

:deep(.el-form-item__label) {
  color: #a5d6a7 !important;
}

:deep(.el-button--primary) {
  --el-button-bg-color: #2e7d52;
  --el-button-border-color: #2e7d52;
  --el-button-hover-bg-color: #43a070;
  --el-button-hover-border-color: #43a070;
  --el-button-active-bg-color: #1b5e36;
  --el-button-active-border-color: #1b5e36;
  background: linear-gradient(135deg, #2e7d52, #43a070) !important;
  border: none !important;
}

:deep(.el-checkbox__inner) {
  border-color: #52b788 !important;
  background-color: transparent !important;
}
:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #52b788 !important;
  border-color: #52b788 !important;
}

/* 藤蔓动画 - 全屏宽度，登录区下方 */
.vine-stage {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 160px;
  pointer-events: none;
  z-index: 1;
}

.vine-svg {
  position: absolute;
  bottom: 40px;
  left: 0;
  width: 100%;
  height: 100px;
}

.melon {
  position: absolute;
  bottom: 68px;
  width: 64px;
  height: 64px;
  animation: melonFull 8s ease-in-out infinite;
}

.melon-body {
  width: 64px;
  height: 64px;
  background: radial-gradient(circle at 38% 32%, #8ce08c, #4db84d 55%, #2d8a2d);
  border-radius: 50%;
  position: relative;
  border: 2px solid #1d6b1d;
  box-shadow: 0 6px 20px rgba(45, 140, 45, 0.35), inset 0 -4px 8px rgba(0,0,0,0.1);
}

.melon-stripe {
  position: absolute;
  left: 8%; right: 8%;
  background: rgba(24, 70, 24, 0.3);
  border-radius: 50%;
  height: 5px;
}
.melon-stripe:nth-child(1) { top: 14px; }
.melon-stripe:nth-child(2) { top: 50px; }

.melon-stem {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%) rotate(-5deg);
  width: 4px;
  height: 11px;
  background: #5a9a3c;
  border-radius: 3px 3px 0 0;
}

.melon-leaf {
  position: absolute;
  top: -12px;
  left: 62%;
  width: 16px;
  height: 12px;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.15));
  animation: leafWiggle 3s ease-in-out infinite;
}

@keyframes leafWiggle {
  0%, 100% { transform: rotate(0deg); }
  30% { transform: rotate(8deg); }
  60% { transform: rotate(-4deg); }
}

.melon-face {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.eyes {
  display: flex;
  gap: 13px;
  margin-bottom: 4px;
}

.eye {
  width: 8px;
  height: 10px;
  background: #1a1a1a;
  border-radius: 50%;
  position: relative;
  animation: melonBlink 3s infinite;
}
.eye:nth-child(2) { animation-delay: 0.15s; }
.eye::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 1.5px;
  width: 3px;
  height: 3px;
  background: #fff;
  border-radius: 50%;
}

.mouth {
  width: 18px;
  height: 10px;
  border-bottom: 2.5px solid #1a1a1a;
  border-radius: 0 0 10px 10px;
}

.leaf {
  position: absolute;
  filter: drop-shadow(0 0 5px rgba(100,255,100,0.5));
}
.leaf svg { width: 26px; height: 18px; }
.leaf-l1 { left: 6%; bottom: 64px; animation: sway 2.5s ease-in-out infinite; }
.leaf-l2 { left: 18%; bottom: 48px; animation: sway 3s ease-in-out infinite 0.5s; }
.leaf-l3 { left: 30%; bottom: 66px; animation: sway 2.8s ease-in-out infinite 1s; }
.leaf-l4 { left: 42%; bottom: 45px; animation: sway 3.2s ease-in-out infinite 0.3s; }
.leaf-l5 { left: 54%; bottom: 62px; animation: sway 2.6s ease-in-out infinite 0.7s; }
.leaf-l6 { left: 66%; bottom: 50px; animation: sway 2.9s ease-in-out infinite 1.2s; }
.leaf-l7 { left: 78%; bottom: 64px; animation: sway 3.1s ease-in-out infinite 0.8s; }
.leaf-l8 { left: 90%; bottom: 48px; animation: sway 2.7s ease-in-out infinite 0.4s; }

@keyframes melonFull {
  0%   { left: -70px; transform: rotate(0deg) translateY(0); }
  8%   { left: 6%; transform: rotate(150deg) translateY(0); }
  16%  { left: 16%; transform: rotate(300deg) translateY(0); }
  /* 第一跳 */
  22%  { left: 20%; transform: rotate(380deg) translateY(0); }
  26%  { left: 24%; transform: rotate(440deg) translateY(-60px); }
  30%  { left: 28%; transform: rotate(500deg) translateY(-90px); }
  34%  { left: 32%; transform: rotate(560deg) translateY(-55px); }
  38%  { left: 36%; transform: rotate(620deg) translateY(0); }
  42%  { left: 40%; transform: rotate(660deg) translateY(0); }
  /* 第二跳 */
  48%  { left: 44%; transform: rotate(720deg) translateY(0); }
  52%  { left: 48%; transform: rotate(780deg) translateY(-65px); }
  56%  { left: 52%; transform: rotate(840deg) translateY(-88px); }
  60%  { left: 56%; transform: rotate(900deg) translateY(-50px); }
  64%  { left: 60%; transform: rotate(960deg) translateY(0); }
  /* 滚动到右侧 */
  70%  { left: 68%; transform: rotate(1060deg) translateY(0); }
  74%  { left: 72%; transform: rotate(1100deg) translateY(0); }
  /* 停住，跳舞 */
  76%  { left: 72%; transform: rotate(1100deg) translateY(0); }
  78%  { left: 72%; transform: rotate(1100deg) translateY(-14px); }
  80%  { left: 72%; transform: rotate(1100deg) translateY(0); }
  83%  { left: 72%; transform: rotate(1100deg) translateY(-18px); }
  86%  { left: 72%; transform: rotate(1100deg) translateY(0) rotate(-5deg); }
  89%  { left: 72%; transform: rotate(1100deg) translateY(-12px) rotate(5deg); }
  92%  { left: 72%; transform: rotate(1100deg) translateY(0) rotate(0deg); }
  95%  { left: 72%; transform: rotate(1100deg) translateY(-16px) rotate(-3deg); }
  98%  { left: 72%; transform: rotate(1100deg) translateY(0) rotate(0deg); }
  100% { left: 72%; transform: rotate(1100deg) translateY(0); }
}

@keyframes melonBlink {
  0%, 45%, 55%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.1); }
}

@keyframes sway {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}

.login-card {
  background: rgba(250, 210, 225, 0.22);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 28px;
  border: 1px solid rgba(236, 150, 180, 0.2);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
}

.login-title {
  background: linear-gradient(135deg, #c04870, #a83058, #d46880);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  color: #b04868;
}

.login-card :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.50);
  border: 1px solid rgba(200, 120, 150, 0.25);
  box-shadow: none;
}
.login-card :deep(.el-input__inner) {
  color: #6b3048;
}
.login-card :deep(.el-input__inner::placeholder) {
  color: rgba(160, 100, 130, 0.5);
}
.login-card :deep(.el-input__prefix .el-icon) {
  color: rgba(180, 110, 140, 0.6);
}
.login-card :deep(.el-checkbox__label) {
  color: #8b4060;
}
.login-card :deep(.el-form-item__error) {
  color: #fca5a5;
}

.login-card :deep(.el-button--primary) {
  background: linear-gradient(135deg, #e890a8, #d47090) !important;
  border-color: rgba(236, 150, 180, 0.4) !important;
}
.login-card :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #f0a0b8, #e8809c) !important;
}

.watermelon-logo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  animation: logoBounce 2s ease-in-out infinite;
  filter: drop-shadow(0 2px 8px rgba(200, 100, 140, 0.4));
}

@keyframes logoBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  15% { transform: translateY(-8px) scale(1.08); }
  30% { transform: translateY(0) scale(1); }
  45% { transform: translateY(-5px) scale(1.04); }
  60% { transform: translateY(0) scale(1); }
}
</style>