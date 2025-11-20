/**
 * @module google
 * @description Google AI provider supporting Gemini-3-flash and future Gemini models
 */

import { BaseModelProvider } from "./base";
import {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from "../types/models";

const GOOGLE_AI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GoogleProvider extends BaseModelProvider {
  readonly name = "google";

  constructor(config: ModelConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("Google AI API key not configured");

    const startTime = Date.now();
    const endpoint =
      this.config.apiEndpoint ||
      `${GOOGLE_AI_BASE}/models/${this.config.modelName}:generateContent?key=${apiKey}`;

    const body = this.convertToGeminiFormat(request);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google AI error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .join("") || "";

    return {
      id: this.generateId(),
      model: this.config.modelName,
      provider: "google",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finishReason:
            data.candidates?.[0]?.finishReason === "STOP" ? "stop" : "stop",
        },
      ],
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      createdAt: new Date(),
      latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("Google AI API key not configured");

    const endpoint =
      this.config.apiEndpoint ||
      `${GOOGLE_AI_BASE}/models/${this.config.modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const body = this.convertToGeminiFormat(request);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Google AI streaming error: ${response.status}`);
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
            const text =
              parsed.candidates?.[0]?.content?.parts
                ?.map((p: any) => p.text)
                .join("") || "";

            yield {
              id: this.generateId(),
              model: this.config.modelName,
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: text },
                  finishReason:
                    parsed.candidates?.[0]?.finishReason === "STOP"
                      ? "stop"
                      : null,
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

  private convertToGeminiFormat(request: CompletionRequest): Record<string, unknown> {
    const contents: any[] = [];
    let systemInstruction: any = undefined;

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemInstruction = {
          parts: [{ text: typeof msg.content === "string" ? msg.content : "" }],
        };
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [
            {
              text:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            },
          ],
        });
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        topP: request.topP ?? 0.95,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
        },
      ];
    }

    return body;
  }
}
