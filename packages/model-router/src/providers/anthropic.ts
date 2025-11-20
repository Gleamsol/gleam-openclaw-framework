/**
 * @module anthropic
 * @description Anthropic provider with Vertex AI integration for Claude models
 */

import { BaseModelProvider } from "./base";
import {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from "../types/models";

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";

export class AnthropicProvider extends BaseModelProvider {
  readonly name = "anthropic";

  constructor(config: ModelConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("Anthropic API key not configured");

    const startTime = Date.now();
    const endpoint = this.config.apiEndpoint || `${ANTHROPIC_API_BASE}/messages`;

    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.config.modelName,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? 0.7,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    };

    if (systemMessage) {
      body.system =
        typeof systemMessage.content === "string"
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const content = data.content
      ?.map((block: any) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("") || "";

    return {
      id: data.id || this.generateId(),
      model: data.model || this.config.modelName,
      provider: "anthropic",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finishReason: data.stop_reason === "end_turn" ? "stop" : "stop",
        },
      ],
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens:
          (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      createdAt: new Date(),
      latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("Anthropic API key not configured");

    const endpoint = this.config.apiEndpoint || `${ANTHROPIC_API_BASE}/messages`;

    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.config.modelName,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? 0.7,
      stream: true,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    };

    if (systemMessage) {
      body.system =
        typeof systemMessage.content === "string"
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Anthropic streaming error: ${response.status}`);
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

            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield {
                id: this.generateId(),
                model: this.config.modelName,
                choices: [
                  {
                    index: 0,
                    delta: { role: "assistant", content: parsed.delta.text },
                    finishReason: null,
                  },
                ],
              };
            }

            if (parsed.type === "message_stop") {
              yield {
                id: this.generateId(),
                model: this.config.modelName,
                choices: [
                  {
                    index: 0,
                    delta: { role: "assistant", content: "" },
                    finishReason: "stop",
                  },
                ],
              };
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }
}
