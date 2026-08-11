import { Injectable, Logger } from "@nestjs/common";

export interface SmartDocRequest {
  type: "ppt" | "word" | "excel";
  topic: string;
  style?: "professional" | "creative" | "technical" | "simple";
  language?: string;
  slides?: number;
  sections?: string[];
  data?: Record<string, any>;
}

export interface SmartDocResult {
  type: string;
  topic: string;
  content: string;
  format: "markdown" | "json" | "csv";
  metadata: {
    generatedAt: string;
    style: string;
    wordCount: number;
  };
}

const STYLE_PROMPTS: Record<string, string> = {
  professional: "使用正式专业的商务语言，适合企业汇报场景",
  creative: "使用生动活泼的表达方式，适合创意展示场景",
  technical: "使用精确的技术语言，包含数据和指标，适合技术文档场景",
  simple: "使用简洁明了的表达，适合快速阅读场景",
};

const PPT_SYSTEM_PROMPT = `你是专业的PPT内容生成器。请根据主题生成每页幻灯片的具体内容。每页用 --- 分隔。
输出格式：
# 标题页
- 主标题
- 副标题
- 汇报人信息

# 每一页
- 页面标题
- 3-5个关键要点
- 数据或案例支撑`;

const WORD_SYSTEM_PROMPT = `你是专业的文档撰写助手。请生成结构完整的文档内容。
包含：摘要、正文章节、结论。每个章节要内容丰富、有具体数据和论据。`;

@Injectable()
export class SmartDocService {
  private readonly logger = new Logger(SmartDocService.name);

  constructor() {}

  async generateDoc(
    request: SmartDocRequest,
    context?: { llmService?: any },
  ): Promise<SmartDocResult> {
    const { type, topic, style = "professional" } = request;
    const llmService = context?.llmService;

    switch (type) {
      case "ppt":
        return this.generatePPT(topic, style, request.slides, llmService);
      case "word":
        return this.generateWord(topic, style, request.sections, llmService);
      case "excel":
        return this.generateExcel(topic, style, request.data, llmService);
      default:
        throw new Error(`Unsupported document type: ${type}`);
    }
  }

  private async generatePPT(
    topic: string,
    style: string,
    slideCount?: number,
    llmService?: any,
  ): Promise<SmartDocResult> {
    const slides = slideCount || 8;
    let content: string;

    if (llmService && typeof llmService.chat === "function") {
      content = await this.generateWithLLM(
        llmService,
        PPT_SYSTEM_PROMPT,
        `主题: ${topic}\n风格: ${STYLE_PROMPTS[style] || STYLE_PROMPTS.professional}\n页数: ${slides}\n请生成完整的PPT内容，每页独立。`,
        "ppt",
      );
    } else {
      content = this.buildPPTOutline(topic, slides, style);
    }

    return {
      type: "ppt", topic, content, format: "markdown",
      metadata: { generatedAt: new Date().toISOString(), style, wordCount: content.length },
    };
  }

  private async generateWord(
    topic: string,
    style: string,
    sections?: string[],
    llmService?: any,
  ): Promise<SmartDocResult> {
    let content: string;
    const sectionHint = sections?.length ? `建议章节: ${sections.join(", ")}` : "";

    if (llmService && typeof llmService.chat === "function") {
      content = await this.generateWithLLM(
        llmService,
        WORD_SYSTEM_PROMPT,
        `主题: ${topic}\n风格: ${STYLE_PROMPTS[style] || STYLE_PROMPTS.professional}\n${sectionHint}\n请生成结构完整的文档内容。`,
        "word",
      );
    } else {
      content = this.buildWordOutline(topic, sections, style);
    }

    return {
      type: "word", topic, content, format: "markdown",
      metadata: { generatedAt: new Date().toISOString(), style, wordCount: content.length },
    };
  }

  private async generateExcel(
    topic: string,
    style: string,
    data?: Record<string, any>,
    llmService?: any,
  ): Promise<SmartDocResult> {
    let content: string;

    const DELIMITER = ",";
    const escapeCsv = (v: string) => v.includes(DELIMITER) || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

    if (llmService && typeof llmService.chat === "function" && data?.prompt) {
      const csvPrompt = `请将以下内容转换为CSV表格格式（逗号分隔），包含表头:
${data.prompt}

只输出CSV内容，不要额外说明。`;
      try {
        const raw = await llmService.chat([{ role: "user", content: csvPrompt }]);
        content = raw?.content || raw || this.buildCSVFallback(topic);
      } catch {
        content = this.buildCSVFallback(topic);
      }
    } else {
      const headers = data?.headers || ["项目", "数值", "备注"];
      const rows = data?.rows || [["示例数据1", "100", ""], ["示例数据2", "200", ""]];
      content = [headers.map(escapeCsv).join(DELIMITER), ...rows.map((r: any) => r.map(escapeCsv).join(DELIMITER))].join("\n");
    }

    return {
      type: "excel", topic, content, format: "csv",
      metadata: { generatedAt: new Date().toISOString(), style, wordCount: content.length },
    };
  }

