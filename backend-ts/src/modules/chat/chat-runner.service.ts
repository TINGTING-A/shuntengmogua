import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { AgentEngine } from "./agent-engine.service";
import { SessionStreamManager } from "./session-stream.manager";
import { SessionEventsService } from "./session-events.service";
import { SessionService } from "./session.service";
import { MessageService } from "./message.service";
import { SessionContextService } from "./session-context.service";
import { SpriteService } from "./sprite.service";
import { MafAgentOrchestrator } from "./maf/maf-orchestrator.service";
import { Mem0Service } from "../agents/mem0.service";


/**
 * 流订阅回调
 */
export interface StreamCallbacks {
  onEvent: (data: string) => void;
  onComplete: () => void;
  onError: (err: any) => void;
}

/**
 * Chat 运行器服务
 *
 * 封装完整的对话执行业务逻辑，供 HTTP 请求和定时任务复用。
 * Controller 只负责 HTTP 响应，所有业务逻辑（消息创建、流初始化、订阅管理、AgentEngine 运行）都在此服务中处理。
 */
@Injectable()
export class ChatRunnerService {
  private readonly logger = new Logger(ChatRunnerService.name);

  constructor(
    private agentEngine: AgentEngine,
    private streamManager: SessionStreamManager,
    private sessionEventsService: SessionEventsService,
    private sessionService: SessionService,
    private messageService: MessageService,
    private sessionContextService: SessionContextService,
    private spriteService: SpriteService,
    private mafOrchestrator: MafAgentOrchestrator,
    private mem0Service: Mem0Service,
  ) {}

