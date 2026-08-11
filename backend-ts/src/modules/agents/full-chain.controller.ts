import { Controller, Post, Body, Query, UseGuards, Sse, MessageEvent } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { FullChainService, type PipelineContext } from "./services/full-chain.service";
import { Observable } from "rxjs";

@Controller("pipeline")
@UseGuards(AuthGuard)
export class FullChainController {
  constructor(private readonly fullChainService: FullChainService) {}

  @Post("execute")
  async execute(@Body() body: {
    userId: string;
    sessionId: string;
    task: string;
  }) {
    const ctx: PipelineContext = {
      userId: body.userId,
      sessionId: body.sessionId,
      task: body.task,
    };

    const result = await this.fullChainService.executePipeline(ctx);
    return result;
  }

  @Sse("stream")
  stream(
    @Query("userId") userId: string,
    @Query("sessionId") sessionId: string,
    @Query("task") task: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const ctx: PipelineContext = {
        userId,
        sessionId,
        task,
        onProgress: (step, progress) => {
          subscriber.next({ type: "message", data: JSON.stringify({ type: "progress", step, progress }) });
        },
        onSprite: (mood, message) => {
          subscriber.next({ type: "message", data: JSON.stringify({ type: "sprite", mood, message }) });
        },
        onVoice: (text, emotion) => {
          subscriber.next({ type: "message", data: JSON.stringify({ type: "voice", text, emotion }) });
        },
        onStress: (score, level) => {
          subscriber.next({ type: "message", data: JSON.stringify({ type: "stress", score, level }) });
        },
      };

      this.fullChainService.executePipeline(ctx).then((result) => {
        subscriber.next({ type: "message", data: JSON.stringify({ type: "complete", ...result }) });
        subscriber.complete();
      }).catch((err) => {
        subscriber.next({ type: "message", data: JSON.stringify({ type: "error", error: err.message }) });
        subscriber.complete();
      });
    });
  }
}

