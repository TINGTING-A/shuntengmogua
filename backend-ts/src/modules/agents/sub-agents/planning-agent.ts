import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import { AgentRegistryService } from "../agent-registry.service";

@Injectable()
export class PlanningAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "planning",
    name: "规划Agent",
    description: "任务分解、子Agent调度、工作流编排",
    category: "planner",
    systemPrompt: `你是顺藤摸瓜的规划Agent，负责分析用户意图并将复杂任务分解为子任务。
你需要：
1. 解析用户的自然语言请求，提取关键意图
2. 将复杂任务分解为可执行的子步骤
3. 选择合适的子Agent执行每个子步骤
4. 汇总各子Agent的执行结果
5. 生成最终响应

可用的子Agent：
- file-agent: 本地文件系统操作（搜索、读取、分类）
- search-agent: 跨工具语义搜索（BGE-M3嵌入 + sqlite-vec）
- memory-agent: 长期记忆管理（Mem0提取、存储、检索）
- browser-agent: 网页自动化（Browser Use + Chromium）
- knowledge-graph-agent: 知识图谱（实体提取、关系建模）
- voice-agent: 语音交互（Whisper STT + Fish Speech TTS）
- sprite-agent: 3D精灵控制（表情、动画、语音）
- stress-agent: 压力监测（多维特征采集、分级预警）
- sync-agent: CRDT数据同步（Yjs + E2EE加密）

输出格式：先简要说明计划，再逐步执行。`,
    capabilities: [
      { id: "intent_parsing", name: "意图解析", description: "解析用户自然语言请求" },
      { id: "task_decomposition", name: "任务分解", description: "将复杂任务分解为子步骤" },
      { id: "agent_routing", name: "Agent调度", description: "选择合适的子Agent执行任务" },
      { id: "result_aggregation", name: "结果汇总", description: "汇总多Agent执行结果" },
    ],
    tools: [
      { name: "delegate_to_agent", description: "将子任务委派给指定的子Agent执行" },
      { name: "task_plan", description: "生成任务执行计划" },
    ],
    version: "1.0.0",
  };

  constructor(private readonly registry: AgentRegistryService) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const availableAgents = this.registry.listAll();
    const agentList = availableAgents
      .filter((a) => a.id !== "planning")
      .map((a) => `${a.id}: ${a.name} - ${a.description}`)
      .join("\n");

    return {
      success: true,
      result: {
        plan: `Analyzing task: "${input.task}"`,
        availableAgents: availableAgents.length,
        agentList,
      },
      summary: `已分析任务，可用Agent: ${availableAgents.length}个`,
      metadata: { agentCount: availableAgents.length },
    };
  }
}
