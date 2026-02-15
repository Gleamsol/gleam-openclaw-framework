/**
 * @module conversation-compressor
 * @description Long conversation compression mechanism for OpenClaw.
 * Reduces token consumption by intelligently compressing conversation history
 * while preserving critical context and information.
 */

export interface CompressorConfig {
  maxTokens: number;
  compressionThreshold: number;
  preserveRecentMessages: number;
  preserveSystemPrompt: boolean;
  strategy: CompressionStrategy;
  summaryModel?: string;
}

export type CompressionStrategy =
  | "sliding_window"
  | "summary"
  | "hybrid"
  | "importance_weighted";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  timestamp?: Date;
  importance?: number;
  tokenCount?: number;
}

export interface CompressionResult {
  messages: Message[];
  originalTokenCount: number;
  compressedTokenCount: number;
  compressionRatio: number;
  summaryGenerated: boolean;
  messagesRemoved: number;
}

export class ConversationCompressor {
  private config: Required<CompressorConfig>;

  constructor(config?: Partial<CompressorConfig>) {
    this.config = {
      maxTokens: config?.maxTokens || 8000,
      compressionThreshold: config?.compressionThreshold || 0.75,
      preserveRecentMessages: config?.preserveRecentMessages || 10,
      preserveSystemPrompt: config?.preserveSystemPrompt ?? true,
      strategy: config?.strategy || "hybrid",
      summaryModel: config?.summaryModel || "gpt-5.4",
    };
  }

  async compress(messages: Message[]): Promise<CompressionResult> {
    const originalTokenCount = this.estimateTokens(messages);

    // Check if compression is needed
    if (originalTokenCount <= this.config.maxTokens) {
      return {
        messages,
        originalTokenCount,
        compressedTokenCount: originalTokenCount,
        compressionRatio: 1,
        summaryGenerated: false,
        messagesRemoved: 0,
      };
    }

    let compressed: Message[];

    switch (this.config.strategy) {
      case "sliding_window":
        compressed = this.slidingWindowCompress(messages);
        break;
      case "summary":
        compressed = await this.summaryCompress(messages);
        break;
      case "importance_weighted":
        compressed = this.importanceWeightedCompress(messages);
        break;
      case "hybrid":
      default:
        compressed = await this.hybridCompress(messages);
        break;
    }

    const compressedTokenCount = this.estimateTokens(compressed);

    return {
      messages: compressed,
      originalTokenCount,
      compressedTokenCount,
      compressionRatio: compressedTokenCount / originalTokenCount,
      summaryGenerated: this.config.strategy !== "sliding_window",
      messagesRemoved: messages.length - compressed.length,
    };
  }

  private slidingWindowCompress(messages: Message[]): Message[] {
    const result: Message[] = [];

    // Preserve system prompt
    if (this.config.preserveSystemPrompt) {
      const systemMsg = messages.find((m) => m.role === "system");
      if (systemMsg) result.push(systemMsg);
    }

    // Keep only recent messages
    const nonSystem = messages.filter((m) => m.role !== "system");
    const recent = nonSystem.slice(-this.config.preserveRecentMessages);
    result.push(...recent);

    return result;
  }

  private async summaryCompress(messages: Message[]): Promise<Message[]> {
    const result: Message[] = [];

    // Preserve system prompt
    if (this.config.preserveSystemPrompt) {
      const systemMsg = messages.find((m) => m.role === "system");
      if (systemMsg) result.push(systemMsg);
    }

    // Split into old and recent messages
    const nonSystem = messages.filter((m) => m.role !== "system");
    const splitIndex = Math.max(0, nonSystem.length - this.config.preserveRecentMessages);
    const oldMessages = nonSystem.slice(0, splitIndex);
    const recentMessages = nonSystem.slice(splitIndex);

    // Generate summary of old messages
    if (oldMessages.length > 0) {
      const summary = this.generateLocalSummary(oldMessages);
      result.push({
        role: "system",
        content: `[Conversation Summary]\n${summary}`,
        timestamp: new Date(),
      });
    }

    result.push(...recentMessages);
    return result;
  }

