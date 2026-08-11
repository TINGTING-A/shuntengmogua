import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import { StressDataCollector } from "../services/stress-data-collector.service";
import { StressRuleEngine } from "../services/stress-rule-engine.service";
import { VoiceService } from "../services/voice.service";
import { ToolOrchestrator } from "../../tools/tool-orchestrator.service";
import { SpriteService } from "../../chat/sprite.service";
import { CrdtSyncService } from "../../personal-bus/services/crdt-sync.service";
import { E2EEService } from "../../personal-bus/services/e2ee.service";
import { BrowserUseService } from "../services/browser-use.service";
import { WebToolProvider } from "../../tools/providers/web-tool.provider";
import { GraphService } from "../services/graph.service";

@Injectable()
export class BrowserAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "browser-agent",
    name: "浏览器Agent",
    description: "网页访问与搜索：fetch_url 读取网页内容 + search_web 搜索 + Browser Use 云端(需API Key)",
    category: "connector",
    systemPrompt: `你是顺藤摸瓜的浏览器Agent，负责Web任务自动化。

引擎架构：
1. Web 工具（默认，无需配置）：
   - web__fetch_url: 访问 URL 并提取网页正文纯文本（Token 友好）
   - web__search_web: Bing 搜索，返回标题/链接/摘要
2. Browser Use（远程/云端，需 BROWSER_USE_API_KEY）：
   - 复杂网页采集、公开数据提取、多页爬取

Agent 操作模式（推荐工作流）：
1. 从任务中提取 URL（http/https 开头）或搜索关键词
2. 有 URL → fetch_url 读取网页内容
3. 无 URL 但需查资料 → search_web 搜索
4. 基于获取的真实内容回答用户，不编造网页内容

任务解析规则：
- 包含"打开/访问/导航/浏览/查看网址" → fetch_url 提取正文
- 包含"搜索/查询/查找资料/最新" → search_web 搜索
- 包含"采集/提取/抓取" → 云端 Browser Use 或 fetch_url`,

    capabilities: [
      { id: "web_automation", name: "网页访问", description: "fetch_url读取网页正文（无需配置）" },
      { id: "web_search", name: "网页搜索", description: "search_web Bing搜索（无需配置）" },
      { id: "content_extraction", name: "内容提取", description: "HTML清洗提取正文，Token友好" },
      { id: "cloud_browser", name: "云端浏览器", description: "Browser Use远程采集（需API Key）" },
    ],
    tools: [
      { name: "fetch_url", description: "访问URL提取网页正文" },
      { name: "search_web", description: "Bing搜索返回标题/链接/摘要" },
      { name: "extract_content", description: "提取页面内容（云端）" },
    ],
    version: "3.0.0",
  };

  constructor(
    private readonly toolOrchestrator: ToolOrchestrator,
    private readonly browserUseService: BrowserUseService,
    private readonly webToolProvider: WebToolProvider,
  ) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context } = input;

    try {
      const url = context?.url || this.extractUrl(task);
      const status = this.browserUseService.getStatus();

      // 云端模式优先（配置了 API Key 且任务适合云端采集）
      if (status.mode === "remote" && url && (task.includes("采集") || task.includes("爬取") || task.includes("竞品"))) {
        const result = await this.browserUseService.extractContent(url, context?.selector);
        return {
          success: true,
          result: { url, content: result.content?.substring(0, 2000), mode: "remote" },
          summary: `已通过云端采集 ${url}`,
          metadata: { mode: "remote" },
        };
      }

      // Web 工具（默认）：有 URL → fetch_url
      if (url) {
        const result = await this.webToolProvider.execute({
          id: `web_${Date.now()}`,
          name: "fetch_url",
          arguments: { url, maxLength: context?.maxLength || 5000 },
        });
        return {
          success: true,
          result: { url, content: result.slice(0, 4000) },
          summary: `已访问 ${url}，提取到 ${result.length} 字符内容`,
          metadata: { engine: "web-tool" },
        };
      }

      // 搜索任务 → search_web
      if (/搜索|查询|查找|search|最新|资料/i.test(task)) {
        const query = context?.query || task.replace(/搜索|查询|查找|search|请|帮我|一下/gi, "").trim().slice(0, 50);
        const result = await this.webToolProvider.execute({
          id: `web_${Date.now()}`,
          name: "search_web",
          arguments: { query, count: context?.count || 6 },
        });
        return {
          success: true,
          result: { query, content: result.slice(0, 4000) },
          summary: `已搜索「${query}」`,
          metadata: { engine: "web-tool" },
        };
      }

      // 无 URL 无搜索词：返回能力说明
      return {
        success: true,
        result: {
          message: `浏览器Agent收到任务: ${task}`,
          engine: "Web 工具（fetch_url / search_web）",
          hint: "请提供 URL（如：打开 https://example.com 并总结内容）或搜索关键词",
        },
        summary: "浏览器Agent就绪（Web工具引擎）",
        metadata: { engine: "web-tool" },
      };
    } catch (error: any) {
      return { success: false, result: null, error: error.message };
    }
  }

  private extractUrl(task: string): string {
    const urlMatch = task.match(/https?:\/\/[^\s，。、；：""'']+/);
    return urlMatch ? urlMatch[0].replace(/[)\]}>"'']+$/, "") : "";
  }
}

