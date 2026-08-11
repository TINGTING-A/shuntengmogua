import { Injectable, Logger } from "@nestjs/common";
import {
  StateGraph,
  START,
  END,
  MemorySaver,
  interrupt,
} from "@langchain/langgraph";
import { MafAgentState, type MafToolCall, type MafToolResult, type MafApprovalDecision, type MafApprovalContext, type MafFinishReason } from "./maf-state";
import { ToolOrchestrator } from "../../tools/tool-orchestrator.service";
import { LLMService } from "../../llm-core/llm.service";
import { SessionContextService } from "../session-context.service";
import { ToolCallDisplayUtil } from "../utils/tool-call-display.util";
import type { MessageRecord, LLMCompletionParams } from "../../llm-core/types/llm.types";

export interface MafStreamEvent {
  type: string;
  contentId: string;
  messageId?: string;
  turnsId?: string;
  content?: string | null;
  reasoningContent?: string | null;
  toolCalls?: any[];
  toolCallsResponse?: any[];
  displayMessages?: any[];
  finishReason?: string;
  error?: string;
  usage?: Record<string, any>;
  modelName?: string;
  requestId?: string;
  parentId?: string;
  progress?: { completedIterations: number; maxIterations: number };
}

export interface MafRunConfig {
  session: any;
  messageId: string;
  toolContext: any;
  thinkingEffort?: string;
  regenerationMode?: string;
  assistantMessageId?: string;
  abortSignal?: AbortSignal;
  resumeData?: any;
  contentId?: string;
  maxIterations?: number;
  onToken?: (event: MafStreamEvent) => void;
  onToolCall?: (event: MafStreamEvent) => void;
}

@Injectable()
export class MafAgentOrchestrator {
  private readonly logger = new Logger(MafAgentOrchestrator.name);
  private readonly MAX_ITERATIONS = 40;

  constructor(
    private readonly llmService: LLMService,
    private readonly toolOrchestrator: ToolOrchestrator,
    private readonly sessionContextService: SessionContextService,
    private readonly displayManager: ToolCallDisplayUtil,
  ) {}

  buildGraph(checkpointer?: MemorySaver) {
    const workflow = new StateGraph(MafAgentState)
      .addNode("agent", this.createAgentNode())
      .addNode("tools", this.createToolNode())
      .addEdge(START, "agent")
      .addConditionalEdges("agent", this.createRouter(), {
        tools: "tools",
        end: END,
      })
      .addEdge("tools", "agent");

    return workflow.compile({
      checkpointer: checkpointer || new MemorySaver(),
    });
  }

  async *stream(config: {
    session: any;
    messageId: string;
    toolContext: any;
    thinkingEffort?: string;
    regenerationMode?: string;
    abortSignal?: AbortSignal;
    resumeData?: any;
    requestId?: string;
  }): AsyncGenerator<MafStreamEvent> {
    const {
      session,
      messageId,
      toolContext,
      thinkingEffort,
      abortSignal,
      resumeData,
      requestId,
    } = config;

    const contentId = crypto.randomUUID();
    const turnsId = crypto.randomUUID();
    let responseMessageId = "";

    yield {
      type: "create",
      contentId,
      messageId: responseMessageId,
      turnsId,
      modelName: session.model?.modelName,
      requestId: requestId || "",
      parentId: messageId,
    };

    const tokenEvents: MafStreamEvent[] = [];
    const toolEvents: MafStreamEvent[] = [];

    const graph = this.buildGraph();

    try {
      const result = await graph.invoke(
        {},
        {
          configurable: {
            session,
            toolContext,
            thinkingEffort,
            abortSignal,
            resumeData,
            contentId,
            messageId,
            requestId,
            onToken: (event: MafStreamEvent) => {
              tokenEvents.push(event);
            },
            onToolCall: (event: MafStreamEvent) => {
              toolEvents.push(event);
            },
          },
        },
      );

      for (const event of tokenEvents) {
        yield event;
      }

      for (const event of toolEvents) {
        yield event;
      }

      const finishReason = result?.finishReason || "completed";

      yield {
        type: "finish",
        contentId,
        finishReason,
        usage: result?.usage || undefined,
      };
    } catch (error: any) {
      yield {
        type: "finish",
        contentId,
        finishReason: "error",
        error: error.message || String(error),
      };
    }
  }

