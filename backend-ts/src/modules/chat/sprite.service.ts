import { Injectable, Logger } from "@nestjs/common";
import { SessionEventsService, SessionEvent } from "./session-events.service";

export type SpriteMood = "idle" | "happy" | "sad" | "surprised" | "thinking" | "evolving";
export type StressLevel = "normal" | "mild" | "moderate" | "severe";

export interface SpriteStatePayload {
  mood: SpriteMood;
  stressLevel: StressLevel;
  stressScore: number;
  taskProgress: number;
  taskDescription: string;
  message: string | null;
  isSpeaking: boolean;
  form: string;
}

@Injectable()
export class SpriteService {
  private readonly logger = new Logger(SpriteService.name);

  constructor(
    private readonly sessionEventsService: SessionEventsService,
  ) {}

  broadcastSpriteState(
    userId: string,
    sessionId: string,
    payload: Partial<SpriteStatePayload>,
  ) {
    const event: SessionEvent = {
      type: "sprite_state",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: payload as Record<string, any>,
    };

    this.sessionEventsService.broadcastToUser(userId, event);
    this.logger.debug(`Sprite state broadcast to user ${userId}: mood=${payload.mood}, progress=${payload.taskProgress}`);
  }

  broadcastAgentThinking(userId: string, sessionId: string, description?: string) {
    this.broadcastSpriteState(userId, sessionId, {
      mood: "thinking",
      taskProgress: 10,
      taskDescription: description || "正在分析你的需求...",
    });
  }

  broadcastToolExecuting(userId: string, sessionId: string, toolName: string, progress: number) {
    this.broadcastSpriteState(userId, sessionId, {
      mood: "thinking",
      taskProgress: Math.min(10 + progress * 0.6, 70),
      taskDescription: `正在使用 ${toolName}...`,
    });
  }

  broadcastTaskComplete(userId: string, sessionId: string, summary?: string) {
    this.broadcastSpriteState(userId, sessionId, {
      mood: "happy",
      taskProgress: 100,
      taskDescription: "任务完成！",
      message: summary || "全部搞定！",
    });
  }

  broadcastIdle(userId: string, sessionId: string) {
    this.broadcastSpriteState(userId, sessionId, {
      mood: "idle",
      taskProgress: 0,
      taskDescription: "",
      message: null,
    });
  }

  broadcastStressUpdate(userId: string, sessionId: string, stressScore: number) {
    let stressLevel: StressLevel = "normal";
    if (stressScore >= 80) stressLevel = "severe";
    else if (stressScore >= 60) stressLevel = "moderate";
    else if (stressScore >= 40) stressLevel = "mild";

    let message = null;
    if (stressLevel === "severe") {
      message = "今天已工作很久了，休息一下吧！";
    } else if (stressLevel === "moderate") {
      message = "注意到你最近比较辛苦，要照顾自己哦~";
    }

    this.broadcastSpriteState(userId, sessionId, {
      mood: stressLevel === "normal" ? "idle" : "sad",
      stressLevel,
      stressScore,
      message,
    });
  }
}
