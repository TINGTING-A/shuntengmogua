import { Injectable } from "@nestjs/common";
import {
  IModelProvider,
  ProviderMetadata,
  ModelDefinition,
  ModelFilterOptions,
} from "../../types/provider.types";
import { HunyuanOpenAIAdapter } from "./hunyuan-openai.adapter";
import { IProtocolAdapter } from "../../adapters/base.adapter";
import { createTextModel, createMultimodalModel, ConfigFragments } from "../../utils/model-config.helper";

/**
 * 腾讯混元供应商实现
 * 腾讯云大模型服务，提供混元系列模型（通用/推理/代码/多模态）
 */
@Injectable()
export class HunyuanProvider implements IModelProvider {
  readonly id = "hunyuan";
  readonly name = "腾讯混元";
  readonly protocols = ["openai"];
  readonly defaultApiUrl = "https://api.hunyuan.cloud.tencent.com/v1";

  // 内部持有混元专用的适配器实例
  private adapter: HunyuanOpenAIAdapter;

  constructor() {
    this.adapter = new HunyuanOpenAIAdapter();
  }

  /**
   * 获取指定协议的适配器
   */
  getAdapter(protocol: string): IProtocolAdapter | null {
    if (protocol === "openai") {
      return this.adapter;
    }
    return null;
  }

  // 腾讯混元支持开关模式
  private defaultThinkingEfforts: string[] = ["off", "on"];

  private models: ModelDefinition[] = [
    // 混元通用系列
    createMultimodalModel(
      "hunyuan-turbos-latest",
      ConfigFragments.ContextWindow._128K,
    ),
    createMultimodalModel(
      "hunyuan-turbo-latest",
      ConfigFragments.ContextWindow._128K,
    ),
    createMultimodalModel(
      "hunyuan-standard-latest",
      ConfigFragments.ContextWindow._128K,
    ),
    createMultimodalModel(
      "hunyuan-pro-latest",
      ConfigFragments.ContextWindow._128K,
    ),
    // 混元推理系列（T1）
    createMultimodalModel(
      "hunyuan-t1-latest",
      ConfigFragments.ContextWindow._128K,
    ),
    // 混元大杯（DeepSeek 同源架构）
    createMultimodalModel(
      "hunyuan-large",
      ConfigFragments.ContextWindow._128K,
    ),
    // 混元代码
    createTextModel(
      "hunyuan-code",
      ConfigFragments.ContextWindow._128K,
    ),
    // 混元多模态
    createMultimodalModel(
      "hunyuan-vision",
      ConfigFragments.ContextWindow._128K,
    ),
  ];

  /**
   * 获取供应商元数据
   */
  getMetadata(): ProviderMetadata {
    return {
      id: this.id,
      name: this.name,
      description:
        "腾讯云大模型服务，提供混元系列模型：通用、推理、代码、多模态全覆盖。",
      avatarUrl: "static/images/providers/hunyuan.svg",
      apiKeyUrl: "https://console.cloud.tencent.com/hunyuan",
      protocols: this.protocols,
      defaultApiUrl: this.defaultApiUrl,
    };
  }

  /**
   * 获取该供应商支持的模型列表
   */
  getModels(options?: ModelFilterOptions): ModelDefinition[] {
    if (!options) return this.models;

    return this.models.filter((model) => {
      if (options.modeType && model.modeType !== options.modeType) {
        return false;
      }
      if (options.feature && !model.config.features.includes(options.feature)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 获取指定模型的思考强度选项
   */
  getModelThinkingEfforts(modelName: string): string[] {
    const lowerName = modelName.toLowerCase();

    // Embedding 模型不支持思考
    if (lowerName.includes("embedding") || lowerName.includes("embed")) {
      return [];
    }

    // 所有其他模型支持开关模式
    return this.defaultThinkingEfforts;
  }
}