@Injectable()
export class KnowledgeGraphAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "knowledge-graph-agent",
    name: "知识图谱Agent",
    description: "GraphRAG知识建模：实体提取、关系识别、图谱检索(Neo4j/Kuzu)",
    category: "knowledge",
    systemPrompt: `你是顺藤摸瓜的知识图谱Agent，负责文档间的知识关系建模。

GraphRAG技术栈：
1. 实体提取：从文档中提取人物、组织、概念、事件等实体
2. 关系识别：识别实体间的引用/包含/关联/因果关系
3. 图谱存储：Neo4j图数据库 或 Kuzu嵌入式图库
4. 图谱检索：基于图遍历的知识检索，理解"文档A引用了表格B"的关系

与向量RAG互补：
- 向量RAG：语义相似度 → "听起来像"
- GraphRAG：实体关系 → "谁引用了什么，什么包含什么"
- 混合检索：向量+图谱联合得分，大幅减少AI幻觉

检索方式：
- 实体查询：找到与"Q3预算"相关的所有文档
- 关系路径：文档A → 引用 → 表格B → 数据来自 → 邮件C
- 社区发现：对相关文档自动分组`,
    capabilities: [
      { id: "entity_extraction", name: "实体提取", description: "从文档中提取实体" },
      { id: "relation_modeling", name: "关系建模", description: "识别实体间关系" },
      { id: "graph_retrieval", name: "图谱检索", description: "基于图关系的知识检索" },
    ],
    tools: [
      { name: "extract_entities", description: "提取实体和关系" },
      { name: "query_graph", description: "查询知识图谱" },
      { name: "find_relations", description: "查找实体间关系路径" },
    ],
    version: "1.0.0",
  };

  private inMemoryGraph: Map<string, {
    entity: string;
    type: string;
    relations: Array<{ target: string; relation: string }>;
  }> = new Map();

  constructor(private readonly graphService: GraphService) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task } = input;

    if (task.includes("提取") || task.includes("extract")) {
      return this.handleExtraction(input);
    }

    if (task.includes("查询") || task.includes("query") || task.includes("搜索")) {
      return this.handleQuery(task);
    }

    if (task.includes("关系") || task.includes("relation") || task.includes("路径")) {
      return this.handleRelationPath(task);
    }

    const stats = await this.graphService.getStats();
    return {
      success: true,
      result: { ...stats },
      summary: `图谱中现有${stats.nodeCount}个实体, ${stats.edgeCount}条关系 (模式: ${stats.mode})`,
    };
  }

  private async handleExtraction(input: AgentInput): Promise<AgentOutput> {
    const text = input.context?.text || input.task;
    if (!text || text.length < 10) {
      return { success: false, result: null, error: "文本太短，无法提取实体" };
    }

    const entities = this.simpleEntityExtract(text);
    let count = 0;

    for (const entity of entities) {
      await this.graphService.addEntity({
        id: entity.name,
        label: entity.name,
        type: entity.type,
        properties: {},
      });
      count++;

      for (const rel of entity.relations || []) {
        await this.graphService.addRelation({
          source: entity.name,
          target: rel,
          relation: "related_to",
        });
      }
    }

    const stats = await this.graphService.getStats();
    return {
      success: true,
      result: { extracted: count, ...stats, entities },
      summary: `提取了${count}个实体 (总计${stats.nodeCount}个)`,
    };
  }

  private async handleQuery(query: string): Promise<AgentOutput> {
    const matches = await this.graphService.searchEntities(
      query.replace(/查询|query|搜索/gi, "").trim() || query,
    );

    return {
      success: true,
      result: { query, count: matches.length, matches },
      summary: matches.length > 0
        ? `找到${matches.length}个匹配实体: ${matches.map((m) => m.label).join(", ")}`
        : "未找到匹配实体",
    };
  }

  private async handleRelationPath(entityName: string): Promise<AgentOutput> {
    const cleaned = entityName.replace(/查询|关系|路径|查找/gi, "").trim();
    const paths = await this.graphService.findRelations(cleaned);
    const stats = await this.graphService.getStats();

    return {
      success: true,
      result: { entity: cleaned, paths, ...stats },
      summary: `${cleaned} 有${paths.length}条关系${stats.mode === "kuzu" ? " (Kuzu图库)" : " (内存模式)"}`,
    };
  }

  private simpleEntityExtract(text: string): Array<{
    name: string;
    type: string;
    relations: string[];
  }> {
    const entities: Array<{ name: string; type: string; relations: string[] }> = [];
    const seen = new Set<string>();

    const patterns: Array<{ regex: RegExp; type: string }> = [
      { regex: /([A-Z][a-z]+ [A-Z][a-z]+)/g, type: "person" },
      { regex: /([A-Z\u4e00-\u9fff]{2,}(?:公司|集团|组织|团队|部门|研究院|大学|银行))/g, type: "organization" },
      { regex: /([A-Z\u4e00-\u9fff]{2,}(?:系统|平台|工具|框架|引擎|服务|协议|模型|算法))/g, type: "technology" },
      { regex: /([A-Z\u4e00-\u9fff]{2,}(?:项目|产品|功能|模块|组件))/g, type: "product" },
      { regex: /(Q[1-4]|第[一二三四]季度|20\d{2}年[上下半]年)/g, type: "time_period" },
      { regex: /([A-Z\u4e00-\u9fff]{2,}(?:预算|成本|收入|支出|利润|指标|KPI|OKR))/g, type: "metric" },
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1];
        if (!seen.has(name)) {
          seen.add(name);
          entities.push({ name, type, relations: [] });
        }
      }
    }

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const dist = Math.abs(text.indexOf(entities[i].name) - text.indexOf(entities[j].name));
        if (dist < 200) {
          entities[i].relations.push(entities[j].name);
          entities[j].relations.push(entities[i].name);
        }
      }
    }

    return entities;
  }
}

