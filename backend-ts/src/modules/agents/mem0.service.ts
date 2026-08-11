import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MemoryClient } from "mem0ai";
import type { MessageRecord } from "../llm-core/types/llm.types";

export interface Mem0MemoryEntry {
  id: string;
  memory: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  score?: number;
  categories?: string[];
  metadata?: Record<string, any>;
}

export interface Mem0SearchResult {
  id: string;
  memory: string;
  score: number;
  userId?: string;
}

@Injectable()
export class Mem0Service implements OnModuleInit {
  private readonly logger = new Logger(Mem0Service.name);
  private client: MemoryClient | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>("MEM0_API_KEY");
    const host = this.configService.get<string>("MEM0_HOST");

    if (!apiKey) {
      this.logger.warn(
        "MEM0_API_KEY not configured. Mem0 disabled. " +
        "Set MEM0_API_KEY env var to enable.",
      );
      this.enabled = false;
      return;
    }

    try {
      this.client = new MemoryClient({ apiKey, host });
      this.enabled = true;
      this.logger.log("Mem0 client initialized");
    } catch (error) {
      this.logger.error(`Mem0 init failed: ${error}`);
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async add(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    options?: {
      userId?: string;
      agentId?: string;
      runId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Mem0MemoryEntry[]> {
    if (!this.isEnabled()) return [];

    try {
      const result = await this.client!.add(messages, {
        userId: options?.userId,
        agentId: options?.agentId,
        runId: options?.runId,
        metadata: options?.metadata,
        infer: true,
      });

      return result.map((r: any) => ({
        id: r.id,
        memory: r.memory,
        userId: r.userId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
      }));
    } catch (error: any) {
      this.logger.error(`Mem0 add failed: ${error.message}`);
      return [];
    }
  }

  async search(
    query: string,
    options?: {
      userId?: string;
      limit?: number;
      threshold?: number;
    },
  ): Promise<Mem0SearchResult[]> {
    if (!this.isEnabled()) return [];

    try {
      const filters: Record<string, any> = {};
      if (options?.userId) filters.userId = options.userId;

      const result = await this.client!.search(query, {
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        topK: options?.limit || 10,
        threshold: options?.threshold,
      });

      return (result.results || []).map((r: any) => ({
        id: r.id,
        memory: r.memory,
        score: r.score || 0,
        userId: r.userId,
      }));
    } catch (error: any) {
      this.logger.error(`Mem0 search failed: ${error.message}`);
      return [];
    }
  }

  async getAll(options?: {
    userId?: string;
    limit?: number;
  }): Promise<Mem0MemoryEntry[]> {
    if (!this.isEnabled()) return [];

    try {
      const filters: Record<string, any> = {};
      if (options?.userId) filters.userId = options.userId;

      const result = await this.client!.getAll({
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        pageSize: options?.limit || 50,
      });

      const items = (result as any)?.results || (Array.isArray(result) ? result : []);
      return items.slice(0, options?.limit || 50).map((r: any) => ({
        id: r.id,
        memory: r.memory,
        userId: r.userId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }));
    } catch (error: any) {
      this.logger.error(`Mem0 getAll failed: ${error.message}`);
      return [];
    }
  }

  async get(memoryId: string): Promise<Mem0MemoryEntry | null> {
    if (!this.isEnabled()) return null;

    try {
      const r = await this.client!.get(memoryId);
      return {
        id: r.id,
        memory: r.memory,
        userId: r.userId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ""),
      };
    } catch (error: any) {
      this.logger.error(`Mem0 get(${memoryId}) failed: ${error.message}`);
      return null;
    }
  }

  async update(memoryId: string, text: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      await this.client!.update(memoryId, { text });
      return true;
    } catch (error: any) {
      this.logger.error(`Mem0 update(${memoryId}) failed: ${error.message}`);
      return false;
    }
  }

  async delete(memoryId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      await this.client!.delete(memoryId);
      return true;
    } catch (error: any) {
      this.logger.error(`Mem0 delete(${memoryId}) failed: ${error.message}`);
      return false;
    }
  }

  async deleteAll(userId?: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      await this.client!.deleteAll(userId ? { userId } : {});
      return true;
    } catch (error: any) {
      this.logger.error(`Mem0 deleteAll failed: ${error.message}`);
      return false;
    }
  }

  async extractFromConversation(
    messages: MessageRecord[],
    userId: string,
    sessionId?: string,
  ): Promise<Mem0MemoryEntry[]> {
    const formatted: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const m of messages) {
      if (m.role === "user" || m.role === "assistant") {
        formatted.push({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        });
      }
    }

    if (formatted.length === 0) return [];

    return this.add(formatted, {
      userId,
      agentId: sessionId ? `session_${sessionId}` : undefined,
      metadata: { sessionId, source: "conversation", messageCount: messages.length },
    });
  }
}
