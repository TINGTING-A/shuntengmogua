<template>
    <div class="h-full overflow-hidden flex flex-col">
        <PageHeader title="智能体中心" />
        <div class="h-full px-4 flex flex-col flex-1 overflow-auto">
            <div class="flex-1 flex flex-col">
                <div class="sticky top-0 z-10 bg-(--color-bg)">
                    <el-tabs v-model="currentTabValue" @tab-change="handleTabChange" class="agent-center-tabs">
                        <el-tab-pane v-for="item in tabItems" :key="item.path" :label="item.label" :name="item.path">
                            <template #label>
                                <div class="flex items-center gap-2">
                                    <component :is="item.icon" class="w-4.25 h-4.25"></component>
                                    <span class="text-[15px]">{{ item.label }}</span>
                                </div>
                            </template>
                        </el-tab-pane>
                    </el-tabs>
                </div>
                <div class="flex-1 py-3">
                    <template v-if="currentTabValue === 'agent'">
                        <AgentManagementPage />
                    </template>
                    <template v-else-if="currentTabValue === 'mcp'">
                        <MCPServers />
                    </template>
                    <template v-else-if="currentTabValue === 'local-tools'">
                        <LocalTools />
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElTabs, ElTabPane } from 'element-plus'
import AgentManagementPage from '@/components/agent-manager/AgentManagementPage.vue'
import MCPServers from '@/components/plugins/MCPServers.vue'
import LocalTools from '@/components/plugins/LocalTools.vue'
import {
    Dumbbell16Regular,
    WrenchScrewdriver24Regular,
    PeopleTeam20Regular,
} from '@vicons/fluent'

import PageHeader from '@/components/PageHeader.vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// 智能体中心 Tab 菜单
const sidebarItems = [
    {
        label: 'Agent',
        path: 'agent',
        icon: PeopleTeam20Regular,
    },
    {
        label: 'MCP 服务器',
        path: 'mcp',
        icon: Dumbbell16Regular,
    },
    {
        label: '本地工具',
        path: 'local-tools',
        icon: WrenchScrewdriver24Regular,
    },
]

// Tab 数据（用于模板渲染）
const tabItems = computed(() => sidebarItems)

// 获取默认标签页
const getDefaultTabPath = () => {
    return sidebarItems[0]?.path || 'agent'
}

const currentTabValue = ref(getDefaultTabPath())

// Tab 切换处理
const handleTabChange = (tabName: string | number) => {
    const tabPath = typeof tabName === 'string' ? tabName : String(tabName)
    router.replace({ name: 'AgentCenter', params: { tab: tabPath } })
}

// 监听路由参数变化
watch(() => route.params.tab, (newPath) => {
    const tabPath = Array.isArray(newPath) ? newPath[0] : (newPath as string)
    if (tabPath && tabPath !== currentTabValue.value) {
        currentTabValue.value = tabPath
    }
})

onMounted(() => {
    if (!route.params.tab) {
        const defaultTab = getDefaultTabPath()
        router.replace({ name: 'AgentCenter', params: { tab: defaultTab } })
    } else {
        const tabParam = Array.isArray(route.params.tab) ? route.params.tab[0] : (route.params.tab as string)
        currentTabValue.value = tabParam
    }
})
</script>

<style scoped>
.agent-center-tabs :deep(.el-tabs__header) {
    margin-bottom: 0;
}

.agent-center-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
}

.agent-center-tabs :deep(.el-tabs__item) {
    padding: 0 18px;
    height: 44px;
    line-height: 44px;
    font-size: 14px;
}
</style>
