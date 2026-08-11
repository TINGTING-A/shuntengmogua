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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require("pptxgenjs");

interface ThemePalette {
  bg: string;
  card: string;
  primary: string;
  secondary: string;
  text: string;
  subText: string;
  line: string;
}

const THEMES: Record<string, ThemePalette> = {
  // 科技感：深蓝渐变 + 霓虹青 + 粉点缀
  tech: {
    bg: "0A1628",
    card: "12294A",
    primary: "00E5FF",
    secondary: "FB7299",
    text: "FFFFFF",
    subText: "B8C4D6",
    line: "1E3A5F",
  },
  // 商务：藏青 + 金强调
  business: {
    bg: "1B2A41",
    card: "24344E",
    primary: "D4AF37",
    secondary: "7FB3D5",
    text: "FFFFFF",
    subText: "C3CBD9",
    line: "33476B",
  },
  // 简约：白底 + 深灰文字 + 蓝强调
  minimal: {
    bg: "FFFFFF",
    card: "F2F4F8",
    primary: "2563EB",
    secondary: "64748B",
    text: "1F2937",
    subText: "6B7280",
    line: "E5E7EB",
  },
  // 归藏杂志风：米白底 + 黑金 + 高级排版（参考"归藏"PPT 风格方法论）
  guizang: {
    bg: "FAF7F0",
    card: "FFFFFF",
    primary: "1A1A1A",
    secondary: "B08D57",
    text: "1A1A1A",
    subText: "6B6355",
    line: "E8E2D6",
  },
};

/**
 * PPT 生成工具提供者
 *
 * 根据用户提供的主题与分页内容，直接生成 .pptx 文件并保存到上传目录，
 * 返回可下载的 URL。内置科技感/商务/简约三种主题模板。
 */
@Injectable()
export class PptToolProvider implements IToolProvider {
  private readonly logger = new Logger(PptToolProvider.name);
  public readonly namespace = "ppt";

  private readonly toolsConfig: InternalToolDefinition[] = [
    {
      name: "generate_ppt",
      description:
        "生成 PowerPoint (.pptx) 演示文稿文件。当用户要求'生成PPT''做一份演示文稿''把内容做成幻灯片'时使用。需要提供标题、每页内容（页标题+要点），可选主题风格（tech 科技感/business 商务/minimal 简约）。生成后返回可下载的文件链接。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "PPT 的标题/主题，将显示在封面页",
          },
          subtitle: {
            type: "string",
            description: "封面副标题（可选），如'2026年度汇报'",
          },
          theme: {
            type: "string",
            enum: ["tech", "business", "minimal", "guizang"],
            description:
              "主题风格：tech=科技感（深蓝霓虹）、business=商务（藏青金）、minimal=简约、guizang=归藏杂志风（米白黑金高级排版），默认 tech",
          },
          pages: {
            type: "array",
            description: "PPT 内容页，按顺序排列。建议 4-10 页，每页一个核心观点，要点 2-6 条",
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
      generate_ppt: this.handleGeneratePpt.bind(this),
    };
    const handler = handlers[request.name];
    if (!handler) {
      throw new Error(`未知工具：${request.name}`);
    }
    return await handler(request.arguments);
  }

  async getPrompt(context?: Record<string, any>): Promise<string> {
    return [
      "# PPT 生成工具使用说明",
      "",
      "当用户要求'生成PPT''做一份演示文稿''把内容做成幻灯片'时，使用 generate_ppt 工具直接生成 .pptx 文件，而不是只给文字建议。",
      "",
      "**使用步骤**：",
      "1. 明确主题：从用户描述中提炼标题，必要时补充副标题",
      "2. 组织页面：4-10 页，每页一个核心观点；页标题用一句话概括，要点 2-6 条、每条不超过 30 字",
      "3. 选择风格：默认 tech（科技感深蓝霓虹），商务汇报用 business，简洁场合用 minimal，追求高级杂志感用 guizang（归藏风格：米白黑金排版）",
      "4. 调用工具后将返回下载链接，在回复中告知用户文件已生成并提供链接",
      "",
      "**要点规范**：",
      "- 数据型内容写成数字结论（如'营收增长 32%'）",
      "- 每页只讲一个主题，避免信息堆砌",
      "- 封面页由工具自动生成，不需要单独传入",
    ].join("\n");
  }

  async getBriefDescription(context?: Record<string, any>): Promise<string> {
    return "PPT 生成工具，直接产出 .pptx 演示文稿文件";
  }

  getMetadata(context?: Record<string, any>): ToolProviderMetadata {
    return {
      namespace: this.namespace,
      displayName: "PPT 生成工具",
      description: "根据内容直接生成 .pptx 演示文稿",
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
      action: `${prefix}生成PPT`,
      args: title ? `${title}${pageCount ? `（${pageCount}页）` : ""}` : undefined,
      toolName: `ppt__${toolName}`,
      toolType: this.namespace,
    };
  }

  /**
   * 生成 PPT 文件
   */
  private async handleGeneratePpt(args: any): Promise<string> {
    const { title, subtitle, theme = "tech", pages } = args || {};

    if (!title || typeof title !== "string") {
      throw new Error("缺少参数：title（PPT 标题）不能为空");
    }
    const pageList = typeof pages === "string" ? JSON.parse(pages) : pages;
    if (!Array.isArray(pageList) || pageList.length === 0) {
      throw new Error("缺少参数：pages 必须是非空数组（每页含 title，可选 bullets）");
    }
    if (pageList.length > 20) {
      throw new Error("pages 页数过多（最多 20 页）");
    }

    const palette = THEMES[theme] || THEMES.tech;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "顺藤摸瓜 AI";
    pptx.company = "顺藤摸瓜";

    // 封面页
    this.addCoverSlide(pptx, palette, title, subtitle || "");
    // 内容页
    pageList.forEach((page: any, index: number) => {
      this.addContentSlide(pptx, palette, page, index + 1, pageList.length);
    });
    // 结尾页
    this.addEndSlide(pptx, palette, title);

    // 保存到上传目录
    const dir = this.uploadPathService.getPhysicalPath("files");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\..+/, "")
      .slice(0, 14);
    const filename = `ppt_${stamp}.pptx`;
    const filePath = path.join(dir, filename);
    await pptx.writeFile({ fileName: filePath });

