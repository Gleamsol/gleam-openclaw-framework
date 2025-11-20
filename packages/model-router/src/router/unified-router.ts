/**
 * @module unified-router
 * @description Unified model router with intelligent routing, fallback, and load balancing
 *
 * Model Performance Notes:
 * - GPT-5.4: Default flagship model, top-tier performance across all tasks
 * - MiniMax M2.1: Outperforms M2.5 in reasoning and instruction following — recommended over M2.5
 * - MiniMax M2.7: Latest flagship from MiniMax, integrated for advanced tasks
 * - Gemini-3-flash: Excellent cost-performance ratio with 1M context window
 * - Kimi-K2.5: Strong Chinese language understanding and long-context tasks
 * - Anthropic Vertex: Premium reasoning and safety-focused model
 */

import EventEmitter from "eventemitter3";
import {
  ModelConfig,
  ModelProvider,
  ModelTier,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  DEFAULT_MODELS,
} from "../types/models";
import { ModelProviderInterface } from "../providers/base";
import { OpenAIProvider } from "../providers/openai";
import { MiniMaxProvider } from "../providers/minimax";
import { GoogleProvider } from "../providers/google";
import { KimiProvider } from "../providers/kimi";
import { AnthropicProvider } from "../providers/anthropic";

export type RoutingStrategy =
  | "priority"
  | "round-robin"
  | "least-latency"
  | "cost-optimized"
  | "capability-match";

export interface RouterConfig {
  models?: ModelConfig[];
  defaultModel?: string;
  strategy?: RoutingStrategy;
  enableFallback?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RouterEvents {
  modelSelected: (modelId: string, reason: string) => void;
  fallback: (fromModel: string, toModel: string, error: Error) => void;
  requestComplete: (modelId: string, latencyMs: number) => void;
  error: (modelId: string, error: Error) => void;
}

interface ModelStats {
  totalRequests: number;
  totalErrors: number;
  totalLatencyMs: number;
  lastUsed: Date | null;
}

export class UnifiedModelRouter extends EventEmitter<RouterEvents> {
  private providers: Map<string, ModelProviderInterface> = new Map();
  private models: Map<string, ModelConfig> = new Map();
  private stats: Map<string, ModelStats> = new Map();
  private defaultModelId: string;
  private strategy: RoutingStrategy;
  private enableFallback: boolean;
  private maxRetries: number;
  private retryDelay: number;
  private roundRobinIndex: number = 0;

  constructor(config: RouterConfig = {}) {
    super();

    const modelConfigs = config.models || DEFAULT_MODELS;
    this.defaultModelId = config.defaultModel || "gpt-5.4";
    this.strategy = config.strategy || "priority";
    this.enableFallback = config.enableFallback ?? true;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelay = config.retryDelay ?? 1000;

    for (const modelConfig of modelConfigs) {
      this.registerModel(modelConfig);
    }
  }

  registerModel(config: ModelConfig): void {
    this.models.set(config.id, config);
    this.stats.set(config.id, {
      totalRequests: 0,
      totalErrors: 0,
      totalLatencyMs: 0,
      lastUsed: null,
    });

    const provider = this.createProvider(config);
    if (provider) {
      this.providers.set(config.id, provider);
    }
  }

  private createProvider(config: ModelConfig): ModelProviderInterface | null {
    switch (config.provider) {
      case "openai":
        return new OpenAIProvider(config);
      case "minimax":
        return new MiniMaxProvider(config);
      case "google":
        return new GoogleProvider(config);
      case "kimi":
        return new KimiProvider(config);
      case "anthropic":
        return new AnthropicProvider(config);
      default:
        return null;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model || this.selectModel(request);
    const fallbackChain = this.getFallbackChain(modelId);

    for (const currentModelId of fallbackChain) {
      const provider = this.providers.get(currentModelId);
      if (!provider) continue;

      const isAvailable = await provider.isAvailable();
      if (!isAvailable) continue;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          this.emit("modelSelected", currentModelId, this.strategy);

          const response = await provider.complete({
            ...request,
            model: this.models.get(currentModelId)?.modelName,
          });

          this.updateStats(currentModelId, response.latencyMs, false);
          this.emit("requestComplete", currentModelId, response.latencyMs);

          return response;
        } catch (error: any) {
          this.updateStats(currentModelId, 0, true);
          this.emit("error", currentModelId, error);

          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * (attempt + 1));
          }
        }
      }

