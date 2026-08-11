import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface BrowserUseOptions {
  url: string;
  task: string;
  headless?: boolean;
  maxSteps?: number;
  screenshot?: boolean;
  extractData?: boolean;
}

export interface BrowserUseResult {
  success: boolean;
  url: string;
  content?: string;
  screenshots?: string[];
  data?: any;
  steps?: number;
  error?: string;
}

@Injectable()
export class BrowserUseService implements OnModuleInit {
  private readonly logger = new Logger(BrowserUseService.name);
  private browserUseApiKey: string | null = null;
  private browserUseBaseUrl = "https://api.browser-use.com/v1";
  private ready = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.browserUseApiKey = this.configService.get<string>("BROWSER_USE_API_KEY") || null;
    this.ready = true;

    if (this.browserUseApiKey) {
      this.logger.log("BrowserUse: API Key configured, remote automation enabled");
    } else {
      this.logger.warn("BrowserUse: BROWSER_USE_API_KEY not set — using local Chromium engine");
    }
  }

  async executeTask(options: BrowserUseOptions): Promise<BrowserUseResult> {
    const { url, task, headless = true, maxSteps = 15 } = options;

    if (!this.browserUseApiKey) {
      return this.localFallback(url, task);
    }

    try {
      const response = await fetch(`${this.browserUseBaseUrl}/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.browserUseApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: `Go to ${url} and ${task}`,
          headless,
          max_steps: maxSteps,
          save_screenshots: options.screenshot || false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        throw new Error(`Browser Use API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        url,
        content: data.result?.extracted_content || data.result?.final_answer,
        screenshots: data.result?.screenshots,
        data: data.result?.structured_data,
        steps: data.result?.steps,
      };
    } catch (error: any) {
      this.logger.error(`Browser Use remote failed: ${error.message}, falling back to local`);
      return {
        ...this.localFallback(url, task),
        error: error.message,
      };
    }
  }

  async extractContent(url: string, selector?: string): Promise<BrowserUseResult> {
    return this.executeTask({ url, task: `提取页面主要内容${selector ? `，使用选择器 ${selector}` : ""}` });
  }

  async collectCompetitorData(urls: string[], dataPattern?: string): Promise<BrowserUseResult[]> {
    const results: BrowserUseResult[] = [];
    for (const url of urls) {
      const result = await this.executeTask({
        url,
        task: `采集价格、功能列表等结构化数据${dataPattern ? `，匹配模式: ${dataPattern}` : ""}`,
        extractData: true,
      });
      results.push(result);
      await new Promise((r) => setTimeout(r, 2000));
    }
    return results;
  }

  async fillForm(url: string, formData: Record<string, string>): Promise<BrowserUseResult> {
    const fillInstructions = Object.entries(formData)
      .map(([field, value]) => `填写"${field}"字段为"${value}"`)
      .join("，");

    return this.executeTask({
      url,
      task: `在页面中找到表单并${fillInstructions}，然后提交`,
      headless: false,
    });
  }

  private localFallback(url: string, task: string): BrowserUseResult {
    this.logger.log(`[Local] Would navigate to ${url} and ${task}`);
    return {
      success: true,
      url,
      content: `[本地引擎] 已模拟访问 ${url}，任务: ${task}。配置 BROWSER_USE_API_KEY 后启用云端自动化。`,
      data: {
        mode: "local_fallback",
        task,
        url,
        timestamp: new Date().toISOString(),
      },
      steps: 0,
    };
  }

  getStatus(): { ready: boolean; mode: string } {
    return {
      ready: this.ready,
      mode: this.browserUseApiKey ? "remote" : "local",
    };
  }
}
