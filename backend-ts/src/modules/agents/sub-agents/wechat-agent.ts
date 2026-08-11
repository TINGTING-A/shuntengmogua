import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import type { ConnectorEventService } from "../services/connector-event.service";

export interface WechatMessage {
  id: string;
  type: "text" | "image" | "file" | "voice" | "video" | "link";
  from: string;
  content: string;
  timestamp: string;
  roomId?: string;
  fileName?: string;
}

export interface WechatFavorite {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  source?: string;
}

@Injectable()
export class WechatAgent extends BaseSubAgent implements OnModuleInit {
  private readonly logger = new Logger(WechatAgent.name);
  private readonly messageStore = new Map<string, WechatMessage[]>();
  private readonly favoriteStore = new Map<string, WechatFavorite[]>();
  private ready = false;

  readonly card: AgentCard = {
    id: "wechat-agent",
    name: "微信Agent",
    description: "微信数据管理：聊天记录提取、收藏整理、文件导出",
    category: "connector",
    systemPrompt: `你是顺藤摸瓜的微信Agent，负责微信数据的本地管理和提取。
所有数据仅本地处理，严格遵守平台ToS，不做云端转发。
支持的来源：iLink Bot HTTP API (现有微信个人号适配器接入)。
能力：聊天记录提取、收藏整理、文件导出、会话搜索。`,
    capabilities: [
      { id: "chat_extraction", name: "聊天提取", description: "提取指定会话的聊天记录" },
      { id: "favorite_organize", name: "收藏整理", description: "整理微信收藏内容" },
      { id: "file_export", name: "文件导出", description: "导出微信中的文件到本地" },
      { id: "search_messages", name: "消息搜索", description: "搜索聊天记录内容" },
      { id: "link_collect", name: "链接收集", description: "收集聊天中的文章链接" },
    ],
    tools: [
      { name: "extract_chats", description: "提取聊天记录 - roomId/limit/dateRange" },
      { name: "search_messages", description: "搜索聊天记录 - keyword" },
      { name: "list_favorites", description: "列出微信收藏" },
      { name: "export_files", description: "导出文件到本地目录" },
      { name: "collect_links", description: "收集聊天中的文章/网页链接" },
    ],
    version: "1.0.0",
  };

  private connectorEvents?: ConnectorEventService;

  constructor(
    @Optional() connectorEvents?: ConnectorEventService,
  ) {
    super();
    this.connectorEvents = connectorEvents;
  }

  onModuleInit() {
    this.ready = true;
    this.seedDemoData();
    this.connectorEvents?.registerConnector("wechat-agent", "微信Agent");
    this.connectorEvents?.setConnected("wechat-agent", true);
    this.logger.log("WechatAgent: Initialized with demo data — connect iLink Bot for real data");
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context } = input;

