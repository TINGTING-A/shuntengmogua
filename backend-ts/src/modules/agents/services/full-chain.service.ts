import { Injectable, Logger } from "@nestjs/common";
import { AgentRegistryService } from "../agent-registry.service";
import { SpriteService } from "../../chat/sprite.service";
import { VoiceService } from "../services/voice.service";
import { StressDataCollector } from "../services/stress-data-collector.service";
import { StressRuleEngine } from "../services/stress-rule-engine.service";
import { Mem0Service } from "../mem0.service";
import type { AgentInput } from "../base-agent";

export interface PipelineContext {
  userId: string;
  sessionId: string;
  task: string;
  onProgress?: (step: string, progress: number) => void;
  onVoice?: (text: string, emotion?: string) => void;
  onSprite?: (mood: string, message: string) => void;
  onStress?: (score: number, level: string) => void;
}

export interface PipelineResult {
  success: boolean;
  steps: PipelineStep[];
  summary: string;
  stressScore?: number;
  memoriesExtracted?: number;
}

export interface PipelineStep {
  name: string;
  status: "running" | "completed" | "failed";
  result?: any;
  duration?: number;
  error?: string;
}

@Injectable()
export class FullChainService {
  private readonly logger = new Logger(FullChainService.name);

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly spriteService: SpriteService,
    private readonly voiceService: VoiceService,
    private readonly stressCollector: StressDataCollector,
    private readonly stressEngine: StressRuleEngine,
    private readonly mem0Service: Mem0Service,
  ) {}

  async executePipeline(ctx: PipelineContext): Promise<PipelineResult> {
    const steps: PipelineStep[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Analyse + route intent
      steps.push({ name: "intent_analysis", status: "running" });
      ctx.onProgress?.("intent_analysis", 10);
      ctx.onSprite?.("thinking", "正在分析你的需求...");
      this.spriteService.broadcastAgentThinking(ctx.userId, ctx.sessionId, "正在分析意图...");

      const match = this.registry.findBestAgent(ctx.task);
      const agentId = match?.agentId || "planning-agent";
      steps[0] = { name: "intent_analysis", status: "completed", result: { agentId, score: match?.score } };

      // Step 2: Execute via MAF orchestrator
      steps.push({ name: "maf_execution", status: "running" });
      ctx.onProgress?.("maf_execution", 30);
      ctx.onSprite?.("thinking", "正在执行任务...");
      this.spriteService.broadcastToolExecuting(ctx.userId, ctx.sessionId, agentId, 0.3);

      const input: AgentInput = { task: ctx.task, userId: ctx.userId, sessionId: ctx.sessionId };
      const agentResult = await this.registry.executeAgent(agentId, input);

      steps[1] = {
        name: "maf_execution",
        status: agentResult.success ? "completed" : "failed",
        result: agentResult,
        error: agentResult.error,
      };

      // Step 3: Sprite + Voice notification
      steps.push({ name: "sprite_notification", status: "running" });
      ctx.onProgress?.("sprite_notification", 70);

      if (agentResult.success) {
        const statusMessage = agentResult.summary || "任务完成";

        ctx.onSprite?.("happy", statusMessage);
        this.spriteService.broadcastTaskComplete(ctx.userId, ctx.sessionId, statusMessage);

        try {
          await this.voiceService.textToSpeech(statusMessage, { emotion: "happy" });
          ctx.onVoice?.(statusMessage, "happy");
        } catch {
          this.logger.debug("Voice TTS not available for pipeline notification");
        }
      } else {
        ctx.onSprite?.("sad", agentResult.error || "任务执行失败");
      }

      steps[2] = { name: "sprite_notification", status: "completed" };

      // Step 4: Health metrics update
      steps.push({ name: "health_check", status: "running" });
      ctx.onProgress?.("health_check", 85);

      this.stressCollector.recordSignal(ctx.userId, {
        timestamp: new Date().toISOString(),
        source: "custom",
        value: steps.filter((s) => s.status === "completed").length,
        metadata: { pipelineTask: ctx.task },
      });

      const snapshot = this.stressCollector.computeSnapshot(ctx.userId);
      const history = this.stressCollector.getSnapshots(ctx.userId, 7);
      const stressResult = this.stressEngine.evaluate(snapshot, history);

      ctx.onStress?.(stressResult.total, stressResult.level);
      this.spriteService.broadcastStressUpdate(ctx.userId, ctx.sessionId, stressResult.total);

      steps[3] = {
        name: "health_check",
        status: "completed",
        result: { score: stressResult.total, level: stressResult.level },
      };

      // Step 5: Memory extraction (background)
      steps.push({ name: "memory_extraction", status: "running" });
      ctx.onProgress?.("memory_extraction", 95);

      let memoriesExtracted = 0;
      try {
        const memResult = await this.mem0Service.add(
          [{ role: "user", content: ctx.task }, { role: "assistant", content: agentResult.summary || "" }],
          { userId: ctx.userId },
        );
        memoriesExtracted = 1;
      } catch {
        this.logger.debug("Mem0 not available for memory extraction");
      }

      steps[4] = { name: "memory_extraction", status: "completed", result: { count: memoriesExtracted } };

      // Complete
      ctx.onProgress?.("complete", 100);
      const duration = Date.now() - startTime;
      this.logger.log(`Pipeline complete in ${duration}ms: "${ctx.task}" → ${agentResult.summary}`);

      return {
        success: agentResult.success,
        steps: steps.map((s) => ({ ...s, duration: s.duration ?? duration / steps.length })),
        summary: agentResult.summary || "流程执行完成",
        stressScore: stressResult.total,
        memoriesExtracted,
      };
    } catch (error: any) {
      this.logger.error(`Pipeline failed: ${error.message}`);
      const duration = Date.now() - startTime;
      const failedStep = steps.find((s) => s.status === "running");
      if (failedStep) {
        failedStep.status = "failed";
        failedStep.error = error.message;
        failedStep.duration = duration;
      }

      ctx.onSprite?.("sad", "遇到了一些问题...");
      return { success: false, steps, summary: error.message };
    }
  }
}
