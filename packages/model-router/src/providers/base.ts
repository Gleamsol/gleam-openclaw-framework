/**
 * @module base
 * @description Base provider interface and abstract class for AI model providers
 */

import {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from "../types/models";

export interface ModelProviderInterface {
  readonly name: string;
  readonly config: ModelConfig;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown>;
  isAvailable(): Promise<boolean>;
  getApiKey(): string | undefined;
}

export abstract class BaseModelProvider implements ModelProviderInterface {
  abstract readonly name: string;
  readonly config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  abstract stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown>;

  async isAvailable(): Promise<boolean> {
    const apiKey = this.getApiKey();
    return !!apiKey && this.config.enabled;
  }

  getApiKey(): string | undefined {
    return process.env[this.config.apiKeyEnvVar];
  }

  protected generateId(): string {
    return `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
