/**
 * @module models
 * @description Type definitions for the unified model router
 */

export type ModelProvider =
  | "openai"
  | "minimax"
  | "google"
  | "kimi"
  | "anthropic";

export type ModelTier = "flagship" | "standard" | "lite" | "experimental";

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  modelName: string;
  displayName: string;
  tier: ModelTier;
  maxTokens: number;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
  apiEndpoint?: string;
  apiKeyEnvVar: string;
  headers?: Record<string, string>;
  enabled: boolean;
  priority: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ContentPart {
  type: "text" | "image_url" | "audio";
  text?: string;
  image_url?: { url: string; detail?: "low" | "high" | "auto" };
  audio?: { data: string; format: "wav" | "mp3" };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  responseFormat?: { type: "text" | "json_object" };
  stop?: string[];
  metadata?: Record<string, unknown>;
}

export interface CompletionResponse {
  id: string;
  model: string;
  provider: ModelProvider;
  choices: CompletionChoice[];
  usage: TokenUsage;
  createdAt: Date;
  latencyMs: number;
}

export interface CompletionChoice {
  index: number;
  message: ChatMessage;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  id: string;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finishReason: string | null;
  }[];
}

/** Default model configurations for all supported models */
export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.4",
    provider: "openai",
    modelName: "gpt-5.4",
    displayName: "GPT-5.4 (Flagship)",
    tier: "flagship",
    maxTokens: 32768,
    contextWindow: 256000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.00003,
    costPerOutputToken: 0.00006,
    apiKeyEnvVar: "OPENAI_API_KEY",
    enabled: true,
    priority: 100,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 2000000 },
  },
  {
    id: "minimax-m2.7",
    provider: "minimax",
    modelName: "minimax-m2.7",
    displayName: "MiniMax M2.7",
    tier: "flagship",
    maxTokens: 16384,
    contextWindow: 128000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00002,
    apiKeyEnvVar: "MINIMAX_API_KEY",
    enabled: true,
    priority: 90,
    rateLimit: { requestsPerMinute: 300, tokensPerMinute: 1000000 },
  },
  {
    id: "minimax-m2.5",
    provider: "minimax",
    modelName: "minimax-m2.5",
    displayName: "MiniMax M2.5",
    tier: "standard",
    maxTokens: 16384,
    contextWindow: 128000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000008,
    costPerOutputToken: 0.000016,
    apiKeyEnvVar: "MINIMAX_API_KEY",
    enabled: true,
    priority: 70,
    rateLimit: { requestsPerMinute: 300, tokensPerMinute: 1000000 },
  },
  {
    id: "minimax-m2.1",
    provider: "minimax",
    modelName: "minimax-m2.1",
    displayName: "MiniMax M2.1 (Recommended)",
    tier: "standard",
    maxTokens: 8192,
    contextWindow: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000005,
    costPerOutputToken: 0.00001,
    apiKeyEnvVar: "MINIMAX_API_KEY",
    enabled: true,
    priority: 80,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 1500000 },
  },
  {
    id: "gemini-3-flash",
    provider: "google",
    modelName: "gemini-3-flash",
    displayName: "Gemini 3 Flash",
    tier: "standard",
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000001,
    costPerOutputToken: 0.000004,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    enabled: true,
    priority: 85,
    rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 4000000 },
  },
  {
    id: "kimi-k2.5",
    provider: "kimi",
    modelName: "kimi-k2.5",
    displayName: "Kimi K2.5",
    tier: "standard",
    maxTokens: 8192,
    contextWindow: 128000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000008,
    costPerOutputToken: 0.000016,
    apiKeyEnvVar: "KIMI_API_KEY",
    enabled: true,
    priority: 75,
    rateLimit: { requestsPerMinute: 300, tokensPerMinute: 1000000 },
  },
  {
    id: "claude-vertex",
    provider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    displayName: "Anthropic Claude (Vertex)",
    tier: "flagship",
    maxTokens: 16384,
    contextWindow: 200000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    enabled: true,
    priority: 95,
    rateLimit: { requestsPerMinute: 200, tokensPerMinute: 800000 },
  },
];
