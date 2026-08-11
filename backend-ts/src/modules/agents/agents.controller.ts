import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AgentRegistryService } from "./agent-registry.service";
import type { AgentInput } from "./base-agent";

@Controller("agents")
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(private readonly registry: AgentRegistryService) {}

  @Get()
  listAll() {
    const agents = this.registry.listAll();
    return {
      success: true,
      count: agents.length,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        capabilities: a.capabilities.map((c) => c.name),
        tools: a.tools.map((t) => t.name),
        version: a.version,
      })),
    };
  }

  @Get(":id")
  getAgent(@Param("id") id: string) {
    const card = this.registry.listAll().find((a) => a.id === id);
    if (!card) {
      return { success: false, error: `Agent not found: ${id}` };
    }
    return { success: true, agent: card };
  }

  @Post(":id/execute")
  async executeAgent(
    @Param("id") id: string,
    @Body() body: { task: string; context?: Record<string, any>; sessionId?: string; userId?: string },
  ) {
    const input: AgentInput = {
      task: body.task || "",
      context: body.context,
      sessionId: body.sessionId,
      userId: body.userId,
    };

    const result = await this.registry.executeAgent(id, input);
    return result;
  }

  @Post("execute-by-intent")
  async executeByIntent(
    @Body() body: { task: string; context?: Record<string, any>; sessionId?: string; userId?: string },
  ) {
    const input: AgentInput = {
      task: body.task || "",
      context: body.context,
      sessionId: body.sessionId,
      userId: body.userId,
    };

    const match = this.registry.findBestAgent(body.task);
    const result = await this.registry.executeByIntent(body.task, input);

    return {
      ...result,
      matchedAgent: match?.agentId,
      matchScore: match?.score,
    };
  }

  @Get("categories")
  listCategories() {
    const agents = this.registry.listAll();
    const categories = new Map<string, number>();
    for (const a of agents) {
      categories.set(a.category, (categories.get(a.category) || 0) + 1);
    }

    return {
      success: true,
      categories: Array.from(categories.entries()).map(([name, count]) => ({
        name,
        count,
      })),
    };
  }
}
