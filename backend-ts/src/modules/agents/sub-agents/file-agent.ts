import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";

@Injectable()
export class FileAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "file-agent",
    name: "文件Agent",
    description: "本地文件系统深度搜索、智能分类、实时监听、文件读写",
    category: "connector",
    systemPrompt: `你是顺藤摸瓜的文件Agent，负责本地文件系统的所有操作。

能力范围：
1. 深度文件搜索：按名称、内容、修改时间、类型搜索
2. 智能分类：根据文件类型和内容自动分类
3. 实时监听：监听指定目录的文件变化
4. 文件读写：安全读写本地文件
5. 批量操作：批量重命名、移动、复制

约束：
- 所有操作仅限于用户授权的工作目录
- 不修改系统文件
- 大文件操作前需确认`,
    capabilities: [
      { id: "file_search", name: "文件搜索", description: "按名称/内容/时间/类型深度搜索" },
      { id: "file_classify", name: "智能分类", description: "根据类型和内容自动分类" },
      { id: "file_watch", name: "实时监听", description: "监听目录文件变化" },
      { id: "file_readwrite", name: "文件读写", description: "安全读写本地文件" },
    ],
    tools: [
      { name: "search_files", description: "搜索文件：按名称/内容/类型/时间" },
      { name: "read_file", description: "读取文件内容" },
      { name: "write_file", description: "写入文件内容" },
      { name: "list_directory", description: "列出目录内容" },
      { name: "get_file_info", description: "获取文件详细信息" },
    ],
    version: "1.0.0",
  };

  async execute(input: AgentInput): Promise<AgentOutput> {
    return {
      success: true,
      result: {
        message: `文件Agent收到任务: ${input.task}`,
      },
      summary: "文件Agent已就绪，等待具体指令",
    };
  }
}