  private createAgentNode() {
    const self = this;

    return async function agentNode(
      state: typeof MafAgentState.State,
      config: any,
    ): Promise<Partial<typeof MafAgentState.State>> {
      const session = config.configurable?.session;
      const toolContext = config.configurable?.toolContext;
      const thinkingEffort = config.configurable?.thinkingEffort;
      const abortSignal = config.configurable?.abortSignal;
      const contentId = config.configurable?.contentId || "";

      if (!session?.model) {
        return {
          finishReason: "error",
          error: "No model configured for session",
        };
      }

      try {
        const messages = await self.prepareMessages(session, state);
        const tools = toolContext
          ? await self.toolOrchestrator.getAllTools(toolContext)
          : undefined;

        const params: LLMCompletionParams = {
          model: session.model.modelName || "",
          messages: messages as MessageRecord[],
          tools: tools as any,
          thinkingEffort: thinkingEffort || "off",
          stream: true,
          abortSignal,
          providerConfig: session.model,
        };

        const result = self.llmService.completions(params);

        if (Symbol.asyncIterator in Object(result)) {
          let accumulatedContent = "";
          let accumulatedReasoning = "";
          let accumulatedToolCalls: any[] | undefined;
          let gatheredUsage: any;

          for await (const chunk of result as AsyncIterable<any>) {
            if (abortSignal?.aborted) {
              return { finishReason: "user_cancel" };
            }

            if (chunk.content) {
              accumulatedContent += chunk.content;
            }
            if (chunk.reasoningContent) {
              accumulatedReasoning += chunk.reasoningContent;
            }
            if (chunk.toolCalls) {
              accumulatedToolCalls = chunk.toolCalls;
            }
            if (chunk.usage) {
              gatheredUsage = chunk.usage;
            }

            if (config.configurable?.onToken) {
              config.configurable.onToken({
                type: chunk.reasoningContent ? "think" : "text",
                contentId,
                content: chunk.content || null,
                reasoningContent: chunk.reasoningContent || null,
              });
            }
          }

          const normalizedCalls: MafToolCall[] = [];
          if (accumulatedToolCalls && accumulatedToolCalls.length > 0) {
            for (const tc of accumulatedToolCalls) {
              normalizedCalls.push({
                id: tc.id || tc.index?.toString() || crypto.randomUUID(),
                name: tc.name || tc.function?.name || "",
                arguments:
                  typeof tc.arguments === "string"
                    ? tc.arguments
                    : JSON.stringify(
                        tc.arguments || tc.function?.arguments || {},
                      ),
              });
            }
          }

          return {
            lastAssistantContent: accumulatedContent,
            lastReasoningContent: accumulatedReasoning || "",
            usage: gatheredUsage || null,
            toolCalls: normalizedCalls,
            messages: [
              ...(state.messages || []),
              {
                role: "assistant",
                content: accumulatedContent,
                reasoningContent: accumulatedReasoning || undefined,
                tool_calls: normalizedCalls.length > 0 ? normalizedCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.name,
                    arguments: tc.arguments,
                  },
                })) : undefined,
              },
            ],
          };
        } else {
          const response = await result;
          return {
            lastAssistantContent:
              typeof response === "string" ? response : JSON.stringify(response),
            toolCalls: [],
          };
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return { finishReason: "user_cancel" };
        }
        self.logger.error(`Agent node error:`, error);
        return {
          finishReason: "error",
          error: error.message || String(error),
        };
      }
    };
  }

  private createToolNode() {
    const self = this;

    return async function toolNode(
      state: typeof MafAgentState.State,
      config: any,
    ): Promise<Partial<typeof MafAgentState.State>> {
      const toolContext = config.configurable?.toolContext;
      const abortSignal = config.configurable?.abortSignal;
      const session = config.configurable?.session;

      if (!state.toolCalls || state.toolCalls.length === 0) {
        return { toolResults: [] };
      }

      try {
        const { pendingTools, approvedTools, rejectedTools } =
          self.classifyToolsByApproval(state.toolCalls, session, config);

        if (pendingTools.length > 0) {
          const approvalContext: MafApprovalContext = {
            status: "pending",
            pendingToolCallIds: pendingTools.map((tc) => tc.id),
            createdAt: new Date().toISOString(),
          };

          const resumeValue = interrupt({
            type: "approval_required",
            toolCalls: state.toolCalls,
            approvalContext,
          });

          if (resumeValue && typeof resumeValue === "object") {
            const decisions = (resumeValue as any).decisions as MafApprovalDecision[];
            if (decisions && decisions.length > 0) {
              const approvedSet = new Set(
                decisions
                  .filter((d) => d.decision === "approve")
                  .map((d) => d.toolCallId),
              );
              const rejectedSet = new Set(
                decisions
                  .filter((d) => d.decision === "reject")
                  .map((d) => d.toolCallId),
              );

              const finalApproved: MafToolCall[] = [];
              const finalRejected: MafToolCall[] = [];

              for (const tc of pendingTools) {
                if (approvedSet.has(tc.id)) {
                  finalApproved.push(tc);
                } else if (rejectedSet.has(tc.id)) {
                  finalRejected.push(tc);
                } else {
                  finalRejected.push(tc);
                }
              }

              return await self.executeToolsAndReturn(
                finalApproved,
                finalRejected,
                state,
                config,
                toolContext,
                abortSignal,
              );
            }
          }

          return {
            approvalContext,
            finishReason: "approval_required",
          };
        }

        return await self.executeToolsAndReturn(
          approvedTools,
          rejectedTools,
          state,
          config,
          toolContext,
          abortSignal,
        );
      } catch (error: any) {
        return {
          finishReason: "error",
          error: error.message || String(error),
        };
      }
    };
  }

  private async executeToolsAndReturn(
    approvedTools: MafToolCall[],
    rejectedTools: MafToolCall[],
    state: typeof MafAgentState.State,
    config: any,
    toolContext: any,
    abortSignal?: AbortSignal,
  ): Promise<Partial<typeof MafAgentState.State>> {
    const results: MafToolResult[] = [];
    const newMessages: any[] = [];

    if (approvedTools.length > 0) {
      const toolResponses = await this.toolOrchestrator.executeBatch(
        approvedTools.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: this.safeJsonParse(tc.arguments),
        })),
        toolContext,
        abortSignal,
      );

      for (const res of toolResponses) {
        results.push({
          toolCallId: res.toolCallId,
          name: res.name,
          content: res.content,
        });

        newMessages.push({
          role: "tool",
          content: res.content,
          name: res.name,
          tool_call_id: res.toolCallId,
        });

        if (config.configurable?.onToolCall) {
          config.configurable.onToolCall({
            type: "tool_calls_response",
            contentId: config.configurable?.contentId || "",
            toolCallsResponse: [
              {
                name: res.name,
                content: res.content,
                toolCallId: res.toolCallId,
              },
            ],
          });
        }
      }
    }

    if (rejectedTools.length > 0) {
      for (const rejected of rejectedTools) {
        const errorContent = JSON.stringify({
          success: false,
          message: "用户拒绝了工具执行",
        });

        results.push({
          toolCallId: rejected.id,
          name: rejected.name,
          content: errorContent,
          isError: true,
        });

        newMessages.push({
          role: "tool",
          content: errorContent,
          name: rejected.name,
          tool_call_id: rejected.id,
        });
      }
    }

    const newIterationCount = (state.iterationCount || 0) + 1;

    return {
      toolResults: results,
      iterationCount: newIterationCount,
      finishReason:
        newIterationCount >= this.MAX_ITERATIONS
          ? "max_iterations_reached"
          : null,
      messages: [...(state.messages || []), ...newMessages],
    };
  }

  private createRouter() {
    return (state: typeof MafAgentState.State) => {
      if (
        state.finishReason === "error" ||
        state.finishReason === "user_cancel" ||
        state.finishReason === "approval_required" ||
        state.finishReason === "max_iterations_reached"
      ) {
        return "end";
      }
      if (state.toolCalls && state.toolCalls.length > 0) {
        return "tools";
      }
      return "end";
    };
  }

  private classifyToolsByApproval(
    toolCalls: MafToolCall[],
    session: any,
    config: any,
  ): {
    pendingTools: MafToolCall[];
    approvedTools: MafToolCall[];
    rejectedTools: MafToolCall[];
  } {
    const pendingTools: MafToolCall[] = [];
    const approvedTools: MafToolCall[] = [];
    const rejectedTools: MafToolCall[] = [];

    const requiresApproval =
      session?.settings?.toolApproval?.requiresApproval || [];
    const resumeData = config.configurable?.resumeData;
    const decisions: MafApprovalDecision[] = resumeData?.decisions || [];

    for (const tc of toolCalls) {
      const needsApproval = requiresApproval.some((pattern: string) => {
        if (pattern.endsWith("__*")) {
          return tc.name.startsWith(pattern.replace("__*", ""));
        }
        return pattern === tc.name;
      });

      if (needsApproval) {
        const decision = decisions.find(
          (d: MafApprovalDecision) => d.toolCallId === tc.id,
        );
        if (!decision) {
          pendingTools.push(tc);
        } else if (decision.decision === "approve") {
          approvedTools.push(tc);
        } else {
          rejectedTools.push(tc);
        }
      } else {
        approvedTools.push(tc);
      }
    }

    return { pendingTools, approvedTools, rejectedTools };
  }

  private async prepareMessages(
    session: any,
    state: typeof MafAgentState.State,
  ): Promise<any[]> {
    if (state.messages && state.messages.length > 0) {
      return state.messages;
    }

    const { context } = await this.sessionContextService.buildContext(session);
    const historyMessages = await context.getMessages();
    return historyMessages;
  }

  private safeJsonParse(str: string): Record<string, any> {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
