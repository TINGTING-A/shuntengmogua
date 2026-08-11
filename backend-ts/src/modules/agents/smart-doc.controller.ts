import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { SmartDocService, type SmartDocRequest } from "./services/smart-doc.service";

@Controller("smart-doc")
@UseGuards(AuthGuard)
export class SmartDocController {
  constructor(private readonly smartDocService: SmartDocService) {}

  private readonly VALID_STYLES = ["professional", "creative", "technical", "simple"];

  private resolveStyle(input?: string): SmartDocRequest["style"] {
    if (input && this.VALID_STYLES.includes(input)) {
      return input as SmartDocRequest["style"];
    }
    return "professional";
  }

  @Post("generate")
  async generateDoc(@Body() body: SmartDocRequest) {
    const result = await this.smartDocService.generateDoc(body);
    return { success: true, ...result };
  }

  @Post("ppt")
  async generatePPT(@Body() body: { topic: string; style?: string; slides?: number }) {
    const result = await this.smartDocService.generateDoc({
      type: "ppt",
      topic: body.topic,
      style: this.resolveStyle(body.style),
      slides: body.slides,
    });
    return { success: true, ...result };
  }

  @Post("word")
  async generateWord(@Body() body: { topic: string; style?: string; sections?: string[] }) {
    const result = await this.smartDocService.generateDoc({
      type: "word",
      topic: body.topic,
      style: this.resolveStyle(body.style),
      sections: body.sections,
    });
    return { success: true, ...result };
  }

  @Post("excel")
  async generateExcel(@Body() body: { topic: string; style?: string; data?: Record<string, any> }) {
    const result = await this.smartDocService.generateDoc({
      type: "excel",
      topic: body.topic,
      style: this.resolveStyle(body.style),
      data: body.data,
    });
    return { success: true, ...result };
  }
}
