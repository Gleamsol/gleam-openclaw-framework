/**
 * @module telegram-topic-namer
 * @description Telegram topic auto-naming for OpenClaw bot.
 * Automatically generates meaningful topic names based on conversation content.
 */

export interface TelegramBotConfig {
  botToken: string;
  defaultTopicIcon?: string;
  maxTopicNameLength?: number;
  namingModel?: string;
}

export interface TopicInfo {
  messageThreadId: number;
  name: string;
  iconColor?: number;
  iconCustomEmojiId?: string;
  createdAt: Date;
  autoNamed: boolean;
}

export interface NamingStrategy {
  type: "first_message" | "summary" | "keyword" | "model";
  maxLength?: number;
}

export class TelegramTopicNamer {
  private config: TelegramBotConfig;
  private topics: Map<number, TopicInfo> = new Map();
  private namingStrategy: NamingStrategy;

  constructor(
    config: TelegramBotConfig,
    strategy?: NamingStrategy
  ) {
    this.config = config;
    this.namingStrategy = strategy || { type: "summary", maxLength: 64 };
  }

  async autoNameTopic(
    chatId: number,
    messageThreadId: number,
    messages: string[]
  ): Promise<string> {
    let topicName: string;

    switch (this.namingStrategy.type) {
      case "first_message":
        topicName = this.nameFromFirstMessage(messages);
        break;
      case "keyword":
        topicName = this.nameFromKeywords(messages);
        break;
      case "model":
        topicName = await this.nameFromModel(messages);
        break;
      case "summary":
      default:
        topicName = this.nameFromSummary(messages);
        break;
    }

    // Truncate to max length
    const maxLen = this.namingStrategy.maxLength || 64;
    topicName = topicName.substring(0, maxLen);

    // Update topic name via Telegram API
    await this.editForumTopic(chatId, messageThreadId, topicName);

    // Store topic info
    this.topics.set(messageThreadId, {
      messageThreadId,
      name: topicName,
      createdAt: new Date(),
      autoNamed: true,
    });

    return topicName;
  }

  async editForumTopic(
    chatId: number,
    messageThreadId: number,
    name: string,
    iconCustomEmojiId?: string
  ): Promise<boolean> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      message_thread_id: messageThreadId,
      name,
    };

    if (iconCustomEmojiId) {
      params.icon_custom_emoji_id = iconCustomEmojiId;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.botToken}/editForumTopic`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }
    );

    const data = await response.json();
    return data.ok === true;
  }

  async createForumTopic(
    chatId: number,
    name: string,
    iconColor?: number,
    iconCustomEmojiId?: string
  ): Promise<number> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      name,
    };

    if (iconColor) params.icon_color = iconColor;
    if (iconCustomEmojiId) params.icon_custom_emoji_id = iconCustomEmojiId;

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.botToken}/createForumTopic`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }
    );

    const data = await response.json();
    if (!data.ok) throw new Error(`Failed to create topic: ${data.description}`);

    return data.result.message_thread_id;
  }

  async sendMessageToTopic(
    chatId: number,
    messageThreadId: number,
    text: string,
    parseMode?: "Markdown" | "MarkdownV2" | "HTML"
  ): Promise<any> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_thread_id: messageThreadId,
          text,
          parse_mode: parseMode || "MarkdownV2",
        }),
      }
    );

    return response.json();
  }

  getTopicInfo(messageThreadId: number): TopicInfo | undefined {
    return this.topics.get(messageThreadId);
  }

  private nameFromFirstMessage(messages: string[]): string {
    if (messages.length === 0) return "New Conversation";
    const first = messages[0].trim();
    return first.length > 50 ? first.substring(0, 47) + "..." : first;
  }

  private nameFromSummary(messages: string[]): string {
    if (messages.length === 0) return "New Conversation";

    const combined = messages.join(" ").substring(0, 500);
    const words = combined.split(/\s+/).filter((w) => w.length > 3);
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      const lower = word.toLowerCase().replace(/[^a-zA-Z\u4e00-\u9fff]/g, "");
      if (lower.length < 2) continue;
      wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
    }

    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([w]) => w);

    return topWords.length > 0 ? topWords.join(" ") : "New Conversation";
  }

  private nameFromKeywords(messages: string[]): string {
    const combined = messages.join(" ");
    // Extract key phrases using simple heuristics
    const sentences = combined.split(/[.!?。！？]/).filter((s) => s.trim().length > 5);
    if (sentences.length === 0) return "New Conversation";
    return sentences[0].trim().substring(0, 64);
  }

  private async nameFromModel(messages: string[]): Promise<string> {
    // In production, call the model router to generate a topic name
    // For now, fall back to summary-based naming
    return this.nameFromSummary(messages);
  }
}
