import { Controller, Post, Get, Body, UseGuards, Res, HttpCode } from "@nestjs/common";
import { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { VoiceService, type TtsOptions } from "./services/voice.service";

@Controller("voice")
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  private readonly VALID_EMOTIONS = ["neutral", "happy", "sad", "angry", "fearful", "surprised"];

  private resolveEmotion(input?: string): TtsOptions["emotion"] {
    if (input && this.VALID_EMOTIONS.includes(input)) {
      return input as TtsOptions["emotion"];
    }
    return "neutral";
  }

  @Get("health")
  async healthCheck() {
    const health = await this.voiceService.healthCheck();
    return { success: true, ...health };
  }

  @Post("stt")
  async speechToText(@Body() body: { audio: string; language?: string; format?: "json" | "text" }) {
    const audioBuffer = Buffer.from(body.audio, "base64");
    const text = await this.voiceService.speechToText(audioBuffer, {
      language: body.language,
      responseFormat: body.format || "json",
    });
    return { success: true, text };
  }

  @Post("tts")
  async textToSpeech(
    @Body() body: { text: string; emotion?: string; voice?: string; speed?: number },
    @Res() res: Response,
  ) {
    const audioBuffer = await this.voiceService.textToSpeech(body.text, {
      emotion: this.resolveEmotion(body.emotion),
      voice: body.voice,
      speed: body.speed,
    });
    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length.toString(),
    });
    res.send(audioBuffer);
  }

  @Post("tts/stream")
  @HttpCode(200)
  async textToSpeechStream(
    @Body() body: { text: string; emotion?: string; voice?: string },
    @Res() res: Response,
  ) {
    const stream = await this.voiceService.textToSpeechStreaming(body.text, {
      emotion: this.resolveEmotion(body.emotion),
      voice: body.voice,
    });

    res.set({
      "Content-Type": "audio/wav",
      "Transfer-Encoding": "chunked",
    });

    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  }

  @Get("emotions")
  listEmotions() {
    return {
      success: true,
      emotions: ["neutral", "happy", "sad", "angry", "fearful", "surprised"],
      default: "neutral",
    };
  }
}
