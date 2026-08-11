import { Injectable } from '@nestjs/common';
import { IModelProvider, ProviderMetadata, ModelDefinition, ModelFilterOptions } from '../../types/provider.types';
import { OpenAIAdapter } from '../../adapters/openai.adapter';
import { IProtocolAdapter } from '../../adapters/base.adapter';
import { createTextModel, ConfigFragments } from '../../utils/model-config.helper';

/**
 * Groq 供应商实现
 * 以极致的推理速度著称，提供低延迟的大语言模型 API 服务
 */
@Injectable()
export class GroqProvider implements IModelProvider {
  readonly id = 'groq';
  readonly name = 'Groq';
  readonly protocols = ['openai'];
  readonly defaultApiUrl = 'https://api.groq.com/openai/v1/';
  
  // 内部持有 OpenAI 适配器实例（不需要私有定制）
  private adapter: OpenAIAdapter;
  
  constructor() {
    this.adapter = new OpenAIAdapter();
  }
  
  /**
   * 获取指定协议的适配器
   */
  getAdapter(protocol: string): IProtocolAdapter | null {
    if (protocol === 'openai') {
      return this.adapter;
    }
    return null;
  }
  
  // Groq 不支持强度控制，主要通过 reasoning_format 控制输出格式
  private defaultThinkingEfforts: string[] = [];
  
  private models: ModelDefinition[] = [
    // Llama 系列
    createTextModel(
      'llama-3.3-70b-versatile',
      ConfigFragments.ContextWindow._128K,
    ),
    createTextModel(
      'llama-3.1-8b-instant',
      ConfigFragments.ContextWindow._128K,
    ),
    createTextModel(
      'llama-4-scout-17b-16e-instruct',
      ConfigFragments.ContextWindow._128K,
    ),
    createTextModel(
      'llama-4-maverick-17b-128e-instruct',
      ConfigFragments.ContextWindow._128K,
    ),
    // DeepSeek 系列（Groq 托管）
    createTextModel(
      'deepseek-r1-distill-llama-70b',
      ConfigFragments.ContextWindow._128K,
    ),
    // Qwen 系列
    createTextModel(
      'qwen-2.5-coder-32b',
      ConfigFragments.ContextWindow._128K,
    ),
    // Gemma 系列
    createTextModel(
      'gemma2-9b-it',
      ConfigFragments.ContextWindow._8K,
    ),
    // 推理模型
    createTextModel(
      'openai-gpt-oss-120b',
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
      description: '以极致的推理速度著称，提供低延迟的大语言模型 API 服务。',
      avatarUrl: 'static/images/providers/groq.svg',
      apiKeyUrl: 'https://console.groq.com/keys',
      protocols: this.protocols,
      defaultApiUrl: this.defaultApiUrl,
    };
  }
  
  /**
   * 获取该供应商支持的模型列表
   */
  getModels(options?: ModelFilterOptions): ModelDefinition[] {
    if (!options) return this.models;
    
    return this.models.filter(model => {
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
   * Groq 不支持强度控制
   */
  getModelThinkingEfforts(modelName: string): string[] {
    // Groq 所有模型都不支持推理强度控制
    return this.defaultThinkingEfforts;
  }
}
