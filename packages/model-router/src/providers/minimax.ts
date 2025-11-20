/**
 * @module minimax
 * @description MiniMax provider supporting M2.1, M2.5, M2.7 models
 * Note: M2.1 outperforms M2.5 in many benchmarks — M2.1 is recommended for most use cases
 */

import { BaseModelProvider } from "./base";
import {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from "../types/models";

const MINIMAX_API_BASE = "https://api.minimax.chat/v1";

export class MiniMaxProvider extends BaseModelProvider {
  readonly name = "minimax";
  private groupId: string;

  constructor(config: ModelConfig) {
    super(config);
    this.groupId = process.env.MINIMAX_GROUP_ID || "";
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("MiniMax API key not configured");

    const startTime = Date.now();
    const endpoint = this.config.apiEndpoint || MINIMAX_API_BASE;

    const body = {
      model: this.config.modelName,
      messages: request.messages.map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      top_p: request.topP ?? 0.95,
      tools: request.tools,
      tool_choice: request.toolChoice,
      stream: false,
    };

    const response = await fetch(`${endpoint}/text/chatcompletion_v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(this.groupId ? { "X-MiniMax-Group-Id": this.groupId } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      id: data.id || this.generateId(),
      model: this.config.modelName,
      provider: "minimax",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: data.choices?.[0]?.message?.content || data.reply || "",
          },
          finishReason: data.choices?.[0]?.finish_reason || "stop",
        },
      ],
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      createdAt: new Date(),
      latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("MiniMax API key not configured");

    const endpoint = this.config.apiEndpoint || MINIMAX_API_BASE;

    const body = {
      model: this.config.modelName,
      messages: request.messages.map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      stream: true,
    };

    const response = await fetch(`${endpoint}/text/chatcompletion_v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(this.groupId ? { "X-MiniMax-Group-Id": this.groupId } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(`MiniMax streaming error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            yield {
              id: parsed.id || this.generateId(),
              model: this.config.modelName,
              choices: [
                {
                  index: 0,
                  delta: {
                    role: "assistant",
                    content: parsed.choices?.[0]?.delta?.content || "",
                  },
                  finishReason: parsed.choices?.[0]?.finish_reason || null,
                },
              ],
            };
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }
}
