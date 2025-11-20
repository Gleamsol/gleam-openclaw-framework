/**
 * @module kimi
 * @description Kimi (Moonshot AI) provider supporting K2.5 model — OpenAI-compatible API
 */

import OpenAI from "openai";
import { BaseModelProvider } from "./base";
import {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ChatMessage,
} from "../types/models";

const KIMI_API_BASE = "https://api.moonshot.cn/v1";

export class KimiProvider extends BaseModelProvider {
  readonly name = "kimi";
  private client: OpenAI | null = null;

  constructor(config: ModelConfig) {
    super(config);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.getApiKey();
      if (!apiKey) throw new Error("Kimi API key not configured");

      this.client = new OpenAI({
        apiKey,
        baseURL: this.config.apiEndpoint || KIMI_API_BASE,
        maxRetries: 3,
        timeout: 120000,
      });
    }
    return this.client;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = this.getClient();
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: this.config.modelName,
      messages: request.messages as any,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      top_p: request.topP,
      tools: request.tools as any,
      tool_choice: request.toolChoice as any,
      stream: false,
    });

    const latencyMs = Date.now() - startTime;

    return {
      id: response.id,
      model: response.model,
      provider: "kimi",
      choices: response.choices.map((choice, index) => ({
        index,
        message: {
          role: choice.message.role as ChatMessage["role"],
          content: choice.message.content || "",
          tool_calls: choice.message.tool_calls as any,
        },
        finishReason: (choice.finish_reason as any) || "stop",
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      createdAt: new Date(),
      latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getClient();

    const stream = await client.chat.completions.create({
      model: this.config.modelName,
      messages: request.messages as any,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        id: chunk.id,
        model: chunk.model,
        choices: chunk.choices.map((choice) => ({
          index: choice.index,
          delta: {
            role: choice.delta?.role as ChatMessage["role"],
            content: choice.delta?.content || "",
          },
          finishReason: choice.finish_reason,
        })),
      };
    }
  }
}
