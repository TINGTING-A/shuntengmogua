import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import type { ConnectorEventService } from "../services/connector-event.service";

@Injectable()
export class NotionAgent extends BaseSubAgent implements OnModuleInit {
  private readonly logger = new Logger(NotionAgent.name);
  private notionApiKey: string | null = null;
  private notionApiBase = "https://api.notion.com/v1";
  private connected = false;

  readonly card: AgentCard = {
    id: "notion-agent",
    name: "NotionAgent",
    description: "Notion知识管理：页面读写、数据库操作、内容搜索",
    category: "connector",
    systemPrompt: `你是顺藤摸瓜的NotionAgent，负责Notion的知识管理操作。
支持：页面创建/读取/更新、数据库查询/写入、内容搜索。
需要配置 NOTION_API_KEY 环境变量。`,
    capabilities: [
      { id: "page_read", name: "页面读取", description: "读取Notion页面内容" },
      { id: "page_write", name: "页面写入", description: "创建或更新Notion页面" },
      { id: "database_query", name: "数据库查询", description: "查询Notion数据库" },
      { id: "search", name: "内容搜索", description: "搜索Notion工作区内容" },
    ],
    tools: [
      { name: "read_page", description: "读取Notion页面 - 需要pageId" },
      { name: "create_page", description: "创建Notion页面 - 需要parentId和内容" },
      { name: "update_page", description: "更新Notion页面属性" },
      { name: "query_database", description: "查询Notion数据库" },
      { name: "search_content", description: "搜索Notion工作区" },
    ],
    version: "1.0.0",
  };

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly connectorEvents?: ConnectorEventService,
  ) {
    super();
  }

  onModuleInit() {
    this.notionApiKey = this.configService.get<string>("NOTION_API_KEY") || null;
    if (this.notionApiKey) {
      this.connected = true;
      this.logger.log("NotionAgent: API Key configured, ready");
    } else {
      this.logger.warn("NotionAgent: NOTION_API_KEY not set — using demo mode");
    }
    this.connectorEvents?.registerConnector("notion-agent", "NotionAgent");
    this.connectorEvents?.setConnected("notion-agent", this.connected);
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context } = input;
    const ctx: Record<string, any> = { ...(context || {}), userId: input.userId };

    if (!this.notionApiKey && !ctx?.mockMode) {
      return { success: true, result: {}, summary: "NotionAgent就绪，需要配置NOTION_API_KEY" };
    }

    try {
      if (task.includes("读取") || task.includes("read")) {
        return this.readPage(ctx?.pageId || this.extractId(task));
      }
      if (task.includes("更新") || task.includes("update")) {
        return this.updatePage(task, ctx);
      }
      if (task.includes("创建") || task.includes("create") || task.includes("周报")) {
        return this.createPage(task, ctx);
      }
      if (task.includes("查询") || task.includes("query") || task.includes("搜索") || task.includes("search")) {
        return this.searchContent(task, ctx);
      }
      if (ctx?.pageId) {
        return this.readPage(ctx.pageId);
      }

      return { success: true, result: { connected: this.connected }, summary: "NotionAgent就绪" };
    } catch (error: any) {
      this.logger.error(`NotionAgent error: ${error.message}`);
      return { success: false, result: null, error: error.message };
    }
  }

  private async readPage(pageId: string): Promise<AgentOutput> {
    if (!pageId) return { success: false, result: null, error: "需要提供pageId" };

    const data = await this.notionRequest(`/pages/${pageId}`);
    const title = this.extractTitle(data);
    const blocks = await this.notionRequest(`/blocks/${pageId}/children`);

    const content = (blocks.results || []).map((b: any) => {
      const type = b.type;
      const text = b[type]?.rich_text?.map((t: any) => t.plain_text).join("") || "";
      return `[${type}] ${text}`;
    }).join("\n");

    return {
      success: true,
      result: { pageId, title, blocks: blocks.results?.length || 0, preview: content.substring(0, 1000) },
      summary: `读取页面: ${title || pageId}`,
    };
  }

  private async createPage(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const parentId = context?.parentId || (await this.getDefaultParentId());
    const title = context?.title || task.replace(/创建|create|页面/gi, "").trim() || "新页面";
    const content = context?.content || "由顺藤摸瓜AI自动创建";

    const body: any = {
      parent: parentId ? { page_id: parentId } : { type: "workspace", workspace: true },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content } }],
          },
        },
      ],
    };

    const data = await this.notionRequest("/pages", "POST", body);
    const pageUrl = data.url || `https://notion.so/${data.id?.replace(/-/g, "")}`;

    this.connectorEvents?.emit("new_page", "notion-agent", "NotionAgent", { pageId: data.id, title, url: pageUrl }, context?.userId);

    return {
      success: true,
      result: { pageId: data.id, title, url: pageUrl },
      summary: `已创建页面: ${title}`,
      metadata: { url: pageUrl },
    };
  }

  private async searchContent(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const query = context?.query || task.replace(/查询|query|搜索|search/gi, "").trim();

    const body: any = { query, page_size: 10 };
    if (context?.filter) body.filter = context.filter;
    if (context?.sort) body.sort = context.sort;

    const data = await this.notionRequest("/search", "POST", body);

    const results = (data.results || []).map((r: any) => ({
      id: r.id,
      title: this.extractTitle(r),
      type: r.object,
      lastEdited: r.last_edited_time,
    }));

    return {
      success: true,
      result: { query, count: results.length, results },
      summary: `搜索"${query}": 找到${results.length}个结果`,
    };
  }

  private async updatePage(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const pageId = context?.pageId || this.extractId(task);
    if (!pageId) return { success: false, result: null, error: "需要提供pageId" };

    const properties: any = {};
    if (context?.title) {
      properties.title = { title: [{ type: "text", text: { content: context.title } }] };
    }

    await this.notionRequest(`/pages/${pageId}`, "PATCH", { properties });

    return {
      success: true,
      result: { pageId, updated: Object.keys(properties) },
      summary: `已更新页面: ${pageId}`,
    };
  }

  private async getDefaultParentId(): Promise<string | null> {
    try {
      const data = await this.notionRequest("/search", "POST", {
        filter: { property: "object", value: "page" },
        page_size: 1,
      });
      return data.results?.[0]?.id || null;
    } catch { return null; }
  }

  private async notionRequest(path: string, method = "GET", body?: any): Promise<any> {
    if (!this.notionApiKey) {
      return this.mockResponse(path, method, body);
    }

    const response = await fetch(`${this.notionApiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Notion API ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  private extractTitle(data: any): string {
    const titleProp = Object.values(data.properties || {}).find(
      (p: any) => p.type === "title",
    ) as any;
    return titleProp?.title?.map((t: any) => t.plain_text).join("") || "Untitled";
  }

  private extractId(task: string): string {
    const uuidMatch = task.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) return uuidMatch[0];
    const hexMatch = task.match(/[0-9a-f]{32}/i);
    if (hexMatch) return hexMatch[0];
    return "";
  }

  private mockResponse(path: string, method: string, body?: any): any {
    const demoResults = [
      { id: "demo-page-1", object: "page", url: "https://notion.so/demo-1", title: "Q3计划", properties: { title: { title: [{ plain_text: "Q3计划" }] } }, last_edited_time: new Date().toISOString() },
      { id: "demo-page-2", object: "page", url: "https://notion.so/demo-2", title: "会议纪要", properties: { title: { title: [{ plain_text: "会议纪要" }] } }, last_edited_time: new Date().toISOString() },
      { id: "demo-page-3", object: "database", url: "https://notion.so/demo-3", title: "项目追踪表", properties: { title: { title: [{ plain_text: "项目追踪表" }] } }, last_edited_time: new Date().toISOString() },
    ];

    if (path.startsWith("/pages/") && path !== "/pages" && method === "GET") {
      const pageId = path.split("/")[2];
      return { id: pageId, url: `https://notion.so/${pageId}`, properties: { title: { title: [{ plain_text: "Demo Page" }] } }, object: "page" };
    }

    if (path.includes("/search")) {
      return { results: demoResults, has_more: false };
    }

    if (path.startsWith("/pages") && method === "POST") {
      return { id: "demo-page-new", url: "https://notion.so/demo-new", object: "page", properties: { title: { title: [{ plain_text: body?.properties?.title?.title?.[0]?.text?.content || "Demo Page" }] } } };
    }

    if (path.startsWith("/blocks") && path.includes("/children") && method === "GET") {
      return { results: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ plain_text: "这是演示内容段落。" }] } }] };
    }

    if (path.startsWith("/pages") && method === "PATCH") {
      return { id: path.split("/")[2] || "demo", properties: body?.properties || {} };
    }

    return { id: "demo-page-1", url: "https://notion.so/demo", properties: { title: { title: [{ plain_text: "Demo Page" }] } }, results: demoResults, object: "page" };
  }
}
