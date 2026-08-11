<template>
  <div class="h-full flex flex-col md:max-w-260 md:mx-auto">
    <div class="flex flex-col h-full">
      <!-- 头部 -->
      <div class="flex justify-between items-center pb-4">
        <el-button type="primary" @click="showCreateDialog" class="flex items-center">
          <template #icon>
            <Plus />
          </template>
          新建机器人
        </el-button>
        <el-button class="docs-btn" @click="handleOpenDocs">
          <template #icon>
            <Document />
          </template>
          使用说明
        </el-button>
      </div>

      <!-- 机器人列表 -->
      <div class="flex-1 overflow-y-auto pt-4">
        <!-- 加载状态 -->
        <div v-if="botStore.loading" class="flex justify-center items-center py-12">
          <el-icon class="is-loading" :size="32">
            <Loading />
          </el-icon>
          <span class="ml-2 text-gray-500 dark:text-[#8b8d95]">加载中...</span>
        </div>

        <!-- 机器人卡片网格 -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          <BotCard v-for="bot in botStore.botInstances" :key="bot.id" :bot="bot" @edit="handleEdit"
            @delete="handleDelete" @start="handleStart" @stop="handleStop" />

          <!-- 空状态 -->
          <div v-if="!botStore.loading && botStore.botInstances.length === 0"
            class="col-span-full text-center py-12">
            <el-icon size="48" class="text-gray-300 dark:text-[#3e4046] mb-3">
              <Cpu />
            </el-icon>
            <p class="text-lg text-gray-500 dark:text-[#8b8d95]">暂无机器人</p>
            <p class="text-sm mt-1 text-gray-400 dark:text-[#6b6d75]">点击上方按钮创建第一个机器人</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <BotModal v-model="dialogVisible" :bot="currentBot" @saved="handleSaved" />

    <!-- 使用说明对话框 -->
    <el-dialog v-model="docsVisible" width="640px" destroy-on-close>
      <template #header>
        <div class="flex items-center gap-3">
          <img src="/watermelon-head.jpg" class="w-12 h-12 rounded-full object-cover border border-green-300/70 dark:border-blue-400/70" alt="西瓜头" />
          <div>
            <div class="text-xl font-bold" style="font-family: 'Ma Shan Zheng', 'ZCOOL XiaoWei', KaiTi, serif;">顺藤摸瓜</div>
            <div class="text-xs text-gray-400">机器人使用说明</div>
          </div>
        </div>
      </template>

      <div class="docs-body text-sm space-y-4 max-h-70vh overflow-y-auto pr-2">
        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">🤖 功能简介</h4>
          <p class="text-gray-500 dark:text-gray-400">机器人模块将「智能助手」接入各大 IM 平台，让微信 / QQ / 钉钉 / 飞书 / 企业微信 里的好友与群聊，直接与你的 AI 办公伙伴对话。</p>
        </div>

        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">📋 使用步骤</h4>
          <ol class="list-decimal list-inside space-y-1 text-gray-500 dark:text-gray-400">
            <li>点击右上角「新建机器人」，选择接入平台</li>
            <li>填写机器人名称，选择默认角色（如：智能助手）</li>
            <li>选择对话模型（DeepSeek 等已配置的供应商模型）</li>
            <li>可选：引用知识库，让机器人基于你的文档回答（RAG）</li>
            <li>按平台要求填写凭证（Token / Webhook / 扫码授权）</li>
            <li>保存后自动启动，或手动点击卡片上的启动按钮</li>
          </ol>
        </div>

        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">⚙️ 平台配置</h4>
          <p class="text-gray-500 dark:text-gray-400">不同平台凭证不同：个人微信使用 iLink Bot 扫码授权；公众号 / 企业微信 / 钉钉 / 飞书使用开放平台 Token 与 Webhook 地址。凭证填写错误时，卡片会显示异常状态。</p>
        </div>

        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">📦 前置依赖</h4>
          <el-alert type="warning" show-icon :closable="false" class="mb-2">
            <p class="text-sm">建议在部署前预先安装 <b>ffmpeg</b>（并确保支持 <b>amr</b> 格式），否则媒体类文件（语音/视频）可能无法正常收发。接入微信类平台时<b>强烈建议</b>安装。</p>
          </el-alert>
        </div>

        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">📚 各平台接入指南</h4>
          <p class="text-gray-500 dark:text-gray-400 mb-2">各平台详细接入步骤，可参考官方文档对应章节：</p>
          <ul class="list-disc list-inside space-y-1 text-gray-500 dark:text-gray-400">
            <li>微信个人号 / 微信公众号 / 企业微信 — 扫码授权或开放平台凭证接入</li>
            <li>QQ 机器人 — QQ 开放平台申请接入</li>
            <li>飞书（Lark）— 飞书开放平台创建应用并配置事件订阅</li>
            <li>Discord Bot — Discord Developer Portal 创建 Bot Token</li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold mb-1 text-(--color-text)">🔄 运行保障</h4>
          <ul class="list-disc list-inside space-y-1 text-gray-500 dark:text-gray-400">
            <li>连接断开时自动重连，可配置最大重试次数与重试间隔</li>
            <li>支持多机器人同时在线，每个机器人独立角色与模型</li>
            <li>卡片上可随时启动 / 停止 / 编辑 / 删除机器人</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" @click="docsVisible = false">我知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus, Loading, Cpu, Document } from '@element-plus/icons-vue'
import { useBotStore } from '@/stores/bot'
import BotCard from './BotCard.vue'
import BotModal from './BotModal.vue'
import type { BotInstance } from '@/types/bot'

const botStore = useBotStore()
const dialogVisible = ref(false)
const docsVisible = ref(false)
const currentBot = ref<BotInstance | null>(null)

// 页面加载时获取数据
onMounted(async () => {
  await loadBots()
})

// 加载机器人列表
const loadBots = async () => {
  // 先加载平台元数据
  if (botStore.platforms.length === 0) {
    await botStore.loadPlatforms()
  }
  // 再加载机器人实例
  await botStore.loadBotInstances()
}

// 显示创建对话框
const showCreateDialog = () => {
  currentBot.value = null
  dialogVisible.value = true
}

// 打开使用说明（本地文字说明对话框）
const handleOpenDocs = () => {
  docsVisible.value = true
}

// 编辑机器人
const handleEdit = (bot: BotInstance) => {
  currentBot.value = bot
  dialogVisible.value = true
}

// 删除机器人
const handleDelete = async (bot: BotInstance) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除机器人 "${bot.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await botStore.deleteBot(bot.id)
  } catch (error) {
    // 用户取消或删除失败
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 启动机器人
const handleStart = async (id: string) => {
  try {
    await botStore.startBot(id)
    // 延迟刷新状态
    setTimeout(() => {
      botStore.loadBotInstances()
    }, 2000)
  } catch (error) {
    console.error('启动失败:', error)
  }
}

// 停止机器人
const handleStop = async (id: string) => {
  try {
    await botStore.stopBot(id)
  } catch (error) {
    console.error('停止失败:', error)
  }
}

// 保存成功后的回调
const handleSaved = () => {
  dialogVisible.value = false
  currentBot.value = null
  // 刷新列表
  botStore.loadBotInstances()
}
</script>

<style scoped>
/* 样式由 Tailwind 处理 */
</style>
