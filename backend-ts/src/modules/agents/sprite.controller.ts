import { Controller, Post, Get, Body, Param, UseGuards, Logger } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ConfigService } from "@nestjs/config";

@Controller("sprite")
@UseGuards(AuthGuard)
export class SpriteController {
  private readonly logger = new Logger(SpriteController.name);
  private readonly meshyApiKey: string | null;

  constructor(private readonly configService: ConfigService) {
    this.meshyApiKey = this.configService.get<string>("MESHY_API_KEY") || null;
  }

  @Post("generate-model")
  async generateModel(@Body() body: { prompt: string; negativePrompt?: string; artStyle?: string }) {
    if (!this.meshyApiKey) {
      return {
        success: false,
        error: "MESHY_API_KEY not configured",
        taskId: `demo-${Date.now()}`,
        status: "demo_mode",
        message: `演示模式: 提示词 "${body.prompt}" 已记录。配置 MESHY_API_KEY 环境变量后启用 AI 3D 模型生成。`,
      };
    }

    try {
      const meshyBody: any = {
        mode: "preview",
        prompt: body.prompt,
        negative_prompt: body.negativePrompt || "low quality, distorted",
        art_style: body.artStyle || "realistic",
        topology: "triangle",
        target_polycount: 30000,
        should_texture: true,
      };

      const response = await fetch("https://api.meshy.ai/openapi/v2/text-to-3d", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.meshyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(meshyBody),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Meshy API error: ${response.status}`);
      }

      this.logger.log(`3D model generation started: ${data.result || data.id}`);

      return {
        success: true,
        taskId: data.result || data.id,
        status: "processing",
        message: `3D模型生成已启动: ${body.prompt}`,
        estimatedTime: "3-5分钟",
      };
    } catch (error: any) {
      this.logger.error(`Meshy API error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        taskId: `mesh-${Date.now()}`,
        status: "failed",
        message: `Meshy API 调用失败: ${error.message}`,
      };
    }
  }

  @Get("model-status/:taskId")
  async getModelStatus(@Param("taskId") taskId: string) {
    if (!this.meshyApiKey) {
      return { success: false, error: "MESHY_API_KEY not configured" };
    }

    try {
      const response = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`, {
        headers: { Authorization: `Bearer ${this.meshyApiKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Meshy API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        taskId,
        status: data.status || "unknown",
        progress: data.progress || 0,
        modelUrls: data.model_urls || [],
        previewUrl: data.preview_url || null,
      };
    } catch (error: any) {
      this.logger.error(`Meshy status check failed: ${error.message}`);
      return { success: false, error: error.message, taskId };
    }
  }
}
