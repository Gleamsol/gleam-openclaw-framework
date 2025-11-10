/**
 * @gleam-openclaw/model-router
 *
 * Unified AI model router supporting GPT-5.4, MiniMax M2.1/M2.5/M2.7,
 * Gemini-3-flash, Kimi-K2.5, and Anthropic Vertex (Claude).
 *
 * Performance Notes:
 * - GPT-5.4 is the default flagship model
 * - MiniMax M2.1 outperforms M2.5 — recommended for most tasks
 * - MiniMax M2.7 is the latest integrated flagship
 * - Gemini-3-flash offers the best cost-performance ratio
 */

export * from "./types/models";
export { BaseModelProvider, type ModelProviderInterface } from "./providers/base";
export { OpenAIProvider } from "./providers/openai";
export { MiniMaxProvider } from "./providers/minimax";
export { GoogleProvider } from "./providers/google";
export { KimiProvider } from "./providers/kimi";
export { AnthropicProvider } from "./providers/anthropic";
export {
  UnifiedModelRouter,
  type RouterConfig,
  type RouterEvents,
  type RoutingStrategy,
} from "./router/unified-router";
