import { Injectable, Logger } from "@nestjs/common";
import { SessionEventsService } from "../../chat/session-events.service";
import { Subject, Observable } from "rxjs";

export type ConnectorEventType =
  | "connector_connected"
  | "connector_disconnected"
  | "connector_error"
  | "data_updated"
  | "new_message"
  | "new_file"
  | "new_email"
  | "new_page"
  | "file_changed"
  | "status_changed";

export interface ConnectorEvent {
  type: ConnectorEventType;
  connectorId: string;
  connectorName: string;
  timestamp: string;
  payload?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface ConnectorSubscription {
  connectorId: string;
  eventTypes: ConnectorEventType[];
  callback: (event: ConnectorEvent) => void;
  filter?: (event: ConnectorEvent) => boolean;
}

@Injectable()
export class ConnectorEventService {
  private readonly logger = new Logger(ConnectorEventService.name);
  private readonly eventBus = new Subject<ConnectorEvent>();
  private readonly subscriptions = new Map<string, ConnectorSubscription[]>();
  private readonly connectorStatuses = new Map<string, { connected: boolean; lastEvent: string; dataCount: number }>();
  private readonly connectorNames = new Map<string, string>();

  constructor(
    private readonly sessionEventsService: SessionEventsService,
  ) {
    this.eventBus.subscribe({
      next: (event) => {
        this.notifySubscribers(event);
        this.broadcastToUser(event);
      },
      error: (err) => {
        this.logger.error(`EventBus error: ${err.message}`);
      },
    });
  }

  registerConnector(connectorId: string, connectorName: string): void {
    this.connectorNames.set(connectorId, connectorName);
    if (!this.connectorStatuses.has(connectorId)) {
      this.connectorStatuses.set(connectorId, {
        connected: false,
        lastEvent: new Date().toISOString(),
        dataCount: 0,
      });
      this.logger.log(`Connector registered: ${connectorId} (${connectorName})`);
    }
  }

  setConnected(connectorId: string, connected: boolean): void {
    const status = this.connectorStatuses.get(connectorId);
    if (status) {
      status.connected = connected;
      this.emit(connected ? "connector_connected" : "connector_disconnected", connectorId, this.connectorNames.get(connectorId) || connectorId);
    }
  }

  emit(
    type: ConnectorEventType,
    connectorId: string,
    connectorName: string,
    payload?: Record<string, any>,
    userId?: string,
    sessionId?: string,
  ): void {
    const status = this.connectorStatuses.get(connectorId);
    if (status) {
      status.lastEvent = new Date().toISOString();
      if (type === "new_message" || type === "new_file" || type === "new_email" || type === "new_page" || type === "data_updated") {
        status.dataCount++;
      }
    }

    const event: ConnectorEvent = {
      type,
      connectorId,
      connectorName,
      timestamp: new Date().toISOString(),
      payload,
      userId,
      sessionId,
    };

    this.eventBus.next(event);
    this.logger.debug(`Event [${type}]: ${connectorId}${payload ? ` (${JSON.stringify(payload).substring(0, 100)})` : ""}`);
  }

  subscribe(
    subscriptionId: string,
    connectorId: string,
    eventTypes: ConnectorEventType[],
    callback: (event: ConnectorEvent) => void,
    filter?: (event: ConnectorEvent) => boolean,
  ): () => void {
    const sub: ConnectorSubscription = { connectorId, eventTypes, callback, filter };
    const existing = this.subscriptions.get(subscriptionId) || [];
    this.subscriptions.set(subscriptionId, [...existing, sub]);

    return () => {
      const subs = this.subscriptions.get(subscriptionId) || [];
      this.subscriptions.set(
        subscriptionId,
        subs.filter((s) => s !== sub),
      );
    };
  }

  getConnectorStatus(connectorId: string): { connected: boolean; lastEvent: string; dataCount: number } | null {
    return this.connectorStatuses.get(connectorId) || null;
  }

  getAllConnectorStatuses(): Record<string, { connected: boolean; lastEvent: string; dataCount: number }> {
    const result: Record<string, any> = {};
    for (const [id, status] of this.connectorStatuses) {
      result[id] = status;
    }
    return result;
  }

  getEventsObservable(): Observable<ConnectorEvent> {
    return this.eventBus.asObservable();
  }

  private notifySubscribers(event: ConnectorEvent): void {
    for (const [, subs] of this.subscriptions) {
      for (const sub of subs) {
        if (
          sub.connectorId === event.connectorId &&
          sub.eventTypes.includes(event.type) &&
          (!sub.filter || sub.filter(event))
        ) {
          try {
            sub.callback(event);
          } catch (error: any) {
            this.logger.error(`Subscriber callback error: ${error.message}`);
          }
        }
      }
    }
  }

  private broadcastToUser(event: ConnectorEvent): void {
    if (!event.userId) return;

    try {
      this.sessionEventsService.broadcastToUser(event.userId, {
        type: "sprite_state",
        userId: event.userId,
        sessionId: event.sessionId || "",
        timestamp: event.timestamp,
        payload: {
          connectorEvent: event.type,
          connectorId: event.connectorId,
          connectorName: event.connectorName,
          data: event.payload,
        },
      });
    } catch {
      // SSE broadcast is best-effort
    }
  }
}
