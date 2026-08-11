import { Injectable, Logger } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput, type AgentCategory } from "./base-agent";

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents = new Map<string, BaseSubAgent>();

  register(agent: BaseSubAgent): void {
    const card = agent.getCard();
    if (this.agents.has(card.id)) {
      this.logger.warn(`Agent ${card.id} already registered, overwriting`);
    }
    this.agents.set(card.id, agent);
    this.logger.log(`Registered agent: ${card.id} (${card.name})`);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: string): BaseSubAgent | undefined {
    return this.agents.get(agentId);
  }

  listAll(): AgentCard[] {
    return Array.from(this.agents.values()).map((a) => a.getCard());
  }

  listByCategory(category: AgentCategory): AgentCard[] {
    return this.listAll().filter((c) => c.category === category);
  }

  async executeAgent(agentId: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, result: null, error: `Agent not found: ${agentId}` };
    }
    return agent.execute(input);
  }

  findBestAgent(task: string): { agentId: string; score: number } | null {
    let bestScore = 0;
    let bestAgent: string | null = null;

    for (const [id, agent] of this.agents) {
      const score = agent.matchIntent(task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = id;
      }
    }

    return bestAgent ? { agentId: bestAgent, score: bestScore } : null;
  }

  async executeByIntent(task: string, input: AgentInput): Promise<AgentOutput> {
    const match = this.findBestAgent(task);
    if (!match) {
      return { success: false, result: null, error: "No suitable agent found for task" };
    }
    this.logger.log(`Routing "${task}" → ${match.agentId} (score: ${match.score})`);
    return this.executeAgent(match.agentId, input);
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}
