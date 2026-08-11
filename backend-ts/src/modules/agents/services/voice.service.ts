import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SttOptions {
  language?: string;
  model?: string;
  responseFormat?: "json" | "text" | "srt" | "verbose_json";
  temperature?: number;
}

export interface TtsOptions {
  voice?: string;
  speed?: number;
  emotion?: "neutral" | "happy" | "sad" | "angry" | "fearful" | "surprised";
  pitch?: number;
  format?: "wav" | "mp3" | "opus" | "pcm";
}

@Injectable()
export class VoiceService implements OnModuleInit {
  private readonly logger = new Logger(VoiceService.name);

  private whisperApiBase: string;
  private whisperModel: string;
  private fishSpeechApiBase: string;
  private fishVoice: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.whisperApiBase = this.configService.get<string>("WHISPER_API_BASE") ||
      this.configService.get<string>("OLLAMA_HOST") ||
      "http://localhost:11434";
    this.whisperModel = this.configService.get<string>("WHISPER_MODEL") || "whisper-large-v3";
    this.fishSpeechApiBase = this.configService.get<string>("FISH_SPEECH_API_BASE") ||
      "http://localhost:8080";
    this.fishVoice = this.configService.get<string>("FISH_SPEECH_VOICE") || "default";

    this.logger.log(
      `VoiceService init: Whisper=${this.whisperApiBase} model=${this.whisperModel} | Fish=${this.fishSpeechApiBase} voice=${this.fishVoice}`,
    );
  }

  async speechToText(
    audioBuffer: Buffer,
    options?: SttOptions,
  ): Promise<string> {
    const base64 = audioBuffer.toString("base64");

    try {
      const response = await fetch(`${this.whisperApiBase}/api/transcriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options?.model || this.whisperModel,
          audio: base64,
          language: options?.language,
          response_format: options?.responseFormat || "json",
          temperature: options?.temperature || 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
      }

      const data = await response.json();
      return data.text || data.transcription || "";
    } catch (error: any) {
      this.logger.error(`STT failed: ${error.message}`);
      throw error;
    }
  }

  async speechToTextMultipart(
    audioBuffer: Buffer,
    filename: string = "audio.wav",
    options?: SttOptions,
  ): Promise<string> {
    try {
      const formData = new FormData();
      const uint8 = new Uint8Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength) as any;
      const blob = new Blob([uint8], { type: "audio/wav" });
      formData.append("file", blob, filename);
      formData.append("model", options?.model || this.whisperModel);
      if (options?.language) formData.append("language", options.language);
      if (options?.temperature !== undefined) {
        formData.append("temperature", String(options.temperature));
      }

      const response = await fetch(`${this.whisperApiBase}/api/transcriptions`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        return this.speechToText(audioBuffer, options);
      }

      const data = await response.json();
      return data.text || "";
    } catch {
      return this.speechToText(audioBuffer, options);
    }
  }

  async textToSpeech(
    text: string,
    options?: TtsOptions,
  ): Promise<Buffer> {
    const emotion = options?.emotion || "neutral";
    const voice = options?.voice || this.fishVoice;
    const speed = options?.speed || 1.0;

    try {
      const response = await fetch(`${this.fishSpeechApiBase}/v1/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice,
          speed,
          emotion,
          format: options?.format || "wav",
        }),
      });

      if (!response.ok) {
        throw new Error(`Fish Speech API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      this.logger.error(`TTS failed: ${error.message}`);
      throw error;
    }
  }

  async textToSpeechStreaming(
    text: string,
    options?: TtsOptions,
  ): Promise<AsyncIterable<Buffer>> {
    const emotion = options?.emotion || "neutral";
    const voice = options?.voice || this.fishVoice;

    try {
      const response = await fetch(`${this.fishSpeechApiBase}/v1/tts/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice,
          emotion,
          streaming: true,
        }),
      });

      if (!response.ok || !response.body) {
        const buffer = await this.textToSpeech(text, options);
        return {
          [Symbol.asyncIterator]: async function* () { yield buffer; },
        };
      }

      const reader = response.body.getReader();

      return {
        [Symbol.asyncIterator]: async function* () {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) yield Buffer.from(value) as Buffer;
          }
        },
      };
    } catch {
      const buffer = await this.textToSpeech(text, options);
      return {
        [Symbol.asyncIterator]: async function* () { yield buffer; },
      };
    }
  }

  async healthCheck(): Promise<{ stt: boolean; tts: boolean }> {
    let sttOk = false;
    let ttsOk = false;

    try {
      const response = await fetch(`${this.whisperApiBase}/v1/audio/transcriptions`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(3000),
      });
      sttOk = response.ok || response.status < 500;
    } catch {
      try {
        const response = await fetch(`${this.whisperApiBase}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        sttOk = response.ok;
      } catch { /* ignore */ }
    }

    try {
      const response = await fetch(`${this.fishSpeechApiBase}/v1/health`, {
        signal: AbortSignal.timeout(3000),
      });
      ttsOk = response.ok;
    } catch { /* ignore */ }

    return { stt: sttOk, tts: ttsOk };
  }
}
