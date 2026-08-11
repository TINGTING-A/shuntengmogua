import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import {
  IToolProvider,
  ToolCallRequest,
  ToolProviderMetadata,
  ToolDisplayInfo,
} from "../interfaces/tool-provider.interface";
import { InternalToolDefinition } from "../../llm-core/types/llm.types";
import { UploadPathService } from "../../../common/services/upload-path.service";
import { UrlService } from "../../../common/services/url.service";

const REVEAL_CSS =
  "https://cdn.staticfile.org/reveal.js/4.6.1/reveal.min.css";
const REVEAL_JS = "https://cdn.staticfile.org/reveal.js/4.6.1/reveal.min.js";

/**
 * HTML 幻灯片工具提供者（frontend slides / html ppt studio）
 *
 * 用 reveal.js 生成单文件 HTML 网页幻灯片，浏览器打开即可演示：
 * 支持渐变/玻璃拟态/极简/暗色四种主题、翻页动画、代码高亮块、页码显示。
 * 视觉表现力远超 .pptx，适合要求炫酷/演示场合的内容。
 */
@Injectable()
export class HtmlSlidesToolProvider implements IToolProvider {
  private readonly logger = new Logger(HtmlSlidesToolProvider.name);
  public readonly namespace = "slides";

  private readonly toolsConfig: InternalToolDefinition[] = [
    {
      name: "generate_html_slides",
      description:
        "生成 HTML 网页幻灯片（浏览器演示，效果炫酷）。当用户要求'做一份漂亮的演示'『网页幻灯片』『PPT 要好看/高级/炫酷』或普通 PPT 效果不够时使用。需要提供标题和每页内容（页标题+要点，可含代码块），可选主题（tech 渐变科技感/glass 玻璃拟态/minimal 极简/dark 暗色）。生成后返回可打开的链接，浏览器打开即可全屏演示（←/→ 翻页）。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "演示文稿的标题/主题，将显示在封面页",
          },
          subtitle: {
            type: "string",
            description: "封面副标题（可选），如'产品发布会 2026'",
          },
          theme: {
            type: "string",
            enum: ["tech", "glass", "minimal", "dark"],
            description:
              "视觉主题：tech=渐变科技感、glass=玻璃拟态、minimal=极简白、dark=暗色高级，默认 tech",
          },
          pages: {
            type: "array",
            description:
              "演示内容页，按顺序排列。建议 4-12 页，每页一个核心观点，要点 2-6 条",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "本页标题（一句话核心观点）",
                },
                bullets: {
                  type: "array",
                  description: "本页要点列表，每条建议不超过 30 字",
                  items: { type: "string" },
                },
                code: {
                  type: "string",
                  description:
                    "本页要展示的代码块（可选），放在要点下方，适合技术分享",
                },
              },
              required: ["title"],
            },
          },
        },
        required: ["title", "pages"],
      },
    },
  ];

  constructor(
    private uploadPathService: UploadPathService,
    private urlService: UrlService,
  ) {}

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
    const handlers: Record<string, (args: any) => Promise<string>> = {
      generate_html_slides: this.handleGenerateSlides.bind(this),
    };
    const handler = handlers[request.name];
    if (!handler) {
      throw new Error(`未知工具：${request.name}`);
    }
    return await handler(request.arguments);
  }

  async getPrompt(context?: Record<string, any>): Promise<string> {
    return [
      "# HTML 网页幻灯片工具使用说明",
      "",
      "当用户要求'做一份漂亮的演示''网页幻灯片''PPT 要好看/高级/炫酷'时，使用 generate_html_slides 生成 HTML 网页幻灯片，而不是 generate_ppt（.pptx）。",
      "",
      "**使用步骤**：",
      "1. 明确主题：提炼标题与副标题",
      "2. 组织页面：4-12 页，每页一个核心观点；要点 2-6 条、每条不超过 30 字",
      "3. 选择主题：发布会/科技类用 tech（渐变科技感），产品展示用 glass（玻璃拟态），正式汇报用 minimal（极简），高端场合用 dark（暗色）",
      "4. 技术分享页可提供 code 代码块，展示效果更专业",
      "5. 调用工具后返回链接，告知用户'浏览器打开即可全屏演示（←/→ 翻页）'",
      "",
      "**要点规范**：",
      "- 数据型内容写成数字结论（如'覆盖 120+ 国家'）",
      "- 每页只讲一个主题，避免信息堆砌",
      "- 封面页和结尾页由工具自动生成",
      "- 内容要精炼，网页幻灯片大字号排版，文字过多会显得拥挤",
    ].join("\n");
  }

  async getBriefDescription(context?: Record<string, any>): Promise<string> {
    return "HTML 网页幻灯片工具，生成浏览器演示的炫酷幻灯片";
  }

  getMetadata(context?: Record<string, any>): ToolProviderMetadata {
    return {
      namespace: this.namespace,
      displayName: "HTML 网页幻灯片工具",
      description: "用 reveal.js 生成浏览器演示的 HTML 幻灯片",
      isMcp: false,
      loadMode: "eager",
      type: "core",
    };
  }

  formatDisplayMessage(
    toolName: string,
    args: Record<string, any>,
    isStreaming: boolean,
  ): ToolDisplayInfo | string {
    const prefix = isStreaming ? "正在" : "已";
    const title = args?.title ? String(args.title).slice(0, 20) : "";
    const pageCount = Array.isArray(args?.pages) ? args.pages.length : undefined;
    return {
      action: `${prefix}生成网页幻灯片`,
      args: title ? `${title}${pageCount ? `（${pageCount}页）` : ""}` : undefined,
      toolName: `slides__${toolName}`,
      toolType: this.namespace,
    };
  }

  /** 生成 HTML 幻灯片文件 */
  private async handleGenerateSlides(args: any): Promise<string> {
    const { title, subtitle, theme = "tech", pages } = args || {};

    if (!title || typeof title !== "string") {
      throw new Error("缺少参数：title（标题）不能为空");
    }
    const pageList = typeof pages === "string" ? JSON.parse(pages) : pages;
    if (!Array.isArray(pageList) || pageList.length === 0) {
      throw new Error("缺少参数：pages 必须是非空数组（每页含 title，可选 bullets/code）");
    }
    if (pageList.length > 24) {
      throw new Error("pages 页数过多（最多 24 页）");
    }

    const themeKey = ["tech", "glass", "minimal", "dark"].includes(theme)
      ? theme
      : "tech";

    const html = this.buildSlidesHtml(title, subtitle || "", themeKey, pageList);

    // 保存到上传目录
    const dir = this.uploadPathService.getPhysicalPath("files");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\..+/, "")
      .slice(0, 14);
    const filename = `slides_${stamp}.html`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, html, "utf-8");

    const storagePath = this.uploadPathService.getStoragePath("files", filename);
    const url = this.urlService.toResourceAbsoluteUrl(storagePath);
    this.logger.log(`HTML 幻灯片已生成: ${filePath} (${pageList.length + 2} 页)`);

    return JSON.stringify({
      success: true,
      message: `网页幻灯片已生成：${title}，共 ${pageList.length + 2} 页（含封面和结尾页），主题：${themeKey}。浏览器打开链接即可全屏演示（←/→ 翻页）`,
      title,
      file_path: storagePath,
      url,
      page_count: pageList.length + 2,
      tip: "浏览器打开后按 F 可全屏演示，按 ←/→ 翻页",
    });
  }

  /** 构建完整 HTML（reveal.js 单文件 + 内联内容 + 自定义主题） */
  private buildSlidesHtml(
    title: string,
    subtitle: string,
    theme: string,
    pages: any[],
  ): string {
    const themeCss = this.themeCss(theme);
    const sections: string[] = [];

    // 封面
    sections.push(
      `<section class="cover"><div class="cover-title">${this.esc(
        title,
      )}</div>${subtitle ? `<div class="cover-sub">${this.esc(subtitle)}</div>` : ""}<div class="cover-footer">顺藤摸瓜 AI 生成</div></section>`,
    );

    // 内容页
    pages.forEach((page, i) => {
      const t = this.esc(page.title || "");
      const bullets = Array.isArray(page.bullets)
        ? page.bullets
            .map((b: string) => `<li>${this.esc(String(b))}</li>`)
            .join("")
        : "";
      const code = page.code
        ? `<pre class="code-block"><code>${this.escHtmlCode(String(page.code))}</code></pre>`
        : "";
      sections.push(
        `<section><div class="page-num">${i + 1}</div><h2 class="page-title">${t}</h2>${
          bullets ? `<ul class="page-bullets">${bullets}</ul>` : ""
        }${code}</section>`,
      );
    });

    // 结尾
    sections.push(
      `<section class="end"><div class="end-title">谢谢观看</div><div class="end-sub">${this.esc(
        title,
      )}</div></section>`,
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.esc(title)}</title>
<link rel="stylesheet" href="${REVEAL_CSS}">
<style>
${themeCss}
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
${sections.join("\n")}
  </div>
</div>
<script src="${REVEAL_JS}"></script>
<script>
  Reveal.initialize({
    hash: true,
    slideNumber: true,
    transition: "slide",
    width: 1280,
    height: 720,
    margin: 0.06,
  });
</script>
</body>
</html>`;
  }

  /** 主题 CSS */
  private themeCss(theme: string): string {
    const base = `
.reveal { font-family: "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif; }
.reveal section { text-align: left; }
.reveal .cover, .reveal .end { text-align: center; }
.cover-title { font-size: 2.6em; font-weight: 800; letter-spacing: 2px; margin-bottom: 0.35em; }
.cover-sub { font-size: 1.15em; opacity: 0.85; margin-bottom: 1.2em; }
.cover-footer { font-size: 0.75em; opacity: 0.55; margin-top: 2.5em; }
.end-title { font-size: 2.8em; font-weight: 800; margin-bottom: 0.4em; }
.end-sub { font-size: 1.1em; opacity: 0.7; }
.page-num { position: absolute; top: 0.4em; right: 0.8em; font-size: 0.7em; opacity: 0.5; }
.page-title { font-size: 1.75em; font-weight: 700; margin: 0 0 0.6em 0; }
.page-bullets { list-style: none; margin: 0; padding: 0; }
.page-bullets li { font-size: 1.05em; line-height: 1.9; padding-left: 1.2em; position: relative; margin-bottom: 0.35em; }
.page-bullets li::before { content: "▸"; position: absolute; left: 0; opacity: 0.85; }
.code-block { font-size: 0.8em; margin-top: 0.8em; border-radius: 10px; overflow: hidden; }
.code-block code { display: block; padding: 0.9em 1.1em; line-height: 1.55; }
.reveal .controls { color: inherit; }
`;

    const themes: Record<string, string> = {
      // 渐变科技感：深蓝→紫渐变 + 霓虹青点缀
      tech: `
body { background: linear-gradient(135deg, #0a1628 0%, #1a1a3e 55%, #2d1b4e 100%); }
.reveal { color: #e8eefc; }
.reveal .slide-background { background: transparent; }
.cover-title { background: linear-gradient(90deg, #00e5ff, #a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent; }
.page-title { color: #00e5ff; }
.page-bullets li::before { color: #00e5ff; }
.code-block { background: rgba(0,0,0,0.45); border: 1px solid rgba(0,229,255,0.35); }
.reveal .controls { color: #00e5ff; }
.reveal .progress { color: #00e5ff; }
`,
      // 玻璃拟态：浅色渐变底 + 半透明毛玻璃卡片
      glass: `
body { background: linear-gradient(135deg, #e0eafc 0%, #cfdef3 50%, #f5f0ff 100%); }
.reveal { color: #1f2937; }
.reveal section { background: rgba(255,255,255,0.55); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.75); border-radius: 22px; padding: 1.6em 2em; box-shadow: 0 12px 40px rgba(90,120,200,0.18); }
.cover-title { color: #4f46e5; }
.page-title { color: #4f46e5; }
.page-bullets li::before { color: #4f46e5; }
.code-block { background: rgba(79,70,229,0.08); border: 1px solid rgba(79,70,229,0.25); }
`,
      // 极简白
      minimal: `
body { background: #ffffff; }
.reveal { color: #111827; }
.cover-title { color: #111827; }
.page-title { color: #111827; border-bottom: 3px solid #111827; display: inline-block; padding-bottom: 0.15em; }
.page-bullets li::before { color: #111827; }
.code-block { background: #f3f4f6; border: 1px solid #e5e7eb; }
.reveal .controls { color: #111827; }
.reveal .progress { color: #111827; }
`,
      // 暗色高级：黑底 + 金/白
      dark: `
body { background: #0b0b0f; }
.reveal { color: #f4f4f5; }
.cover-title { color: #f4f4f5; text-shadow: 0 0 40px rgba(212,175,55,0.35); }
.page-title { color: #d4af37; }
.page-bullets li::before { color: #d4af37; }
.code-block { background: #18181b; border: 1px solid #3f3f46; }
.reveal .controls { color: #d4af37; }
.reveal .progress { color: #d4af37; }
`,
    };

    return base + (themes[theme] || themes.tech);
  }

  private esc(s: string): string {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private escHtmlCode(s: string): string {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
