import { Injectable, Logger } from "@nestjs/common";

export interface StressSignal {
  timestamp: string;
  source: "im" | "calendar" | "online" | "file_edit" | "custom";
  value: number;
  metadata?: Record<string, any>;
}

export interface DailyStressSnapshot {
  date: string;
  userId: string;
  replyLatencyAvg: number;
  overtimeHours: number;
  meetingHours: number;
  documentEditCount: number;
  activeHours: number;
  signals: StressSignal[];
}

@Injectable()
export class StressDataCollector {
  private readonly logger = new Logger(StressDataCollector.name);
  private readonly signals = new Map<string, StressSignal[]>();
  private readonly snapshots = new Map<string, DailyStressSnapshot[]>();

  recordSignal(userId: string, signal: StressSignal): void {
    const key = this.todayKey(userId);
    if (!this.signals.has(key)) {
      this.signals.set(key, []);
    }
    this.signals.get(key)!.push(signal);
  }

  recordImActivity(userId: string, messageCount: number, avgReplySeconds: number): void {
    this.recordSignal(userId, {
      timestamp: new Date().toISOString(),
      source: "im",
      value: avgReplySeconds,
      metadata: { messageCount },
    });
  }

  recordOnlineDuration(userId: string, hoursOnline: number): void {
    this.recordSignal(userId, {
      timestamp: new Date().toISOString(),
      source: "online",
      value: hoursOnline,
    });
  }

  recordCalendarDensity(userId: string, meetingHours: number, meetingCount: number): void {
    this.recordSignal(userId, {
      timestamp: new Date().toISOString(),
      source: "calendar",
      value: meetingHours,
      metadata: { meetingCount },
    });
  }

  recordFileEdit(userId: string, editCount: number, repeatEdits: number): void {
    this.recordSignal(userId, {
      timestamp: new Date().toISOString(),
      source: "file_edit",
      value: editCount,
      metadata: { repeatEdits },
    });
  }

  getTodaySignals(userId: string): StressSignal[] {
    return this.signals.get(this.todayKey(userId)) || [];
  }

  getSignalsForDate(userId: string, date: string): StressSignal[] {
    return this.signals.get(`${userId}:${date}`) || [];
  }

  computeSnapshot(userId: string): DailyStressSnapshot {
    const signals = this.getTodaySignals(userId);

    const imSignals = signals.filter((s) => s.source === "im");
    const onlineSignals = signals.filter((s) => s.source === "online");
    const calendarSignals = signals.filter((s) => s.source === "calendar");
    const fileSignals = signals.filter((s) => s.source === "file_edit");

    const replyLatencyAvg = imSignals.length > 0
      ? imSignals.reduce((sum, s) => sum + s.value, 0) / imSignals.length
      : 0;

    const maxOnline = onlineSignals.length > 0
      ? Math.max(...onlineSignals.map((s) => s.value))
      : 0;

    const totalMeetingHours = calendarSignals.reduce((sum, s) => sum + s.value, 0);
    const totalFileEdits = fileSignals.reduce((sum, s) => sum + s.value, 0);

    const snapshot: DailyStressSnapshot = {
      date: this.today(),
      userId,
      replyLatencyAvg,
      overtimeHours: Math.max(0, maxOnline - 8),
      meetingHours: totalMeetingHours,
      documentEditCount: totalFileEdits,
      activeHours: maxOnline,
      signals: [...signals],
    };

    const snapKey = userId;
    if (!this.snapshots.has(snapKey)) {
      this.snapshots.set(snapKey, []);
    }
    this.snapshots.get(snapKey)!.push(snapshot);

    return snapshot;
  }

  getSnapshots(userId: string, days: number = 7): DailyStressSnapshot[] {
    const all = this.snapshots.get(userId) || [];
    return all.slice(-days);
  }

  getWeeklyTrend(userId: string): Array<{ date: string; score: number }> {
    const snapshots = this.getSnapshots(userId, 7);
    return snapshots.map((s) => ({
      date: s.date,
      score: this.computeQuickScore(s),
    }));
  }

  private computeQuickScore(snapshot: DailyStressSnapshot): number {
    let score = 0;
    if (snapshot.replyLatencyAvg > 120) score += 30;
    if (snapshot.overtimeHours > 2) score += 25;
    if (snapshot.meetingHours > 6) score += 25;
    if (snapshot.documentEditCount > 20) score += 20;
    return Math.min(100, score);
  }

  private todayKey(userId: string): string {
    return `${userId}:${this.today()}`;
  }

  private today(): string {
    return new Date().toISOString().split("T")[0];
  }

  clearUserData(userId: string): void {
    for (const key of this.signals.keys()) {
      if (key.startsWith(userId)) this.signals.delete(key);
    }
    this.snapshots.delete(userId);
  }
}