@Injectable()
export class VoiceAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "voice-agent",
    name: "语音Agent",
    description: "多模态语音交互：Whisper v3 STT + Fish Speech 1.4 TTS + 口型同步",
    category: "interaction",
    systemPrompt: `你是顺藤摸瓜的语音Agent，负责语音输入输出处理。

技术栈：
1. 语音识别(STT)：Whisper v3 Large，本地CPU/GPU推理，<500ms延迟
2. 语音合成(TTS)：Fish Speech 1.4，中文自然，支持情感语调控制
3. 口型同步：TTS音素流 → Morph Target映射（后续实现）

支持的语音情感：
- neutral 中性
- happy 开心
- sad 悲伤
- angry 生气
- fearful 害怕
- surprised 惊讶

约束：
- 所有语音数据本地处理，隐私零泄露
- 支持流式输出，减少首音延迟`,
    capabilities: [
      { id: "speech_to_text", name: "语音识别", description: "Whisper v3本地STT，<500ms延迟" },
      { id: "text_to_speech", name: "语音合成", description: "Fish Speech本地TTS，情感语调控制" },
      { id: "lip_sync", name: "口型同步", description: "TTS音素→Morph Target映射" },
    ],
    tools: [
      { name: "transcribe", description: "语音转文字" },
      { name: "synthesize", description: "文字转语音（带情感控制）" },
      { name: "health_check", description: "检查语音服务健康状态" },
    ],
    version: "1.0.0",
  };

  constructor(private readonly voiceService: VoiceService) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context } = input;

    if (task.includes("健康") || task.includes("health") || task.includes("状态")) {
      const health = await this.voiceService.healthCheck();
      return {
        success: true,
        result: health,
        summary: `STT: ${health.stt ? "正常" : "不可用"}, TTS: ${health.tts ? "正常" : "不可用"}`,
      };
    }

    if (task.includes("合成") || task.includes("tts") || task.includes("语音输出")) {
      const text = context?.text || task.replace(/合成|tts|语音输出/gi, "").trim();
      if (!text) {
        return { success: false, result: null, error: "缺少要合成的文本" };
      }

      const emotion = (context?.emotion as any) || "neutral";
      const audioBuffer = await this.voiceService.textToSpeech(text, { emotion });

      return {
        success: true,
        result: { audioSize: audioBuffer.length, text, emotion },
        summary: `已合成"${text.substring(0, 30)}..."(${emotion})`,
      };
    }

    if (context?.audioBuffer) {
      const text = await this.voiceService.speechToText(
        Buffer.from(context.audioBuffer, "base64"),
        { language: context?.language },
      );

      return {
        success: true,
        result: { text },
        summary: text.substring(0, 50),
      };
    }

    return {
      success: true,
      result: { message: "语音Agent就绪，请提供音频数据或合成请求" },
      summary: "语音Agent已就绪",
    };
  }
}