  private importanceWeightedCompress(messages: Message[]): Message[] {
    const result: Message[] = [];

    // Preserve system prompt
    if (this.config.preserveSystemPrompt) {
      const systemMsg = messages.find((m) => m.role === "system");
      if (systemMsg) result.push(systemMsg);
    }

    const nonSystem = messages.filter((m) => m.role !== "system");

    // Score each message by importance
    const scored = nonSystem.map((msg, index) => ({
      message: msg,
      score: this.calculateImportance(msg, index, nonSystem.length),
    }));

    // Sort by score and keep the most important ones within token budget
    scored.sort((a, b) => b.score - a.score);

    let tokenBudget = this.config.maxTokens - this.estimateTokens(result);
    const selected: typeof scored = [];

    for (const item of scored) {
      const tokens = this.estimateMessageTokens(item.message);
      if (tokenBudget - tokens >= 0) {
        selected.push(item);
        tokenBudget -= tokens;
      }
    }

    // Restore original order
    selected.sort((a, b) => {
      const aIdx = nonSystem.indexOf(a.message);
      const bIdx = nonSystem.indexOf(b.message);
      return aIdx - bIdx;
    });

    result.push(...selected.map((s) => s.message));
    return result;
  }

  private async hybridCompress(messages: Message[]): Promise<Message[]> {
    const result: Message[] = [];

    // Preserve system prompt
    if (this.config.preserveSystemPrompt) {
      const systemMsg = messages.find((m) => m.role === "system");
      if (systemMsg) result.push(systemMsg);
    }

    const nonSystem = messages.filter((m) => m.role !== "system");
    const splitIndex = Math.max(0, nonSystem.length - this.config.preserveRecentMessages);
    const oldMessages = nonSystem.slice(0, splitIndex);
    const recentMessages = nonSystem.slice(splitIndex);

    // Summarize old messages
    if (oldMessages.length > 0) {
      const summary = this.generateLocalSummary(oldMessages);
      result.push({
        role: "system",
        content: `[Previous Conversation Summary]\n${summary}`,
        timestamp: new Date(),
      });
    }

    // Apply importance weighting to recent messages if still over budget
    let tokenCount = this.estimateTokens(result);
    const remaining = this.config.maxTokens - tokenCount;

    if (this.estimateTokens(recentMessages) > remaining) {
      // Keep most important recent messages
      const scored = recentMessages.map((msg, index) => ({
        message: msg,
        score: this.calculateImportance(msg, index + splitIndex, nonSystem.length),
      }));
      scored.sort((a, b) => b.score - a.score);

      let budget = remaining;
      const selected: Message[] = [];
      for (const item of scored) {
        const tokens = this.estimateMessageTokens(item.message);
        if (budget - tokens >= 0) {
          selected.push(item.message);
          budget -= tokens;
        }
      }

      // Restore order
      result.push(
        ...selected.sort(
          (a, b) =>
            recentMessages.indexOf(a) - recentMessages.indexOf(b)
        )
      );
    } else {
      result.push(...recentMessages);
    }

    return result;
  }

  private generateLocalSummary(messages: Message[]): string {
    // Local summary generation without model call
    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");

    const topics = new Set<string>();
    for (const msg of userMessages) {
      const words = msg.content.split(/\s+/).filter((w) => w.length > 4);
      words.slice(0, 5).forEach((w) => topics.add(w));
    }

    const summary = [
      `Conversation contained ${messages.length} messages (${userMessages.length} user, ${assistantMessages.length} assistant).`,
      topics.size > 0 ? `Key topics discussed: ${Array.from(topics).slice(0, 10).join(", ")}.` : "",
      assistantMessages.length > 0
        ? `Last assistant response covered: ${assistantMessages[assistantMessages.length - 1]?.content.substring(0, 200)}...`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return summary;
  }

  private calculateImportance(
    message: Message,
    index: number,
    totalMessages: number
  ): number {
    let score = 0;

    // Explicit importance
    if (message.importance) score += message.importance * 10;

    // Recency bias
    score += (index / totalMessages) * 50;

    // Role weighting
    if (message.role === "user") score += 20;
    if (message.role === "assistant") score += 15;
    if (message.role === "tool") score += 10;

    // Content length (longer = more important)
    score += Math.min(message.content.length / 100, 20);

    // Contains code or structured data
    if (message.content.includes("```")) score += 15;
    if (message.content.includes("{") && message.content.includes("}")) score += 10;

    return score;
  }

  private estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
  }

  private estimateMessageTokens(message: Message): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(message.content.length / 4) + 4;
  }
}
