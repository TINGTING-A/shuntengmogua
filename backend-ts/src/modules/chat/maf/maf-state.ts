import { Annotation } from "@langchain/langgraph";

export interface MafToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface MafToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export interface MafApprovalDecision {
  toolCallId: string;
  decision: "approve" | "reject";
  reason?: string;
}

export interface MafApprovalContext {
  status: "pending" | "completed";
  pendingToolCallIds: string[];
  decisions?: MafApprovalDecision[];
  createdAt: string;
  updatedAt?: string;
}

export type MafFinishReason =
  | "completed"
  | "approval_required"
  | "max_iterations_reached"
  | "user_cancel"
  | "error";

export const MafAgentState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  toolCalls: Annotation<MafToolCall[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  toolResults: Annotation<MafToolResult[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  iterationCount: Annotation<number>({
    reducer: (current, update) => Math.max(current, update),
    default: () => 0,
  }),

  finishReason: Annotation<MafFinishReason | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  error: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  approvalContext: Annotation<MafApprovalContext | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  lastAssistantContent: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  lastReasoningContent: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  usage: Annotation<Record<string, any> | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});