    const storagePath = this.uploadPathService.getStoragePath("files", filename);
    const url = this.urlService.toResourceAbsoluteUrl(storagePath);
    this.logger.log(`PPT 已生成: ${filePath} (${pageList.length + 2} 页)`);

    return JSON.stringify({
      success: true,
      message: `PPT 已生成：${title}，共 ${pageList.length + 2} 页（含封面和结尾页），风格：${theme}`,
      title,
      file_path: storagePath,
      url,
      page_count: pageList.length + 2,
    });
  }

  private addCoverSlide(
    pptx: any,
    p: ThemePalette,
    title: string,
    subtitle: string,
  ) {
    const slide = pptx.addSlide();
    slide.background = { color: p.bg };
    // 装饰：顶部霓虹线 + 右上装饰块
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 0.6,
      w: 2.6,
      h: 0.05,
      fill: { color: p.primary },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 11.4,
      y: 0.5,
      w: 1.35,
      h: 0.1,
      fill: { color: p.secondary },
    });
    // 标题
    slide.addText(title, {
      x: 0.8,
      y: 2.6,
      w: 11.7,
      h: 1.6,
      fontSize: 34,
      bold: true,
      color: p.text,
      align: "left",
      valign: "middle",
      fontFace: "Microsoft YaHei",
    });
    // 副标题
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.85,
        y: 4.15,
        w: 10,
        h: 0.6,
        fontSize: 16,
        color: p.subText,
        align: "left",
        fontFace: "Microsoft YaHei",
      });
    }
    // 底部信息
    slide.addText("顺藤摸瓜 AI 智能助手", {
      x: 0.85,
      y: 6.5,
      w: 5,
      h: 0.4,
      fontSize: 11,
      color: p.subText,
      fontFace: "Microsoft YaHei",
    });
    // 装饰圆点
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 11.9,
      y: 6.1,
      w: 0.5,
      h: 0.5,
      fill: { color: p.primary, transparency: 40 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 12.5,
      y: 6.5,
      w: 0.32,
      h: 0.32,
      fill: { color: p.secondary, transparency: 30 },
    });
  }

  private addContentSlide(
    pptx: any,
    p: ThemePalette,
    page: any,
    index: number,
    total: number,
  ) {
    const slide = pptx.addSlide();
    slide.background = { color: p.bg };

    // 左上角编号
    slide.addText(String(index).padStart(2, "0"), {
      x: 0.6,
      y: 0.55,
      w: 1.0,
      h: 0.5,
      fontSize: 15,
      bold: true,
      color: p.primary,
      fontFace: "Consolas",
    });
    // 页标题
    const pageTitle = page?.title || `第 ${index} 页`;
    slide.addText(pageTitle, {
      x: 1.6,
      y: 0.45,
      w: 10.6,
      h: 0.7,
      fontSize: 22,
      bold: true,
      color: p.text,
      valign: "middle",
      fontFace: "Microsoft YaHei",
    });
    // 标题下霓虹线
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.65,
      y: 1.25,
      w: 3.2,
      h: 0.045,
      fill: { color: p.primary },
    });

    // 要点区
    const bullets: any[] = Array.isArray(page?.bullets) ? page.bullets : [];
    const bulletTexts = bullets.map((b: any, i: number) => ({
      text: String(b),
      options: {
        bullet: { code: "25CF", indent: 18 },
        fontSize: 17,
        color: p.text,
        paraSpaceAfter: 16,
        breakLine: false,
        fontFace: "Microsoft YaHei",
      },
    }));
    if (bulletTexts.length === 0) {
      bulletTexts.push({
        text: "（本页无要点内容）",
        options: { fontSize: 15, color: p.subText, italic: true } as any,
      });
    }
    slide.addText(bulletTexts, {
      x: 0.85,
      y: 1.65,
      w: 11.6,
      h: 4.4,
      valign: "top",
      align: "left",
    });

    // 底部装饰条 + 页码
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.15,
      w: 13.33,
      h: 0.06,
      fill: { color: p.line },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.15,
      w: 4.0,
      h: 0.06,
      fill: { color: p.primary },
    });
    slide.addText(`${index} / ${total}`, {
      x: 12.0,
      y: 6.9,
      w: 1.2,
      h: 0.35,
      fontSize: 10,
      color: p.subText,
      align: "right",
      fontFace: "Consolas",
    });
  }

  private addEndSlide(pptx: any, p: ThemePalette, title: string) {
    const slide = pptx.addSlide();
    slide.background = { color: p.bg };
    slide.addShape(pptx.ShapeType.rect, {
      x: 5.6,
      y: 3.1,
      w: 2.1,
      h: 0.05,
      fill: { color: p.primary },
    });
    slide.addText("谢谢观看", {
      x: 0.8,
      y: 3.4,
      w: 11.7,
      h: 1.0,
      fontSize: 32,
      bold: true,
      color: p.text,
      align: "center",
      fontFace: "Microsoft YaHei",
    });
    slide.addText(title, {
      x: 0.8,
      y: 4.5,
      w: 11.7,
      h: 0.6,
      fontSize: 14,
      color: p.subText,
      align: "center",
      fontFace: "Microsoft YaHei",
    });
  }
}