  private async generateWithLLM(
    llmService: any,
    systemPrompt: string,
    userPrompt: string,
    fallbackType: "ppt" | "word",
  ): Promise<string> {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
      const result = await llmService.chat(messages);
      return result?.content || result || this.buildFallback(userPrompt, fallbackType);
    } catch (error: any) {
      this.logger.warn(`LLM generation failed: ${error.message}, using template fallback`);
      return this.buildFallback(userPrompt, fallbackType);
    }
  }

  private buildPPTOutline(topic: string, slides: number, style: string): string {
    const styleSuffix = style === "creative" ? "（创意视角）" : style === "technical" ? "（技术分析）" : "";
    const lines = [
      `# ${topic}${styleSuffix}\n\n**汇报人：** 顺藤摸瓜 AI\n\n**日期：** ${new Date().toLocaleDateString("zh-CN")}\n\n**风格：** ${style}`,
      `## 目录\n\n${Array.from({ length: slides - 2 }, (_, i) => `${i + 1}. **第${i + 1}部分** - ${topic}深度分析`).join("\n")}`,
    ];

    for (let i = 0; i < slides - 2; i++) {
      const sections = [
        { title: "背景概览", bullets: ["行业趋势分析", "关键数据回顾", "核心挑战识别"] },
        { title: "数据洞察", bullets: ["量化指标对比", "增长曲线分析", "异常点识别"] },
        { title: "方案建议", bullets: ["短期行动计划", "中期战略调整", "风险评估与应对"] },
        { title: "执行路径", bullets: ["里程碑设定", "资源配置建议", "验收标准"] },
        { title: "风险预案", bullets: ["最大风险识别", "缓解措施矩阵", "应急响应流程"] },
        { title: "总结展望", bullets: ["核心结论", "下一步行动", "预期成果"] },
      ];
      const s = sections[i % sections.length];
      lines.push(`## ${s.title}\n\n${s.bullets.map((b) => `- ${b}`).join("\n")}`);
    }

    return lines.join("\n\n---\n\n");
  }

  private buildWordOutline(topic: string, sections?: string[], _style?: string): string {
    const parts = [
      `# ${topic}\n\n## 摘要\n\n本文档由**顺藤摸瓜 AI**自动生成，围绕"${topic}"展开深度分析与专业论述，为企业决策提供数据支撑与行动建议。\n\n---\n`,
    ];

    const sectionList = sections?.length
      ? sections
      : ["背景与现状", "核心分析", "解决方案", "实施路径", "风险管控", "总结展望"];

    const templates: Record<string, string> = {
      "背景与现状": "当前行业格局正在经历深刻变革...\n\n### 关键数据\n\n- 市场规模持续增长\n- 技术成熟度加速提升\n- 竞争格局趋于多元\n\n### 主要发现\n\n经过系统调研与数据分析，我们识别出以下关键趋势...",
      "核心分析": "### 分析维度\n\n- 维度一: 战略匹配度分析\n- 维度二: 资源可行性评估\n- 维度三: 竞争力对比研究\n\n### 深度洞察\n\n通过多维度交叉分析，我们发现...",
      "解决方案": "### 推荐方案\n\n基于上述分析，提出以下分阶段解决方案：\n\n1. **短期（1-3个月）**：快速见效措施\n2. **中期（3-6个月）**：体系化建设\n3. **长期（6-12个月）**：战略级转型\n\n每阶段包含具体行动项、责任人、时间节点和验收标准。",
      "实施路径": "### 里程碑规划\n\n| 阶段 | 时间 | 目标 | 交付物 |\n|------|------|------|--------|\n| Phase 1 | M1-M3 | 基础设施搭建 | 系统上线 |\n| Phase 2 | M4-M6 | 核心能力建设 | 功能完备 |\n| Phase 3 | M7-M12 | 规模化推广 | 全量覆盖 |",
      "风险管控": "### 风险矩阵\n\n识别并评估关键风险：\n\n- **高风险事项**：需要最高关注\n- **中风险事项**：持续监控\n- **低风险事项**：常规跟踪\n\n### 应对策略\n\n每项风险均配备预防措施和应急响应方案。",
      "总结展望": "### 核心结论\n\n综合以上分析，得出以下核心结论...\n\n### 建议行动\n\n1. 立即启动...\n2. 持续关注...\n3. 定期评估...\n\n### 预期成果\n\n按本方案推进，预期在12个月内实现...",
    };

    for (const section of sectionList) {
      const content = templates[section] || `## ${section}\n\n关于"${topic}"的${section}相关内容分析...\n\n> 此部分建议连接LLM服务以获得更丰富的内容。`;
      parts.push(`## ${section}\n\n${content}\n\n---\n`);
    }

    return parts.join("\n");
  }

  private buildCSVFallback(topic: string): string {
    const headers = ["类别", "指标", "当前值", "目标值", "趋势", "建议"];
    const rows = [
      ["业务", "用户增长", "15%", "25%", "↑", "加大市场投入"],
      ["技术", "系统可用性", "99.5%", "99.9%", "→", "架构升级"],
      ["财务", "成本控制", "85万/月", "70万/月", "↓", "优化资源配置"],
      ["团队", "人效比", "1:8", "1:12", "↑", "引入AI辅助"],
    ];
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  private buildFallback(prompt: string, type: "ppt" | "word" = "ppt"): string {
    const topic = prompt.split("\n")[0]?.replace(/主题:|Topic:/, "").trim() || "AI自生成文档";
    if (type === "word") {
      return this.buildWordOutline(topic);
    }
    return this.buildPPTOutline(topic, 8, "professional");
  }
}
