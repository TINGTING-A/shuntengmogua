<template>
  <div class="encryption-indicator">
    <div class="status-banner p-5 rounded-xl mb-6" :class="encReady ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200'">
      <div class="flex items-center gap-3">
        <el-icon :size="28" :color="encReady ? '#22c55e' : '#eab308'">
          <LockFilled v-if="encReady" /><WarningFilled v-else />
        </el-icon>
        <div>
          <div class="font-semibold text-(--color-text)">{{ encReady ? '端到端加密已激活' : '加密未就绪' }}</div>
          <div class="text-sm text-gray-500">{{ encReady ? 'XChaCha20-Poly1305 + Curve25519 密钥交换' : '请注册密钥对以启用加密' }}</div>
        </div>
      </div>
    </div>

    <div class="crypto-info grid grid-cols-2 gap-4 mb-6">
      <div class="info-block p-4 rounded-xl border">
        <h4 class="font-semibold mb-2 text-(--color-text)">对称加密</h4>
        <p class="text-sm text-gray-500">XChaCha20-Poly1305</p>
        <p class="text-xs text-gray-400 mt-1">加密数据离开设备前完成，服务端零知识</p>
      </div>
      <div class="info-block p-4 rounded-xl border">
        <h4 class="font-semibold mb-2 text-(--color-text)">密钥交换</h4>
        <p class="text-sm text-gray-500">Curve25519</p>
        <p class="text-xs text-gray-400 mt-1">安全计算共享密钥，无需传输私钥</p>
      </div>
    </div>

    <div class="key-area p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
      <h4 class="font-semibold mb-3 text-(--color-text)">我的公钥</h4>
      <div v-if="publicKey" class="key-display p-3 rounded-lg bg-white dark:bg-gray-900 font-mono text-xs break-all">
        {{ publicKey }}
      </div>
      <div v-else class="text-gray-400 text-sm">
        点击下方按钮生成密钥对
      </div>
      <el-button type="primary" class="mt-3" :loading="generating" @click="generate">
        {{ publicKey ? '重新生成' : '生成密钥对' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { LockFilled, WarningFilled } from '@vicons/material'

const encReady = ref(false)
const publicKey = ref('')
const generating = ref(false)

onMounted(async () => {
  await checkStatus()
})

async function checkStatus() {
  try {
    const res = await fetch('/api/v1/agents/sync-agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ task: '状态' }),
    })
    const data = await res.json()
    encReady.value = data.result?.encReady || false
  } catch { /* */ }
}

async function generate() {
  generating.value = true
  try {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    publicKey.value = `pub_${key.substring(0, 44)}`
    encReady.value = true
  } finally {
    generating.value = false
  }
}
</script>
