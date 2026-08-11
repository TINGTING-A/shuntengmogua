import { Injectable } from "@nestjs/common";
import {
  IModelProvider,
  ProviderMetadata,
  ModelDefinition,
  ModelFilterOptions,
} from "../../types/provider.types";
import { SparkOpenAIAdapter } from "./spark-openai.adapter";
import { IProtocolAdapter } from "../../adapters/base.adapter";
import { createTextModel, createMultimodalModel, ConfigFragments } from "../../utils/model-config.helper";

/**
 * 讯飞星火供应商实现
 * 科大讯飞星火大模型，提供星火系列模型（通用/推理/多模态）
 */
@Injectable()
export class SparkProvider implements IModelProvider {
  readonly id = "spark";
  readonly name = "讯飞星火";
  readonly protocols = ["openai"];
  readonly defaultApiUrl = "https://spark-api-open.xf-yun.com/v1";

  // 内部持有星火专用的适配器实例
  private adapter: SparkOpenAIAdapter;

  constructor() {
    this.adapter = new SparkOpenAIAdapter();
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

  // 讯飞星火支持开关模式
  private defaultThinkingEfforts: string[] = ["off", "on"];

  private models: ModelDefinition[] = [
    // 星火 4.5 系列
    createMultimodalModel(
      "spark4.5-20250722",
      ConfigFragments.ContextWindow._128K,
    ),
    // 星火 4.0 系列
    createMultimodalModel(
      "spark4.0-0828",
      ConfigFragments.ContextWindow._128K,
    ),
    // 星火 3.5 系列
    createMultimodalModel(
      "spark-max",
      ConfigFragments.ContextWindow._128K,
    ),
    createMultimodalModel(
      "spark-pro",
      ConfigFragments.ContextWindow._128K,
    ),
    createMultimodalModel(
      "spark-lite",
      ConfigFragments.ContextWindow._128K,
    ),
    // 星火代码系列
    createTextModel(
      "spark-code",
      ConfigFragments.ContextWindow._128K,
    ),
    // 星火数学/通用（Spark4 新命名）
    createMultimodalModel(
      "spark4.0-250321",
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
        "科大讯飞星火大模型，提供星火系列模型：通用对话、代码生成、数学推理等。",
      avatarUrl: "static/images/providers/spark.svg",
      apiKeyUrl: "https://console.xfyun.cn/services/bm35",
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
