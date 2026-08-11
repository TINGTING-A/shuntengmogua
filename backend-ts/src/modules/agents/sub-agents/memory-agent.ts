import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import { Mem0Service } from "../mem0.service";

@Injectable()
export class MemoryAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "memory-agent",
    name: "记忆Agent",
    description: "Mem0多级记忆引擎：ADD-only提取、实体链接、时间推理、多信号检索",
    category: "knowledge",
    systemPrompt: `你是顺藤摸瓜的记忆Agent，负责管理用户的长期记忆。

技术栈：Mem0（v3.1.2，62k stars，LoCoMo 92.5分）

记忆层级：
1. User级：用户偏好、习惯、长期知识
2. Session级：当前会话上下文
3. Agent级：任务执行状态和中间结果

核心能力：
1. ADD-only提取：单次LLM调用完成记忆写入，不做UPDATE/DELETE
2. 实体链接：实体自动提取、嵌入、跨记忆链接
3. 多信号检索：语义 + BM25 + 实体匹配 并行打分融合
4. 时间推理：对"当前状态""过去事件""未来计划"分别排序

与两级压缩互补：
- Mem0管长期记忆（跨会话"记得你"）
- 压缩管实时上下文（当前对话"不爆Token"）`,
    capabilities: [
      { id: "memory_extract", name: "记忆提取", description: "ADD-only自动提取对话关键信息" },
      { id: "entity_linking", name: "实体链接", description: "实体自动发现和跨记忆关联" },
      { id: "temporal_reasoning", name: "时间推理", description: "时间感知的记忆检索和排序" },
      { id: "multi_signal_retrieval", name: "多信号检索", description: "语义+BM25+实体的混合检索" },
    ],
    tools: [
      { name: "extract_memories", description: "从对话中提取并存储记忆" },
      { name: "retrieve_memories", description: "检索相关记忆" },
      { name: "search_by_entity", description: "按实体搜索关联记忆" },
      { name: "get_user_preferences", description: "获取用户偏好设置" },
    ],
    version: "1.1.0",
  };

  constructor(private readonly mem0Service: Mem0Service) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context, userId } = input;

    if (!this.mem0Service.isEnabled()) {
      return {
        success: true,
        result: { mode: "disabled", message: "Mem0 not configured" },
        summary: "Mem0未配置，记忆功能已禁用",
      };
    }

    const intent = this.detectIntent(task);

    switch (intent) {
      case "search":
        return this.handleSearch(task, userId);
      case "extract":
        return this.handleExtract(context, userId);
      case "list":
        return this.handleList(userId);
      case "delete":
        return this.handleDelete(task, userId);
      default:
        return this.handleSearch(task, userId);
    }
  }

  private detectIntent(task: string): "search" | "extract" | "list" | "delete" {
    const lower = task.toLowerCase();
    if (
      lower.includes("删除") || lower.includes("delete") || lower.includes("remove")
    ) return "delete";
    if (
      lower.includes("记住") || lower.includes("提取") || lower.includes("extract") ||
      lower.includes("保存") || lower.includes("save")
    ) return "extract";
    if (
      lower.includes("全部") || lower.includes("所有") || lower.includes("all") ||
      lower.includes("list") || lower.includes("列出")
    ) return "list";
    return "search";
  }

  private async handleSearch(query: string, userId?: string): Promise<AgentOutput> {
    const results = await this.mem0Service.search(query, { userId, limit: 5 });

    return {
      success: true,
      result: { query, results, count: results.length },
      summary: results.length > 0
        ? `找到${results.length}条相关记忆：${results[0].memory.substring(0, 50)}...`
        : "未找到相关记忆",
    };
  }

  private async handleExtract(context: any, userId?: string): Promise<AgentOutput> {
    if (!context?.messages) {
      return { success: false, result: null, error: "缺少对话内容" };
    }

    const entries = await this.mem0Service.extractFromConversation(
      context.messages,
      userId || "default",
      context.sessionId,
    );

    return {
      success: true,
      result: { extracted: entries.length, entries },
      summary: `已从对话中提取${entries.length}条记忆`,
    };
  }

  private async handleList(userId?: string): Promise<AgentOutput> {
    const memories = await this.mem0Service.getAll({ userId, limit: 20 });

    return {
      success: true,
      result: { memories, count: memories.length },
      summary: `共${memories.length}条记忆`,
    };
  }

  private async handleDelete(task: string, userId?: string): Promise<AgentOutput> {
    if (task.includes("全部") || task.includes("所有")) {
      await this.mem0Service.deleteAll(userId);
      return { success: true, result: null, summary: "已删除所有记忆" };
    }

    const idMatch = task.match(/[a-f0-9-]{36}/);
    if (idMatch) {
      await this.mem0Service.delete(idMatch[0]);
      return { success: true, result: null, summary: `已删除记忆 ${idMatch[0]}` };
    }

    return { success: false, result: null, error: "请指定要删除的记忆ID" };
  }
}