      if (this.enableFallback && fallbackChain.indexOf(currentModelId) < fallbackChain.length - 1) {
        const nextModel = fallbackChain[fallbackChain.indexOf(currentModelId) + 1];
        this.emit(
          "fallback",
          currentModelId,
          nextModel,
          new Error("Max retries exceeded")
        );
      }
    }

    throw new Error(
      `All models in the fallback chain failed for request. Tried: ${fallbackChain.join(", ")}`
    );
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const modelId = request.model || this.selectModel(request);
    const provider = this.providers.get(modelId);

    if (!provider) {
      throw new Error(`Model provider not found: ${modelId}`);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`Model ${modelId} is not available`);
    }

    this.emit("modelSelected", modelId, this.strategy);

    yield* provider.stream({
      ...request,
      model: this.models.get(modelId)?.modelName,
    });
  }

  selectModel(request: CompletionRequest): string {
    const enabledModels = Array.from(this.models.values()).filter(
      (m) => m.enabled
    );

    if (enabledModels.length === 0) {
      throw new Error("No models are enabled");
    }

    switch (this.strategy) {
      case "priority":
        return this.selectByPriority(enabledModels);
      case "round-robin":
        return this.selectRoundRobin(enabledModels);
      case "least-latency":
        return this.selectByLatency(enabledModels);
      case "cost-optimized":
        return this.selectByCost(enabledModels, request);
      case "capability-match":
        return this.selectByCapability(enabledModels, request);
      default:
        return this.defaultModelId;
    }
  }

  private selectByPriority(models: ModelConfig[]): string {
    const sorted = [...models].sort((a, b) => b.priority - a.priority);
    return sorted[0].id;
  }

  private selectRoundRobin(models: ModelConfig[]): string {
    const sorted = [...models].sort((a, b) => b.priority - a.priority);
    const index = this.roundRobinIndex % sorted.length;
    this.roundRobinIndex++;
    return sorted[index].id;
  }

  private selectByLatency(models: ModelConfig[]): string {
    let bestModel = models[0];
    let bestAvgLatency = Infinity;

    for (const model of models) {
      const stats = this.stats.get(model.id);
      if (stats && stats.totalRequests > 0) {
        const avgLatency = stats.totalLatencyMs / stats.totalRequests;
        if (avgLatency < bestAvgLatency) {
          bestAvgLatency = avgLatency;
          bestModel = model;
        }
      }
    }

    return bestModel.id;
  }

  private selectByCost(
    models: ModelConfig[],
    request: CompletionRequest
  ): string {
    const sorted = [...models].sort(
      (a, b) => a.costPerInputToken - b.costPerInputToken
    );
    return sorted[0].id;
  }

  private selectByCapability(
    models: ModelConfig[],
    request: CompletionRequest
  ): string {
    const needsVision = request.messages.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url")
    );
    const needsTools = !!request.tools && request.tools.length > 0;

    let candidates = models;

    if (needsVision) {
      candidates = candidates.filter((m) => m.supportsVision);
    }
    if (needsTools) {
      candidates = candidates.filter((m) => m.supportsTools);
    }

    if (candidates.length === 0) {
      return this.defaultModelId;
    }

    return this.selectByPriority(candidates);
  }

  private getFallbackChain(primaryModelId: string): string[] {
    if (!this.enableFallback) return [primaryModelId];

    const allModels = Array.from(this.models.values())
      .filter((m) => m.enabled)
      .sort((a, b) => b.priority - a.priority);

    const chain = [primaryModelId];

    for (const model of allModels) {
      if (model.id !== primaryModelId) {
        chain.push(model.id);
      }
    }

    return chain;
  }

  private updateStats(
    modelId: string,
    latencyMs: number,
    isError: boolean
  ): void {
    const stats = this.stats.get(modelId);
    if (stats) {
      stats.totalRequests++;
      stats.totalLatencyMs += latencyMs;
      stats.lastUsed = new Date();
      if (isError) stats.totalErrors++;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getModelStats(): Record<string, ModelStats> {
    const result: Record<string, ModelStats> = {};
    for (const [id, stats] of this.stats) {
      result[id] = { ...stats };
    }
    return result;
  }

  getAvailableModels(): ModelConfig[] {
    return Array.from(this.models.values()).filter((m) => m.enabled);
  }

  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id);
  }

  setDefaultModel(modelId: string): void {
    if (!this.models.has(modelId)) {
      throw new Error(`Model ${modelId} is not registered`);
    }
    this.defaultModelId = modelId;
  }

  setStrategy(strategy: RoutingStrategy): void {
    this.strategy = strategy;
  }

  enableModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) model.enabled = true;
  }

  disableModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) model.enabled = false;
  }
}
