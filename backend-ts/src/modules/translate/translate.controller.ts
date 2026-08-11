import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { LLMService } from "../llm-core/llm.service";
import { ModelRepository } from "../../common/database/model.repository";
import { SettingsService } from "../settings/settings.service";
import { SG_MODELS, SK_MOD_CHAT } from "../../constants/settings.constants";

@Controller("translate")
@UseGuards(AuthGuard)
export class TranslateController {
  constructor(
    private readonly llmService: LLMService,
    private readonly modelRepo: ModelRepository,
    private readonly settingsService: SettingsService,
  ) {}

  @Post()
  async translate(@Body() body: { text: string; direction?: "zh2en" | "en2zh" }) {
    const text = (body?.text || "").trim();
    const direction = body?.direction === "en2zh" ? "en2zh" : "zh2en";

    if (!text) {
      return { success: true, result: "" };
    }

    // 找一个可用的激活模型：优先 settings 默认对话模型，回退第一个 text 类型激活模型（跳过 embedding/本地向量服务）
    let model: any = null;
    try {
      const defaultModelId = await this.settingsService.getSettingValue(SG_MODELS, SK_MOD_CHAT);
      if (defaultModelId) {
        const m = await this.modelRepo.findById(defaultModelId);
        if (m) {
          model = { ...m, provider: m.provider };
        }
      }
    } catch (e: any) {
      console.warn("find default model failed: " + e.message);
    }

    if (!model) {
      try {
        const providers = await this.modelRepo.getProvidersWithModels();
        for (const p of providers || []) {
          const m = (p.models || []).find(
            (mm: any) => mm.isActive && mm.modelType !== "embedding",
          );
          if (m) {
            model = { ...m, provider: p };
            break;
          }
        }
      } catch (e: any) {
        // 模型查询失败时走 LLM 直调前的降级
        console.warn("find model failed: " + e.message);
      }
    }

    if (!model) {
      return { success: false, error: "未找到可用的模型，请先在模型管理中配置" };
    }

    const targetLang = direction === "zh2en" ? "英文" : "中文";
    const prompt = `请将以下文本翻译成${targetLang}，只输出译文本身，不要任何解释、注释或额外内容：\n\n${text}`;

    try {
      const response = await this.llmService.completions({
        model: model.modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        maxTokens: 1024,
        thinkingEffort: "off",
        stream: false,
        providerConfig: model.provider,
      });
      const result = (response?.content || "").trim();
      return { success: true, result };
    } catch (e: any) {
      return { success: false, error: "翻译失败：" + e.message };
    }
  }
}
