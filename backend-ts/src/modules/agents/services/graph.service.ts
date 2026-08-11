import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  properties?: Record<string, any>;
}

@Injectable()
export class GraphService implements OnModuleInit {
  private readonly logger = new Logger(GraphService.name);
  private db: any = null;
  private conn: any = null;
  private kuzuAvailable = false;

  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];

  constructor() {}

  async onModuleInit() {
    try {
      const kuzu = await import("kuzu");
      this.db = new kuzu.Database(":memory:");
      this.conn = new kuzu.Connection(this.db);
      await this.conn.query(`
        CREATE NODE TABLE IF NOT EXISTS Entities(id STRING, label STRING, type STRING, PRIMARY KEY(id))
      `);
      await this.conn.query(`
        CREATE REL TABLE IF NOT EXISTS Relations(FROM Entities TO Entities, relation STRING)
      `);
      this.kuzuAvailable = true;
      this.logger.log("GraphService: Kuzu embedded graph database initialized");
    } catch (error: any) {
      this.kuzuAvailable = false;
      this.logger.warn(`Kuzu not available (${error.message}), using in-memory fallback`);
    }
  }

  async addEntity(node: GraphNode): Promise<void> {
    if (this.kuzuAvailable && this.conn) {
      try {
        await this.conn.query(
          `MERGE (e:Entities {id: $id}) SET e.label = $label, e.type = $type`,
          { id: node.id, label: node.label, type: node.type },
        );
        return;
      } catch {}
    }
    this.nodes.set(node.id.toLowerCase(), node);
  }

  async addRelation(edge: GraphEdge): Promise<void> {
    await this.addEntity({ id: edge.source, label: edge.source, type: "unknown", properties: {} });
    await this.addEntity({ id: edge.target, label: edge.target, type: "unknown", properties: {} });

    if (this.kuzuAvailable && this.conn) {
      try {
        await this.conn.query(
          `MATCH (a:Entities {id: $source}), (b:Entities {id: $target}) MERGE (a)-[:Relations {relation: $relation}]->(b)`,
          { source: edge.source, target: edge.target, relation: edge.relation },
        );
        return;
      } catch {}
    }
    this.edges.push(edge);
  }

  async searchEntities(query: string, limit = 10): Promise<GraphNode[]> {
    if (this.kuzuAvailable && this.conn) {
      try {
        const result = await this.conn.query(
          `MATCH (e:Entities) WHERE e.label CONTAINS $q OR e.type CONTAINS $q RETURN e.id, e.label, e.type LIMIT ${limit}`,
          { q: query },
        );
        const rows: GraphNode[] = [];
        while (await result.hasNext()) {
          const row = await result.getNext();
          rows.push({ id: row["e.id"] as string, label: row["e.label"] as string, type: row["e.type"] as string, properties: {} });
        }
        return rows;
      } catch {}
    }

    const q = query.toLowerCase();
    return Array.from(this.nodes.values())
      .filter((n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
      .slice(0, limit);
  }

  async findRelations(entityId: string): Promise<Array<{ target: string; relation: string }>> {
    if (this.kuzuAvailable && this.conn) {
      try {
        const result = await this.conn.query(
          `MATCH (a:Entities {id: $id})-[r:Relations]->(b:Entities) RETURN b.id, r.relation`,
          { id: entityId },
        );
        const rows: Array<{ target: string; relation: string }> = [];
        while (await result.hasNext()) {
          const row = await result.getNext();
          rows.push({ target: row["b.id"] as string, relation: row["r.relation"] as string });
        }
        return rows;
      } catch {}
    }

    return this.edges
      .filter((e) => e.source.toLowerCase() === entityId.toLowerCase())
      .map((e) => ({ target: e.target, relation: e.relation }));
  }

  async findPaths(fromId: string, toId: string, maxDepth = 3): Promise<string[][]> {
    if (this.kuzuAvailable && this.conn) {
      try {
        const result = await this.conn.query(
          `MATCH p = (a:Entities {id: $from})-[*1..${maxDepth}]->(b:Entities {id: $to}) RETURN nodes(p)`,
          { from: fromId, to: toId },
        );
        const paths: string[][] = [];
        while (await result.hasNext()) {
          const row = await result.getNext();
          const nodeList = row["nodes(p)"] as any[];
          if (nodeList) paths.push(nodeList.map((n: any) => n.id));
        }
        return paths;
      } catch {}
    }

    const visited = new Set<string>();
    const allPaths: string[][] = [];

    const dfs = (current: string, path: string[], depth: number) => {
      if (depth > maxDepth || visited.has(current.toLowerCase())) return;
      if (current.toLowerCase() === toId.toLowerCase()) {
        allPaths.push([...path, current]);
        return;
      }
      visited.add(current.toLowerCase());

      const neighbors = this.edges
        .filter((e) => e.source.toLowerCase() === current.toLowerCase())
        .map((e) => e.target);

      for (const neighbor of neighbors) {
        dfs(neighbor, [...path, current], depth + 1);
      }
      visited.delete(current.toLowerCase());
    };

    dfs(fromId, [], 0);
    return allPaths;
  }

  async getStats(): Promise<{ nodeCount: number; edgeCount: number; mode: string }> {
    if (this.kuzuAvailable && this.conn) {
      try {
        const nodeResult = await this.conn.query(`MATCH (e:Entities) RETURN count(e) AS c`);
        const edgeResult = await this.conn.query(`MATCH ()-[r:Relations]->() RETURN count(r) AS c`);
        let nodeCount = 0, edgeCount = 0;
        if (await nodeResult.hasNext()) nodeCount = Number((await nodeResult.getNext())["c"]);
        if (await edgeResult.hasNext()) edgeCount = Number((await edgeResult.getNext())["c"]);
        return { nodeCount, edgeCount, mode: "kuzu" };
      } catch {}
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      mode: "memory",
    };
  }
}