  /**
   * 启动会话的流式对话（完整业务逻辑）
   *
   * 处理以下全部流程：
   * 1. 获取会话
   * 2. overwrite 模式下创建用户消息
   * 3. 检查活跃流状态
   * 4. 情况1：已有活跃流 → 加入订阅
   * 5. 情况2：无活跃流 → 启动新流 + 运行 AgentEngine
   *
   * Controller 只需提供回调函数处理 HTTP 响应，无需关心内部实现。
   *
   * @param params 启动参数
   * @param callbacks 流事件回调（Controller 提供 HTTP 响应处理）
   * @returns 订阅清理函数
   * @throws HttpException 各种业务错误（会话不存在、活跃流冲突、缺少内容等）
   */
  async startStream(
    params: {
      sessionId: string;
      userId: string;
      userMessage?: {
        id?: string;
        content?: string;
        files?: string[];
        replaceMessageId?: string;
        knowledgeBaseIds?: string[];
      };
      regenerationMode?: string;
      assistantMessageId?: string | null;
      resumeData?: any;
      source?: Record<string, any>;
      lastContentId?: string | null;
    },
    callbacks?: StreamCallbacks,
  ): Promise<() => void> {
    const {
      sessionId,
      userId,
      userMessage,
      regenerationMode = "overwrite",
      assistantMessageId = null,
      resumeData,
      source,
      lastContentId = null,
    } = params;

    // 提取前端传入的 clientId，用于广播事件的 source 字段
    const clientId = source?.clientId as string | undefined;

    // 获取会话
    const session = await this.sessionService.getSessionById(sessionId, userId);
    if (!session) {
      throw new HttpException(
        { error: "会话不存在", code: "SESSION_NOT_FOUND" },
        HttpStatus.NOT_FOUND,
      );
    }

    // 更新会话最后活跃时间，用于会话管理和清理策略
    await this.sessionService.updateLastActiveAt(sessionId);

    const isSubscribeMode = regenerationMode === "subscribe";
    const hasActiveStream = this.streamManager.hasActiveStream(sessionId);

    // 发起模式：如果已有活跃流，拒绝
    if (!isSubscribeMode && hasActiveStream) {
      throw new HttpException(
        { error: "当前已有任务正在进行，请等待结束", code: "SESSION_BUSY" },
        HttpStatus.CONFLICT,
      );
    }

    // 订阅模式：如果没有活跃流，拒绝
    if (isSubscribeMode && !hasActiveStream) {
      throw new HttpException(
        { error: "No active stream to subscribe", code: "NO_ACTIVE_STREAM" },
        HttpStatus.CONFLICT,
      );
    }

    let createdUserMessage: any = null;

    // overwrite 模式下自动创建消息
    if (regenerationMode === "overwrite" || !regenerationMode) {
      if (!userMessage?.content) {
        throw new HttpException(
          { error: "缺少消息内容", code: "MISSING_CONTENT" },
          HttpStatus.BAD_REQUEST,
        );
      }
      try {
        createdUserMessage = await this.messageService.addMessage(
          sessionId,
          "user",
          userMessage.content,
          userMessage.files || [],
          userMessage.replaceMessageId,
          userMessage.knowledgeBaseIds,
          userId,
          source,
        );
      } catch (error: any) {
        this.logger.error(`创建消息失败:`, error);
        throw new HttpException(
          {
            error: "创建消息失败: " + (error.message || "Unknown error"),
            code: "MESSAGE_CREATE_FAILED",
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    const subscriberId = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 情况 1: 该会话已有活跃流，加入订阅
    if (hasActiveStream) {
      return this.subscribeToStream(sessionId, subscriberId, callbacks, lastContentId);
    }

    // 情况 2: 该会话没有活跃流，需要启动新流
    const abortController = new AbortController();

    const started = this.streamManager.startStream(
      sessionId,
      userId,
      abortController,
      assistantMessageId,
    );
    if (!started) {
      throw new HttpException(
        { error: "Session is busy", code: "STREAM_START_FAILED" },
        HttpStatus.CONFLICT,
      );
    }

    // 注册订阅者（如果提供了回调）
    let unsubscribe: (() => void) | null = null;
    if (callbacks) {
      unsubscribe = this.streamManager.subscribe(
        sessionId,
        subscriberId,
        callbacks.onEvent,
        callbacks.onComplete,
        callbacks.onError,
      );
      if (!unsubscribe) {
        throw new HttpException(
          { error: "Stream not available", code: "SUBSCRIBE_FAILED" },
          HttpStatus.CONFLICT,
        );
      }
    }

    // 广播流开始事件，携带完整会话信息供前端同步
    // source 使用前端传入的 clientId，使前端能正确识别自身发起的事件
    this.sessionEventsService.broadcastToUser(userId, {
      type: "stream_started",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      source: clientId || subscriberId,
      payload: {
        messageId: createdUserMessage?.id || userMessage?.id,
        replaceMessageId: userMessage?.replaceMessageId || null,
        session,
      },
    });

    // 如果有用户消息，广播给所有流订阅者
    if (createdUserMessage) {
      this.streamManager.broadcast(sessionId, {
        type: "user_message",
        message: createdUserMessage,
      });
    }

    // 在后台启动 Agent 循环
    this.runAgentEngine(
      session,
      userMessage?.id || createdUserMessage?.id,
      abortController,
      userId,
      regenerationMode,
      assistantMessageId,
      resumeData,
      clientId,
    ).catch((error) => {
      this.logger.error(`Agent engine error for ${session.id}:`, error);
      this.logger.error(`Agent engine error stack:`, error?.stack);
      this.streamManager.broadcast(session.id, {
        type: "error",
        error: error.message,
      });
      this.streamManager.stopStream(session.id, "error");
    });

    return unsubscribe || (() => {});
  }

  /**
   * 订阅已存在的活跃流
   */
  private subscribeToStream(
    sessionId: string,
    subscriberId: string,
    callbacks?: StreamCallbacks,
    lastContentId?: string | null,
  ): (() => void) | null {
    if (!callbacks) {
      // 后台执行不需要订阅
      return () => {};
    }

    const unsubscribe = this.streamManager.subscribe(
      sessionId,
      subscriberId,
      callbacks.onEvent,
      callbacks.onComplete,
      callbacks.onError,
      lastContentId || null,
    );

    if (!unsubscribe) {
      this.logger.warn(`订阅流失败: ${sessionId}`);
      return null;
    }

    return unsubscribe;
  }

  /**
   * 使用 MAF (LangGraph StateGraph) 运行 Agent
   *
   * 与 startStream 接口兼容，内部使用 MafAgentOrchestrator.stream()
   * 替代传统 ReAct 循环，获得图式工作流、检查点、人机环流能力。
   */
  async startStreamWithMaf(
    params: {
      sessionId: string;
      userId: string;
      messageId?: string;
      userMessage?: {
        content?: string;
        files?: string[];
        knowledgeBaseIds?: string[];
      };
      thinkingEffort?: string;
      abortSignal?: AbortSignal;
      resumeData?: any;
      source?: Record<string, any>;
    },
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const { sessionId, userId, userMessage, thinkingEffort, abortSignal, resumeData, source } = params;

    const session = await this.sessionService.getSessionById(sessionId, userId);
    if (!session) {
      throw new HttpException(
        { error: "会话不存在", code: "SESSION_NOT_FOUND" },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.sessionService.updateLastActiveAt(sessionId);

    const { context } = await this.sessionContextService.buildContext(session);
    const toolContext = { sessionId, userId, context };

    const clientId = source?.clientId as string | undefined;

    this.spriteService.broadcastAgentThinking(userId, sessionId, "正在分析你的需求...");

    try {
      for await (const event of this.mafOrchestrator.stream({
        session,
        messageId: userMessage?.content ? "user_msg_" + Date.now() : params.messageId || "",
        toolContext,
        thinkingEffort,
        abortSignal,
        resumeData,
        requestId: clientId,
      })) {
        callbacks.onEvent(JSON.stringify(event));
      }

      this.spriteService.broadcastTaskComplete(userId, sessionId, "任务执行完毕！");
    } catch (error: any) {
      if (error.name === "AbortError") {
        this.spriteService.broadcastIdle(userId, sessionId);
      } else {
        this.spriteService.broadcastSpriteState(userId, sessionId, {
          mood: "sad",
          message: "出了点小问题，请稍后再试~",
        });
      }
      callbacks.onError(error);
    }
  }

  /**
   * 后台运行 Agent Engine
   */


  private async runAgentEngine(
    session: any,
    userMessageId: string,
    abortController: AbortController,
    userId: string,
    regenerationMode: string = "overwrite",
    assistantMessageId?: string | null,
    resumeData?: any,
    clientId?: string,
  ): Promise<void> {
    const sessionId = session.id;

    this.spriteService.broadcastAgentThinking(userId, sessionId, "正在分析你的需求...");

    try {
      const iterator = this.agentEngine.completions(
        session,
        userMessageId,
        regenerationMode,
        assistantMessageId || undefined,
        abortController.signal,
        resumeData,
      );

      let lastToolName = "";

      for await (const chunk of iterator) {
        this.streamManager.broadcast(sessionId, chunk);

        if (chunk.type === "tool_call" && chunk.toolName && chunk.toolName !== lastToolName) {
          lastToolName = chunk.toolName;
          this.spriteService.broadcastToolExecuting(userId, sessionId, chunk.toolName, 30);
        }
      }

      this.streamManager.stopStream(sessionId, "completed");

      this.sessionEventsService.broadcastToUser(userId, {
        type: "stream_finished",
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
        source: clientId,
        payload: { reason: "completed" },
      });

      this.spriteService.broadcastTaskComplete(userId, sessionId, "任务执行完毕！");

      this.extractMemoriesInBackground(session, userId);
    } catch (error: any) {
      if (error.name === "AbortError") {
        this.logger.log(`Stream ${sessionId} aborted`);
        this.streamManager.stopStream(sessionId, "user_cancel");

        this.sessionEventsService.broadcastToUser(userId, {
          type: "stream_finished",
          userId,
          sessionId,
          timestamp: new Date().toISOString(),
          source: clientId,
          payload: { reason: "user_cancel" },
        });

        this.spriteService.broadcastIdle(userId, sessionId);
      } else {
        this.sessionEventsService.broadcastToUser(userId, {
          type: "stream_finished",
          userId,
          sessionId,
          timestamp: new Date().toISOString(),
          source: clientId,
          payload: { reason: "error", error: error.message },
        });

        this.spriteService.broadcastSpriteState(userId, sessionId, {
          mood: "sad",
          message: "出了点小问题，请稍后再试~",
        });

        throw error;
      }
    }
  }

  private extractMemoriesInBackground(session: any, userId: string): void {
    if (!this.mem0Service.isEnabled()) return;

    Promise.resolve().then(async () => {
      try {
        const { context } = await this.sessionContextService.buildContext(session);
        const messages = await context.getMessages();
        if (messages && messages.length > 2) {
          await this.mem0Service.extractFromConversation(
            messages,
            userId,
            session.id,
          );
        }
      } catch (error: any) {
        this.logger.debug(`Background memory extraction skipped: ${error.message}`);
      }
    });
  }
}
