import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

export interface HybridSearchResult {
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LocalEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(LocalEmbeddingService.name);
  private readonly DEFAULT_MODEL = "bge-m3";

  private apiBase: string;
  private apiKey: string;
  private model: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.apiBase = this.configService.get<string>("EMBEDDING_API_BASE") ||
      this.configService.get<string>("OLLAMA_HOST") ||
      "http://localhost:11434";

    this.apiKey = this.configService.get<string>("EMBEDDING_API_KEY") || "";
    this.model = this.configService.get<string>("EMBEDDING_MODEL") || this.DEFAULT_MODEL;

    this.logger.log(
      `LocalEmbeddingService initialized: model=${this.model}, base=${this.apiBase}`,
    );
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const url = `${this.apiBase}/api/embeddings`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.model, input: text }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding || data.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding response format");
      }

      return {
        embedding,
        model: data.model || this.model,
        tokens: data.usage?.total_tokens || 0,
      };
    } catch (error: any) {
      this.logger.error(`generateEmbedding failed: ${error.message}`);
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      try {
        results.push(await this.generateEmbedding(text));
      } catch {
        results.push({ embedding: [], model: this.model, tokens: 0 });
      }
    }
    return results;
  }

  async generateEmbeddingBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    if (texts.length === 1) return [await this.generateEmbedding(texts[0])];

    const url = `${this.apiBase}/api/embeddings`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.model, input: texts }),
      });

      if (!response.ok) {
        return this.generateEmbeddings(texts);
      }

      const data = await response.json();
      const embeddings = data.data;

      if (embeddings && Array.isArray(embeddings)) {
        return embeddings.map((e: any, i: number) => ({
          embedding: e.embedding || [],
          model: data.model || this.model,
          tokens: data.usage?.total_tokens
            ? Math.round(data.usage.total_tokens / texts.length)
            : 0,
        }));
      }

      return this.generateEmbeddings(texts);
    } catch {
      return this.generateEmbeddings(texts);
    }
  }

  async hybridSearch(
    query: string,
    documents: Array<{ id: string; content: string; metadata?: Record<string, any> }>,
    options?: {
      semanticWeight?: number;
      keywordWeight?: number;
      topK?: number;
    },
  ): Promise<HybridSearchResult[]> {
    const semanticWeight = options?.semanticWeight || 0.6;
    const keywordWeight = options?.keywordWeight || 0.4;
    const topK = options?.topK || 10;

    if (documents.length === 0) return [];

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const scored: Array<{ doc: typeof documents[0]; score: number }> = [];

      for (const doc of documents) {
        const keywordScore = this.bm25Score(query, doc.content);
        const targetEmbedding = await this.generateEmbedding(doc.content);
        const semanticScore = this.cosineSimilarity(
          queryEmbedding.embedding,
          targetEmbedding.embedding,
        );

        const finalScore = semanticScore * semanticWeight + keywordScore * keywordWeight;
        scored.push({ doc, score: finalScore });
      }

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, topK).map((s) => ({
        content: s.doc.content,
        score: Math.round(s.score * 10000) / 10000,
        source: s.doc.id,
        metadata: s.doc.metadata,
      }));
    } catch (error: any) {
      this.logger.error(`hybridSearch failed: ${error.message}`);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private bm25Score(query: string, document: string): number {
    const k1 = 1.5;
    const b = 0.75;
    const docLen = document.length;
    const avgDocLen = 2000;

    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document.toLowerCase());

    let score = 0;
    for (const term of queryTerms) {
      const tf = docTerms.filter((t: string) => t === term).length;
      if (tf === 0) continue;

      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
      score += numerator / (denominator || 1);
    }

    return score / (queryTerms.length || 1);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  getModel(): string {
    return this.model;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding("health check");
      return true;
    } catch {
      return false;
    }
  }
}