@Injectable()
export class SpriteAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "sprite-agent",
    name: "精灵Agent",
    description: "3D数字生命体：状态机驱动Morph Target表情 + 动画控制 + MAF状态联动",
    category: "interaction",
    systemPrompt: `你是顺藤摸瓜的精灵Agent，负责3D数字生命体的行为控制。`,
    capabilities: [
      { id: "expression_control", name: "表情控制", description: "Morph Target面部表情驱动" },
      { id: "animation_control", name: "动画控制", description: "5种动画状态切换" },
      { id: "maf_linkage", name: "MAF联动", description: "与工作流状态的实时联动" },
    ],
    tools: [
      { name: "set_expression", description: "设置精灵表情" },
      { name: "play_animation", description: "播放指定动画" },
      { name: "show_message", description: "显示精灵气泡消息" },
    ],
    version: "1.0.0",
  };

  constructor(private readonly spriteService: SpriteService) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context, userId, sessionId } = input;
    if (task.includes("消息") || task.includes("说话")) {
      const text = context?.text || task.replace(/消息|说话|显示/gi, "").trim();
      if (text && userId && sessionId) {
        this.spriteService.broadcastSpriteState(userId, sessionId, { mood: "idle", message: text });
      }
      return { success: true, result: { text }, summary: `精灵显示: ${text.substring(0, 30)}` };
    }
    return { success: true, result: {}, summary: "精灵Agent已就绪" };
  }
}