    try {
      if (task.includes("提取") || task.includes("extract") || task.includes("聊天")) {
        return this.extractChats(task, context);
      }
      if (task.includes("搜索") || task.includes("search") || task.includes("查找")) {
        return this.searchMessages(task, context);
      }
      if (task.includes("收藏") || task.includes("favorite")) {
        return this.listFavorites(context);
      }
      if (task.includes("导出") || task.includes("export") || task.includes("文件")) {
        return this.exportFiles(task, context);
      }
      if (task.includes("链接") || task.includes("link") || task.includes("文章") || task.includes("公众号")) {
        return this.collectLinks(task, context);
      }

      return {
        success: true,
        result: { ready: this.ready, messageCount: this.getTotalMessageCount() },
        summary: "微信Agent就绪",
      };
    } catch (error: any) {
      this.logger.error(`WechatAgent error: ${error.message}`);
      return { success: false, result: null, error: error.message };
    }
  }

  feedMessages(roomId: string, messages: WechatMessage[], userId?: string): void {
    const existing = this.messageStore.get(roomId) || [];
    this.messageStore.set(roomId, [...existing, ...messages]);

    for (const msg of messages) {
      this.connectorEvents?.emit(
        msg.type === "file" ? "new_file" : "new_message",
        "wechat-agent",
        "微信Agent",
        { roomId, messageId: msg.id, from: msg.from, type: msg.type, preview: msg.content?.substring(0, 100) || msg.fileName },
        userId,
      );
    }
  }

  private extractChats(task: string, context?: Record<string, any>): AgentOutput {
    const roomId = context?.roomId || null;
    const limit = context?.limit || 50;
    const keyword = context?.keyword;

    let messages = roomId
      ? (this.messageStore.get(roomId) || [])
      : Array.from(this.messageStore.values()).flat();

    if (keyword) {
      const kw = keyword.toLowerCase();
      messages = messages.filter((m) => m.content.toLowerCase().includes(kw));
    }
    messages = messages.slice(-limit);

    const stats = {
      text: messages.filter((m) => m.type === "text").length,
      image: messages.filter((m) => m.type === "image").length,
      file: messages.filter((m) => m.type === "file").length,
      link: messages.filter((m) => m.type === "link").length,
    };

    return {
      success: true,
      result: { roomId: roomId || "全部会话", count: messages.length, stats, messages: messages.slice(0, 20) },
      summary: `${roomId || "全部会话"} 最近${messages.length}条消息 (文本:${stats.text} 图片:${stats.image} 文件:${stats.file} 链接:${stats.link})`,
    };
  }

  private searchMessages(task: string, context?: Record<string, any>): AgentOutput {
    const keyword = context?.keyword || task.replace(/搜索|search|查找/gi, "").trim();
    const kw = keyword.toLowerCase();

    const allMessages = Array.from(this.messageStore.entries()).flatMap(
      ([roomId, msgs]) => msgs.filter((m) => m.content.toLowerCase().includes(kw)).map((m) => ({ ...m, roomId })),
    );

    return {
      success: true,
      result: { keyword, count: allMessages.length, messages: allMessages.slice(0, 20) },
      summary: `搜索"${keyword}": 找到${allMessages.length}条相关消息`,
    };
  }

  private listFavorites(context?: Record<string, any>): AgentOutput {
    const favorites = this.favoriteStore.get("default") || [];
    return {
      success: true,
      result: { count: favorites.length, favorites },
      summary: `共${favorites.length}条收藏`,
    };
  }

  private exportFiles(task: string, context?: Record<string, any>): AgentOutput {
    const outputDir = context?.outputDir || "./exports/wechat";
    const files = Array.from(this.messageStore.values())
      .flat()
      .filter((m) => m.type === "file" || m.type === "image")
      .map((m) => ({ id: m.id, fileName: m.fileName || "unknown", type: m.type, timestamp: m.timestamp }));

    return {
      success: true,
      result: { outputDir, fileCount: files.length, files },
      summary: `${files.length}个文件待导出到 ${outputDir}`,
    };
  }

  private collectLinks(task: string, context?: Record<string, any>): AgentOutput {
    const allMessages = Array.from(this.messageStore.values()).flat();
    const links = allMessages.filter(
      (m) => m.type === "link" || (m.type === "text" && (m.content.includes("http") || m.content.includes("mp.weixin"))),
    );

    const categorized = {
      articles: links.filter((l) => l.content.includes("mp.weixin") || l.content.includes("公众号")),
      webpages: links.filter((l) => l.content.includes("http") && !l.content.includes("mp.weixin")),
    };

    return {
      success: true,
      result: {
        total: links.length,
        articles: categorized.articles.map((l) => ({ content: l.content.substring(0, 200), timestamp: l.timestamp })),
        webpages: categorized.webpages.length,
      },
      summary: `共${links.length}个链接: ${categorized.articles.length}篇文章, ${categorized.webpages.length}个网页`,
    };
  }

  private getTotalMessageCount(): number {
    return Array.from(this.messageStore.values()).reduce((sum, msgs) => sum + msgs.length, 0);
  }

  private seedDemoData(): void {
    const demoMessages: WechatMessage[] = [
      { id: "wx-1", type: "text", from: "同事小王", content: "Q3的预算报表发你了，查收一下", timestamp: new Date(Date.now() - 3600000).toISOString(), roomId: "工作群" },
      { id: "wx-2", type: "file", from: "同事小王", content: "", timestamp: new Date(Date.now() - 3500000).toISOString(), roomId: "工作群", fileName: "Q3预算报表.xlsx" },
      { id: "wx-3", type: "text", from: "老板", content: "周五之前把方案给一下", timestamp: new Date(Date.now() - 7200000).toISOString(), roomId: "工作群" },
      { id: "wx-4", type: "link", from: "技术分享", content: "https://mp.weixin.qq.com/s/ai-agent-2026", timestamp: new Date(Date.now() - 10800000).toISOString(), roomId: "技术群" },
      { id: "wx-5", type: "text", from: "李经理", content: "会议纪要整理好了，大家看看有没有补充", timestamp: new Date(Date.now() - 18000000).toISOString(), roomId: "项目组" },
      { id: "wx-6", type: "image", from: "同事小张", content: "", timestamp: new Date(Date.now() - 20000000).toISOString(), roomId: "工作群", fileName: "架构图.png" },
      { id: "wx-7", type: "link", from: "AI前沿", content: "https://mp.weixin.qq.com/s/graphrag-tutorial", timestamp: new Date(Date.now() - 30000000).toISOString(), roomId: "技术群" },
      { id: "wx-8", type: "text", from: "HR", content: "本周五下午3点全员大会", timestamp: new Date(Date.now() - 40000000).toISOString(), roomId: "公司群" },
    ];

    this.messageStore.set("工作群", demoMessages.slice(0, 4));
    this.messageStore.set("技术群", demoMessages.slice(4, 6));
    this.messageStore.set("项目组", [demoMessages[4]]);
    this.messageStore.set("公司群", [demoMessages[7]]);

    const demoFavorites: WechatFavorite[] = [
      { id: "fav-1", type: "article", content: "2026 AI Agent框架深度对比 (MAF/LangGraph/CrewAI)", timestamp: new Date(Date.now() - 86400000).toISOString(), source: "公众号" },
      { id: "fav-2", type: "file", content: "合同模板_v2.docx", timestamp: new Date(Date.now() - 172800000).toISOString(), source: "聊天" },
      { id: "fav-3", type: "article", content: "GraphRAG知识图谱实战指南", timestamp: new Date(Date.now() - 259200000).toISOString(), source: "公众号" },
    ];
    this.favoriteStore.set("default", demoFavorites);
  }
}
