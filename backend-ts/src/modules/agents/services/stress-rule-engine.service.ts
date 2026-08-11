import { Injectable, Logger } from "@nestjs/common";
import type { DailyStressSnapshot } from "./stress-data-collector.service";

export type StressLevel = "normal" | "mild" | "moderate" | "severe";

export interface StressScore {
  total: number;
  level: StressLevel;
  dimensions: {
    replySpeed: { score: number; weight: number; detail: string };
    overtimeHours: { score: number; weight: number; detail: string };
    meetingDensity: { score: number; weight: number; detail: string };
    documentEdits: { score: number; weight: number; detail: string };
  };
  recommendation: string;
  timestamp: string;
}

export interface StressThresholds {
  mild: number;
  moderate: number;
  severe: number;
}

@Injectable()
export class StressRuleEngine {
  private readonly logger = new Logger(StressRuleEngine.name);

  private readonly WEIGHTS = {
    replySpeed: 0.30,
    overtimeHours: 0.25,
    meetingDensity: 0.25,
    documentEdits: 0.20,
  };

  private thresholds: StressThresholds = {
    mild: 40,
    moderate: 60,
    severe: 80,
  };

  setThresholds(thresholds: Partial<StressThresholds>): void {
    if (thresholds.mild !== undefined) this.thresholds.mild = thresholds.mild;
    if (thresholds.moderate !== undefined) this.thresholds.moderate = thresholds.moderate;
    if (thresholds.severe !== undefined) this.thresholds.severe = thresholds.severe;
  }

  getThresholds(): StressThresholds {
    return { ...this.thresholds };
  }

  evaluate(snapshot: DailyStressSnapshot, history: DailyStressSnapshot[] = []): StressScore {
    const replySpeed = this.evaluateReplySpeed(snapshot, history);
    const overtime = this.evaluateOvertime(snapshot, history);
    const meetings = this.evaluateMeetingDensity(snapshot, history);
    const edits = this.evaluateDocumentEdits(snapshot, history);

    const total = Math.round(
      replySpeed.score * this.WEIGHTS.replySpeed +
      overtime.score * this.WEIGHTS.overtimeHours +
      meetings.score * this.WEIGHTS.meetingDensity +
      edits.score * this.WEIGHTS.documentEdits,
    );

    const level = this.classifyLevel(total);
    const recommendation = this.generateRecommendation(level, total, snapshot);

    return {
      total: Math.min(100, total),
      level,
      dimensions: {
        replySpeed: { score: replySpeed.score, weight: this.WEIGHTS.replySpeed, detail: replySpeed.detail },
        overtimeHours: { score: overtime.score, weight: this.WEIGHTS.overtimeHours, detail: overtime.detail },
        meetingDensity: { score: meetings.score, weight: this.WEIGHTS.meetingDensity, detail: meetings.detail },
        documentEdits: { score: edits.score, weight: this.WEIGHTS.documentEdits, detail: edits.detail },
      },
      recommendation,
      timestamp: new Date().toISOString(),
    };
  }

  private evaluateReplySpeed(
    snapshot: DailyStressSnapshot,
    history: DailyStressSnapshot[],
  ): { score: number; detail: string } {
    const avgLatency = snapshot.replyLatencyAvg;

    if (avgLatency === 0) return { score: 0, detail: "无消息数据" };

    let score = 0;
    if (avgLatency > 300) score = 100;
    else if (avgLatency > 180) score = 85;
    else if (avgLatency > 120) score = 70;
    else if (avgLatency > 60) score = 50;
    else if (avgLatency > 30) score = 30;
    else score = 10;

    const recentAvg = history.length > 0
      ? history.slice(-3).reduce((s, h) => s + h.replyLatencyAvg, 0) / Math.min(3, history.length)
      : avgLatency;

    if (recentAvg > 0 && avgLatency > recentAvg * 1.5) {
      score = Math.min(100, score + 15);
    }

    return {
      score,
      detail: `平均回复间隔: ${Math.round(avgLatency)}秒`,
    };
  }

  private evaluateOvertime(
    snapshot: DailyStressSnapshot,
    history: DailyStressSnapshot[],
  ): { score: number; detail: string } {
    const overtime = snapshot.overtimeHours;
    const totalHours = snapshot.activeHours;

    let score = 0;
    if (totalHours === 0) return { score: 0, detail: "无在线数据" };

    if (overtime > 6) score = 100;
    else if (overtime > 4) score = 85;
    else if (overtime > 3) score = 70;
    else if (overtime > 2) score = 55;
    else if (overtime > 1) score = 35;
    else if (overtime > 0) score = 15;
    else score = 5;

    const consecutiveOvertime = history.filter((h) => h.overtimeHours > 2).length;
    if (consecutiveOvertime >= 3) score = Math.min(100, score + 20);

    return {
      score,
      detail: `在线${totalHours.toFixed(1)}h, 加班${overtime.toFixed(1)}h${consecutiveOvertime >= 3 ? ", 连续3天以上加班" : ""}`,
    };
  }

  private evaluateMeetingDensity(
    snapshot: DailyStressSnapshot,
    history: DailyStressSnapshot[],
  ): { score: number; detail: string } {
    const meetingHours = snapshot.meetingHours;

    let score = 0;
    if (meetingHours === 0) return { score: 0, detail: "无会议数据" };

    if (meetingHours > 8) score = 100;
    else if (meetingHours > 6) score = 85;
    else if (meetingHours > 5) score = 70;
    else if (meetingHours > 4) score = 55;
    else if (meetingHours > 3) score = 40;
    else if (meetingHours > 2) score = 25;
    else score = 10;

    const recentMeetingAvg = history.length > 0
      ? history.reduce((s, h) => s + h.meetingHours, 0) / history.length
      : meetingHours;

    if (recentMeetingAvg > 4 && meetingHours > recentMeetingAvg) {
      score = Math.min(100, score + 10);
    }

    return {
      score,
      detail: `会议${meetingHours.toFixed(1)}h`,
    };
  }

  private evaluateDocumentEdits(
    snapshot: DailyStressSnapshot,
    history: DailyStressSnapshot[],
  ): { score: number; detail: string } {
    const editCount = snapshot.documentEditCount;

    let score = 0;
    if (editCount === 0) return { score: 0, detail: "无编辑数据" };

    if (editCount > 30) score = 100;
    else if (editCount > 25) score = 85;
    else if (editCount > 20) score = 70;
    else if (editCount > 15) score = 50;
    else if (editCount > 10) score = 30;
    else if (editCount > 5) score = 15;
    else score = 5;

    return {
      score,
      detail: `文档修改${editCount}次`,
    };
  }

  private classifyLevel(total: number): StressLevel {
    if (total >= this.thresholds.severe) return "severe";
    if (total >= this.thresholds.moderate) return "moderate";
    if (total >= this.thresholds.mild) return "mild";
    return "normal";
  }

  private generateRecommendation(
    level: StressLevel,
    score: number,
    snapshot: DailyStressSnapshot,
  ): string {
    switch (level) {
      case "severe":
        return `压力评分 ${score}/100（重度）。今天已高强度工作，建议立即休息，明天再继续。`;
      case "moderate":
        return `压力评分 ${score}/100（中度）。注意到你最近较辛苦，建议今天早点休息。`;
      case "mild":
        return `压力评分 ${score}/100（轻度）。工作节奏尚可，记得适时活动一下。`;
      default:
        return `压力评分 ${score}/100（正常）。今天状态不错，保持节奏！`;
    }
  }
}