@Injectable()
export class StressAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "stress-agent",
    name: "压力监测Agent",
    description: "工作健康守护：4维特征采集 + 规则引擎加权评分 + 三级分级干预",
    category: "health",
    systemPrompt: `你是顺藤摸瓜的压力监测Agent，负责守护用户的工作健康。

监测维度（非侵入式）：
1. 回复速度下降：IM消息时间戳 → 注意力疲劳
2. 加班时长延长：系统在线时段 → 超负荷运转
3. 会议密度升高：日历数据 → 深度工作时间被挤占
4. 文档反复修改：编辑日志 → 决策犹豫、思路混乱

预警分级：
- 轻度(40-59分)：精灵温柔提醒
- 中度(60-79分)：精灵飞到屏幕中央关怀
- 重度(80-100分)：精灵强制提醒 + 建议休息

权重配置：回复速度0.30 + 加班时长0.25 + 会议密度0.25 + 文档修改0.20

设计原则：
- 零隐私泄露：所有数据本地处理，API不涉及原始数据
- 用户可控：干预级别可调配、可关闭
- 偏向关怀：宁可误报一次提醒，不可漏报一次崩溃`,
    capabilities: [
      { id: "feature_collection", name: "特征采集", description: "IM时间戳/日历/在线时长/文件编辑" },
      { id: "rule_engine", name: "规则引擎", description: "加权评分：回复速度0.3+加班0.25+会议0.25+文档0.2" },
      { id: "tiered_intervention", name: "分级干预", description: "轻度/中度/重度三级预警" },
    ],
    tools: [
      { name: "start_monitoring", description: "开始压力监测" },
      { name: "get_stress_score", description: "获取当前压力分数(0-100)" },
      { name: "configure_thresholds", description: "配置预警阈值" },
    ],
    version: "1.0.0",
  };

  constructor(
    private readonly dataCollector: StressDataCollector,
    private readonly ruleEngine: StressRuleEngine,
  ) {
    super();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, userId } = input;

    if (task.includes("阈值") || task.includes("threshold") || task.includes("灵敏度")) {
      return this.handleThresholdConfig(task);
    }

    const snapshot = this.dataCollector.computeSnapshot(userId || "default");
    const history = this.dataCollector.getSnapshots(userId || "default", 7);
    const score = this.ruleEngine.evaluate(snapshot, history);

    return {
      success: true,
      result: score,
      summary: `压力评分: ${score.total}/100 (${score.level}) - ${score.recommendation}`,
      metadata: { level: score.level, dimensions: score.dimensions },
    };
  }

  private handleThresholdConfig(task: string): AgentOutput {
    const numbers = task.match(/\d+/g)?.map(Number) || [];
    if (numbers.length >= 3) {
      this.ruleEngine.setThresholds({
        mild: numbers[0],
        moderate: numbers[1],
        severe: numbers[2],
      });
      return {
        success: true,
        result: this.ruleEngine.getThresholds(),
        summary: `阈值已更新: 轻度≥${numbers[0]}, 中度≥${numbers[1]}, 重度≥${numbers[2]}`,
      };
    }

    return {
      success: true,
      result: this.ruleEngine.getThresholds(),
      summary: `当前阈值: 轻度≥${this.ruleEngine.getThresholds().mild}, 中度≥${this.ruleEngine.getThresholds().moderate}, 重度≥${this.ruleEngine.getThresholds().severe}`,
    };
  }
}

@Injectable()
export class SyncAgent extends BaseSubAgent {
  readonly card: AgentCard = {
    id: "sync-agent", name: "同步Agent",
    description: "CRDT数据同步：Yjs实时同步 + E2EE端到端加密 + 冲突自动解决",
    category: "sync",
    systemPrompt: `你是顺藤摸瓜的同步Agent，负责数据的本地优先同步。Yjs CRDT + libsodium E2EE。`,
    capabilities: [
      { id: "crdt_sync", name: "CRDT同步", description: "Yjs离线编辑+联网自动合并" },
      { id: "e2ee_encrypt", name: "端到端加密", description: "XChaCha20-Poly1305 + Curve25519" },
      { id: "conflict_resolution", name: "冲突解决", description: "CRDT数学保证自动合并" },
    ],
    tools: [
      { name: "sync_document", description: "同步文档到其他设备" },
      { name: "get_sync_status", description: "获取同步状态" },
    ],
    version: "1.0.0",
  };
  constructor(private readonly crdt: CrdtSyncService, private readonly e2ee: E2EEService) { super(); }
  async execute(input: AgentInput): Promise<AgentOutput> {
    const docs = this.crdt.getAllDocumentIds();
    const hasKey = input.userId ? !!this.e2ee.getPublicKey(input.userId) : false;
    return { success: true, result: { docCount: docs.length, encReady: hasKey }, summary: `${docs.length}个文档, 加密${hasKey ? "已" : "未"}就绪` };
  }
}


