import { Module, OnModuleInit, Logger, forwardRef } from "@nestjs/common";
import { LlmCoreModule } from "../llm-core/providers.module";
import { ChatModule } from "../chat/chat.module";
import { PersonalBusModule } from "../personal-bus/personal-bus.module";
import { ToolsModule } from "../tools/tools.module";
import { AuthModule } from "../auth/auth.module";
import { AgentRegistryService } from "./agent-registry.service";
import { Mem0Service } from "./mem0.service";
import { StressDataCollector } from "./services/stress-data-collector.service";
import { StressRuleEngine } from "./services/stress-rule-engine.service";
import { VoiceService } from "./services/voice.service";
import { AgentsController } from "./agents.controller";
import { SmartDocService } from "./services/smart-doc.service";
import { FullChainService } from "./services/full-chain.service";
import { BrowserUseService } from "./services/browser-use.service";
import { ConnectorEventService } from "./services/connector-event.service";
import { GraphService } from "./services/graph.service";
import { DingTalkAgent, FeishuAgent, WecomAgent, WpsAgent } from "./sub-agents/enterprise-agents";

import { PlanningAgent } from "./sub-agents/planning-agent";
import { FileAgent } from "./sub-agents/file-agent";
import { SearchAgent } from "./sub-agents/search-agent";
import { MemoryAgent } from "./sub-agents/memory-agent";
import {
  BrowserAgent,
  KnowledgeGraphAgent,
  VoiceAgent,
  SpriteAgent,
  StressAgent,
  SyncAgent,
} from "./sub-agents/stub-agents";
import { WechatAgent } from "./sub-agents/wechat-agent";
import { NotionAgent } from "./sub-agents/notion-agent";
import { EmailAgent } from "./sub-agents/email-agent";
import {
  WriteDocumentAgent,
  TranslateTextAgent,
  SummarizeContentAgent,
  SearchKnowledgeAgent,
  ExtractInfoAgent,
  WriteEmailAgent,
  CodeReviewAgent,
  GenerateImagePromptAgent,
  ScheduleTaskAgent,
  AnalyzeDataAgent,
  BrainstormAgent,
  DailyAssistantAgent,
} from "./sub-agents/skills-agents";
import { VoiceController } from "./voice.controller";
import { SmartDocController } from "./smart-doc.controller";
import { SpriteController } from "./sprite.controller";
import { FullChainController } from "./full-chain.controller";

@Module({
  imports: [LlmCoreModule, PersonalBusModule, ToolsModule, AuthModule, forwardRef(() => ChatModule)],
  controllers: [AgentsController, VoiceController, SmartDocController, SpriteController, FullChainController],
  providers: [
    AgentRegistryService,
    Mem0Service,
    StressDataCollector,
    StressRuleEngine,
    VoiceService,
    PlanningAgent,
    FileAgent,
    SearchAgent,
    MemoryAgent,
    BrowserAgent,
    KnowledgeGraphAgent,
    VoiceAgent,
    SpriteAgent,
    StressAgent,
    SyncAgent,
    WechatAgent,
    NotionAgent,
    EmailAgent,
    DingTalkAgent,
    FeishuAgent,
    WecomAgent,
    WpsAgent,
    WriteDocumentAgent,
    TranslateTextAgent,
    SummarizeContentAgent,
    SearchKnowledgeAgent,
    ExtractInfoAgent,
    WriteEmailAgent,
    CodeReviewAgent,
    GenerateImagePromptAgent,
    ScheduleTaskAgent,
    AnalyzeDataAgent,
    BrainstormAgent,
    DailyAssistantAgent,
    SmartDocService,
    FullChainService,
    BrowserUseService,
    ConnectorEventService,
    GraphService,
  ],
  exports: [AgentRegistryService, Mem0Service, VoiceService, SmartDocService, FullChainService, BrowserUseService, ConnectorEventService, GraphService],
})
export class AgentsModule implements OnModuleInit {
  private readonly logger = new Logger(AgentsModule.name);

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly planningAgent: PlanningAgent,
    private readonly fileAgent: FileAgent,
    private readonly searchAgent: SearchAgent,
    private readonly memoryAgent: MemoryAgent,
    private readonly browserAgent: BrowserAgent,
    private readonly knowledgeGraphAgent: KnowledgeGraphAgent,
    private readonly voiceAgent: VoiceAgent,
    private readonly spriteAgent: SpriteAgent,
    private readonly stressAgent: StressAgent,
    private readonly syncAgent: SyncAgent,
    private readonly wechatAgent: WechatAgent,
    private readonly notionAgent: NotionAgent,
    private readonly emailAgent: EmailAgent,
    private readonly dingTalkAgent: DingTalkAgent,
    private readonly feishuAgent: FeishuAgent,
    private readonly wecomAgent: WecomAgent,
    private readonly wpsAgent: WpsAgent,
    private readonly writeDocumentAgent: WriteDocumentAgent,
    private readonly translateTextAgent: TranslateTextAgent,
    private readonly summarizeContentAgent: SummarizeContentAgent,
    private readonly searchKnowledgeAgent: SearchKnowledgeAgent,
    private readonly extractInfoAgent: ExtractInfoAgent,
    private readonly writeEmailAgent: WriteEmailAgent,
    private readonly codeReviewAgent: CodeReviewAgent,
    private readonly generateImagePromptAgent: GenerateImagePromptAgent,
    private readonly scheduleTaskAgent: ScheduleTaskAgent,
    private readonly analyzeDataAgent: AnalyzeDataAgent,
    private readonly brainstormAgent: BrainstormAgent,
    private readonly dailyAssistantAgent: DailyAssistantAgent,
  ) {}

  onModuleInit() {
    const agents = [
      this.planningAgent,
      this.fileAgent,
      this.searchAgent,
      this.memoryAgent,
      this.browserAgent,
      this.knowledgeGraphAgent,
      this.voiceAgent,
      this.spriteAgent,
      this.stressAgent,
      this.syncAgent,
      this.wechatAgent,
      this.notionAgent,
      this.emailAgent,
      this.dingTalkAgent,
      this.feishuAgent,
      this.wecomAgent,
      this.wpsAgent,
      this.writeDocumentAgent,
      this.translateTextAgent,
      this.summarizeContentAgent,
      this.searchKnowledgeAgent,
      this.extractInfoAgent,
      this.writeEmailAgent,
      this.codeReviewAgent,
      this.generateImagePromptAgent,
      this.scheduleTaskAgent,
      this.analyzeDataAgent,
      this.brainstormAgent,
      this.dailyAssistantAgent,
    ];

    for (const agent of agents) {
      this.registry.register(agent);
    }

    this.logger.log(`AgentsModule initialized: ${this.registry.getAgentCount()} agents registered`);
  }
}
