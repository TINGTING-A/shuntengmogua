export interface AgentTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
}

export interface AgentInput {
  task: string;
  context?: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

export interface AgentOutput {
  success: boolean;
  result: any;
  summary?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  systemPrompt: string;
  capabilities: AgentCapability[];
  tools: AgentTool[];
  version: string;
}

export type AgentCategory =
  | "planner"
  | "connector"
  | "knowledge"
  | "interaction"
  | "health"
  | "sync";

export abstract class BaseSubAgent {
  abstract readonly card: AgentCard;

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  getCard(): AgentCard {
    return this.card;
  }

  matchIntent(task: string): number {
    const keywords = [this.card.name, this.card.description, ...this.card.capabilities.map(c => c.name)];
    const lowerTask = task.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lowerTask.includes(kw.toLowerCase())) score += 1;
    }
    return score;
  }
}
