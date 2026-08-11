import { Injectable, Logger } from "@nestjs/common";
import {
  IToolProvider,
  ToolCallRequest,
  ToolProviderMetadata,
} from "../interfaces/tool-provider.interface";

/**
 * Web 工具提供者：让 Agent 具备 URL 访问能力
 *
 * 核心能力：
 * - fetch_url: 抓取网页内容并转为纯文本（Token 友好），供 LLM 阅读
 * - search_web: 通过 Bing 搜索网页并返回结果列表（无 API Key 依赖）
 *
 * 实现说明：
 * - 使用 Node 22 内置 fetch，无外部依赖
 * - HTML 清洗：移除 script/style/svg 等噪音，提取正文文本
 * - 超时控制 + 大小限制，避免挂起和 Token 爆炸
 */
@Injectable()
export class WebToolProvider implements IToolProvider {
  private readonly logger = new Logger(WebToolProvider.name);
  public readonly namespace = "web";

  private readonly toolsConfig = [
    {
      name: "fetch_url",
      description:
        "访问指定 URL 并提取网页正文纯文本内容（自动移除脚本/样式/导航等噪音）。当用户提供网址、或需要阅读某个网页/文章/文档内容时使用。返回内容适合直接阅读和总结。",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "要访问的完整 URL，如 https://example.com/article",
          },
          maxLength: {
            type: "number",
            description:
              "返回内容的长度上限（字符数），默认 5000，最大 20000。长页面会被截断。",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "search_web",
      description:
        "在互联网上搜索信息（基于 Bing 搜索），返回搜索结果列表（标题+摘要+链接）。当用户询问实时信息、最新新闻、或需要查找资料时使用。搜索后如需详细内容可再用 fetch_url 访问具体链接。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，中文英文均可",
          },
          count: {
            type: "number",
            description: "返回结果数量，默认 6，最大 10",
          },
        },
        required: ["query"],
      },
    },
  ];

  constructor() {}

  async getTools(
    enabled?: boolean | string[],
    context?: Record<string, any>,
  ): Promise<any[]> {
    if (enabled === false) return [];

    if (Array.isArray(enabled)) {
      return this.toolsConfig.filter((tool) => enabled.includes(tool.name));
    }

    return this.toolsConfig;
  }

  async execute(
    request: ToolCallRequest,
    context?: Record<string, any>,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    switch (request.name) {
      case "fetch_url":
        return this.handleFetchUrl(request.arguments, abortSignal);
      case "search_web":
        return this.handleSearchWeb(request.arguments, abortSignal);
      default:
        throw new Error(`未知工具：${request.name}`);
    }
  }

  /**
   * 抓取 URL 内容并转为纯文本
   */
  private async handleFetchUrl(
    args: Record<string, any> = {},
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const url = (args.url || "").trim();
    const maxLength = Math.min(
      Number(args.maxLength) || 5000,
      20000,
    );

    if (!url) {
      return "错误：请提供要访问的 URL";
    }

    let target = url;
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }

    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        redirect: "follow",
        signal: abortSignal
          ? AbortSignal.any([controller.signal, abortSignal])
          : controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        return `访问失败：HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());

      // 非 HTML（PDF/图片/JSON 等）
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        return `该地址不是网页内容（Content-Type: ${contentType}）。已返回 ${buffer.length} 字节二进制数据，无法直接阅读。`;
      }

      const html = buffer.toString("utf-8");
      const { title, text } = this.htmlToText(html);

      const parts: string[] = [];
      parts.push(`【网页内容】`);
      parts.push(`标题：${title || "(无标题)"}`);
      parts.push(`地址：${response.url || target}`);
      parts.push(`抓取耗时：${Date.now() - t0}ms`);
      parts.push("");
      parts.push(text.slice(0, maxLength));
      if (text.length > maxLength) {
        parts.push("");
        parts.push(`（内容较长已截断，共 ${text.length} 字符，仅显示前 ${maxLength} 字符）`);
      }
      return parts.join("\n");
    } catch (error: any) {
      this.logger.warn(`fetch_url 失败 ${target}: ${error.message}`);
      if (error.name === "AbortError") {
        return `访问超时（15 秒）：${target}。可能是网站响应慢或无法访问。`;
      }
      return `访问失败：${error.message.slice(0, 150)}`;
    }
  }

  /**
   * Bing 网页搜索（无 API Key）
   */
  private async handleSearchWeb(
    args: Record<string, any> = {},
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const query = (args.query || "").trim();
    const count = Math.min(Number(args.count) || 6, 10);

    if (!query) {
      return "错误：请提供搜索关键词";
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: abortSignal
          ? AbortSignal.any([controller.signal, abortSignal])
          : controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        return `搜索失败：HTTP ${response.status}`;
      }

      const html = await response.text();
      const results = this.parseBingResults(html, count);

      if (results.length === 0) {
        return `未搜索到 "${query}" 的相关结果（Bing 可能返回了空页面）。`;
      }

      const parts: string[] = [];
      parts.push(`【搜索结果：${query}】`);
      results.forEach((r, i) => {
        parts.push(
          `${i + 1}. ${r.title}\n   链接：${r.url}\n   摘要：${r.snippet || "(无摘要)"}`,
        );
      });
      parts.push("");
      parts.push("如需查看某个结果的详细内容，可调用 web__fetch_url 访问对应链接。");
      return parts.join("\n");
    } catch (error: any) {
      this.logger.warn(`search_web 失败: ${error.message}`);
      if (error.name === "AbortError") {
        return `搜索超时（15 秒）：${query}`;
      }
      return `搜索失败：${error.message.slice(0, 150)}`;
    }
  }

  /**
   * HTML → 纯文本（清洗噪音标签）
   */
  private htmlToText(html: string): { title: string; text: string } {
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = this.cleanText(titleMatch[1]);
    }

    // 移除 script/style/noscript/svg/iframe/nav/footer/header
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");

    // 块级标签转换行
    text = text.replace(
      /<\/(p|div|h[1-6]|li|tr|br|section|article|blockquote)>/gi,
      "\n",
    );

    // 移除剩余所有标签
    text = text.replace(/<[^>]+>/g, " ");

    // 清理空白
    text = this.cleanText(text);

    return { title, text };
  }

  /**
   * 解析 Bing 搜索结果
   */
  private parseBingResults(html: string, count: number): Array<{ title: string; url: string; snippet: string }> {
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // Bing 结果块：<li class="b_algo">...</li>
    const liRegex = /<li class="b_algo"[\s\S]*?<\/li>/gi;
    const blocks = html.match(liRegex) || [];

    for (const block of blocks) {
      if (results.length >= count) break;

      // 标题和链接
      const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/i);
      // 摘要
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      if (titleMatch) {
        results.push({
          title: this.cleanText(titleMatch[2]).slice(0, 100),
          url: titleMatch[1],
          snippet: snippetMatch
            ? this.cleanText(snippetMatch[1]).slice(0, 200)
            : "",
        });
      }
    }

    return results;
  }

  /**
   * 清理文本：压缩空白、去实体
   */
  private cleanText(s: string): string {
    return (s || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async getPrompt(context?: Record<string, any>): Promise<string> {
    return [
      "# Web 访问能力",
      "你可以通过以下工具访问互联网：",
      "- `web__fetch_url`：读取指定网页的正文内容（纯文本）",
      "- `web__search_web`：在 Bing 上搜索信息",
      "当用户提供网址或询问需要查阅网页/实时信息时，请优先调用这些工具，基于获取的真实内容回答，不要编造网页内容。",
      "",
    ].join("\n");
  }

  async getBriefDescription(context?: Record<string, any>): Promise<string> {
    return "提供 URL 访问与网页搜索能力，可读取网页内容";
  }

  getMetadata(context?: Record<string, any>): ToolProviderMetadata {
    return {
      namespace: this.namespace,
      displayName: "Web 访问工具",
      description: "抓取网页内容与搜索，让 Agent 具备 URL 访问能力",
      isMcp: false,
      loadMode: "lazy",
      type: "core",
    };
  }
}
