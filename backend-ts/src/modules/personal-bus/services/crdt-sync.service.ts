import { Injectable, Logger } from "@nestjs/common";
import * as Y from "yjs";

export interface CrdtDocument {
  id: string;
  ydoc: Y.Doc;
  type: "json" | "text" | "array";
  createdAt: string;
  updatedAt: string;
}

export interface CrdtSyncEvent {
  type: "update" | "create" | "delete" | "conflict_resolved";
  documentId: string;
  data?: any;
  source?: string;
  timestamp: string;
}

@Injectable()
export class CrdtSyncService {
  private readonly logger = new Logger(CrdtSyncService.name);
  private documents = new Map<string, CrdtDocument>();
  private listeners = new Map<string, Set<(event: CrdtSyncEvent) => void>>();

  createDocument(id: string, type: "json" | "text" | "array" = "json", initialData?: any): CrdtDocument {
    if (this.documents.has(id)) {
      return this.documents.get(id)!;
    }

    const ydoc = new Y.Doc();
    const doc: CrdtDocument = {
      id,
      ydoc,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (type === "json" || type === "text" || type === "array") {
      const ymap = ydoc.getMap(id);
      if (initialData) {
        if (typeof initialData === "object") {
          for (const [key, value] of Object.entries(initialData)) {
            ymap.set(key, JSON.stringify(value));
          }
        }
      }
    }

    ydoc.on("update", (update: Uint8Array) => {
      doc.updatedAt = new Date().toISOString();
      this.emit(doc.id, {
        type: "update",
        documentId: id,
        data: Buffer.from(update).toString("base64"),
        timestamp: doc.updatedAt,
      });
    });

    this.documents.set(id, doc);
    this.logger.log(`CRDT document created: ${id} (${type})`);

    return doc;
  }

  getDocument(id: string): CrdtDocument | undefined {
    return this.documents.get(id);
  }

  applyUpdate(id: string, updateBase64: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    try {
      const update = Buffer.from(updateBase64, "base64");
      Y.applyUpdate(doc.ydoc, new Uint8Array(update));
      doc.updatedAt = new Date().toISOString();
      return true;
    } catch (error: any) {
      this.logger.error(`CRDT applyUpdate failed for ${id}: ${error.message}`);
      return false;
    }
  }

  getStateAsUpdate(id: string): string | null {
    const doc = this.documents.get(id);
    if (!doc) return null;

    const update = Y.encodeStateAsUpdate(doc.ydoc);
    return Buffer.from(update).toString("base64");
  }

  getDiffUpdate(id: string, fromStateBase64: string): string | null {
    const doc = this.documents.get(id);
    if (!doc) return null;

    try {
      const fromState = Buffer.from(fromStateBase64, "base64");
      const diff = Y.encodeStateAsUpdate(doc.ydoc, new Uint8Array(fromState));
      return Buffer.from(diff).toString("base64");
    } catch {
      return this.getStateAsUpdate(id);
    }
  }

  mergeDocuments(targetId: string, sourceId: string): boolean {
    const target = this.documents.get(targetId);
    const source = this.documents.get(sourceId);
    if (!target || !source) return false;

    try {
      const sourceUpdate = Y.encodeStateAsUpdate(source.ydoc);
      Y.applyUpdate(target.ydoc, sourceUpdate);
      target.updatedAt = new Date().toISOString();

      this.emit(targetId, {
        type: "conflict_resolved",
        documentId: targetId,
        data: { mergedFrom: sourceId },
        timestamp: target.updatedAt,
      });

      this.logger.log(`CRDT merge: ${sourceId} → ${targetId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`CRDT merge failed: ${error.message}`);
      return false;
    }
  }

  getData(id: string): Record<string, any> | null {
    const doc = this.documents.get(id);
    if (!doc) return null;

    const ymap = doc.ydoc.getMap(id);
    const result: Record<string, any> = {};
    for (const [key, value] of ymap.entries()) {
      try {
        result[key] = JSON.parse(value as string);
      } catch {
        result[key] = value;
      }
    }
    return result;
  }

  setData(id: string, key: string, value: any): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    const ymap = doc.ydoc.getMap(id);
    const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
    ymap.set(key, serialized);
    doc.updatedAt = new Date().toISOString();
    return true;
  }

  deleteDocument(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    doc.ydoc.destroy();
    this.documents.delete(id);

    this.emit(id, {
      type: "delete",
      documentId: id,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`CRDT document deleted: ${id}`);
    return true;
  }

  subscribe(documentId: string, listener: (event: CrdtSyncEvent) => void): () => void {
    if (!this.listeners.has(documentId)) {
      this.listeners.set(documentId, new Set());
    }
    this.listeners.get(documentId)!.add(listener);

    return () => {
      this.listeners.get(documentId)?.delete(listener);
    };
  }

  private emit(documentId: string, event: CrdtSyncEvent): void {
    const docListeners = this.listeners.get(documentId);
    if (docListeners) {
      for (const listener of docListeners) {
        try { listener(event); } catch {}
      }
    }
  }

  getAllDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }
}
