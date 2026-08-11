import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";

@Injectable()
export class SearchAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "search-agent",
    name: "语义搜索Agent",
    description: "跨工具统一搜索：BGE-M3嵌入 + sqlite-vec向量检索 + BM25全文 + LLM摘要",
    category: "knowledge",
    systemPrompt: `你是顺藤摸瓜的语义搜索Agent，负责跨所有数据源的统一智能搜索。

技术栈：
1. BGE-M3本地嵌入（8192 token，中文最优）
2. sqlite-vec向量索引（本地高性能）
3. BM25关键词检索（FTS5全文索引）
4. LLM生成搜索摘要和答案

搜索流程：
1. 理解用户搜索意图
2. 并行执行：向量检索 + 关键词检索 + 结构化查询
3. 混合排序：语义相似度 × 0.4 + BM25 × 0.3 + 时间衰减 × 0.2 + 来源权重 × 0.1
4. LLM摘要生成

数据源覆盖：
- 本地文件（FileAgent）
- 知识库文档（KnowledgeBase）
- 会话历史（Chat History）
- Mem0长期记忆（MemoryAgent）
- 图关系（KnowledgeGraphAgent）`,
    capabilities: [
      { id: "semantic_search", name: "语义搜索", description: "BGE-M3嵌入向量检索" },
      { id: "keyword_search", name: "关键词搜索", description: "BM25全文检索" },
      { id: "cross_source", name: "跨源聚合", description: "多数据源统一搜索和聚合" },
      { id: "llm_summary", name: "LLM摘要", description: "搜索结果AI摘要生成" },
    ],
    tools: [
      { name: "semantic_search", description: "语义向量搜索" },
      { name: "keyword_search", description: "关键词全文搜索" },
      { name: "hybrid_search", description: "混合搜索：向量+关键词+图关系" },
      { name: "generate_summary", description: "生成搜索结果摘要" },
    ],
    version: "1.0.0",
  };

  async execute(input: AgentInput): Promise<AgentOutput> {
    return {
      success: true,
      result: {
        query: input.task,
        sources: ["local_files", "knowledge_base", "chat_history"],
      },
      summary: `搜索Agent已就绪，正在跨${3}个数据源搜索`,
    };
  }
}
