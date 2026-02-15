/**
 * @module lark-interactive-card
 * @description Lark (Feishu) interactive card builder for OpenClaw bot integration.
 * Supports rich message cards with actions, forms, and dynamic updates.
 */

export interface LarkCardConfig {
  appId: string;
  appSecret: string;
  webhookUrl?: string;
  verificationToken?: string;
}

export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

export interface CardAction {
  tag: "button" | "select_menu" | "overflow" | "date_picker" | "picker_time";
  text?: { tag: "plain_text" | "lark_md"; content: string };
  value?: Record<string, unknown>;
  type?: "default" | "primary" | "danger";
  url?: string;
  options?: Array<{ text: { tag: string; content: string }; value: string }>;
}

export interface LarkCard {
  config?: { wide_screen_mode?: boolean; enable_forward?: boolean };
  header?: {
    title: { tag: "plain_text" | "lark_md"; content: string };
    template?: string;
  };
  elements: CardElement[];
}

export class LarkCardBuilder {
  private card: LarkCard;

  constructor() {
    this.card = {
      config: { wide_screen_mode: true, enable_forward: true },
      elements: [],
    };
  }

  setHeader(title: string, template?: string): this {
    this.card.header = {
      title: { tag: "plain_text", content: title },
      template: template || "blue",
    };
    return this;
  }

  addMarkdown(content: string): this {
    this.card.elements.push({
      tag: "div",
      text: { tag: "lark_md", content },
    });
    return this;
  }

  addDivider(): this {
    this.card.elements.push({ tag: "hr" });
    return this;
  }

  addNote(content: string): this {
    this.card.elements.push({
      tag: "note",
      elements: [{ tag: "lark_md", content }],
    });
    return this;
  }

  addImage(imageKey: string, alt?: string): this {
    this.card.elements.push({
      tag: "img",
      img_key: imageKey,
      alt: { tag: "plain_text", content: alt || "" },
    });
    return this;
  }

  addActions(actions: CardAction[]): this {
    this.card.elements.push({
      tag: "action",
      actions: actions.map((a) => ({
        ...a,
        text: a.text || { tag: "plain_text", content: "" },
      })),
    });
    return this;
  }

  addButton(
    text: string,
    value: Record<string, unknown>,
    type: "default" | "primary" | "danger" = "default"
  ): this {
    return this.addActions([
      {
        tag: "button",
        text: { tag: "plain_text", content: text },
        value,
        type,
      },
    ]);
  }

  addColumnSet(columns: Array<{ width: string; elements: CardElement[] }>): this {
    this.card.elements.push({
      tag: "column_set",
      flex_mode: "none",
      background_style: "default",
      columns: columns.map((col) => ({
        tag: "column",
        width: col.width,
        vertical_align: "top",
        elements: col.elements,
      })),
    });
    return this;
  }

  build(): LarkCard {
    return JSON.parse(JSON.stringify(this.card));
  }

  toJSON(): string {
    return JSON.stringify(this.card, null, 2);
  }
}

export class LarkBotClient {
  private config: LarkCardConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: LarkCardConfig) {
    this.config = config;
  }

  async sendCard(chatId: string, card: LarkCard): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(
      "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: "interactive",
          content: JSON.stringify(card),
        }),
      }
    );

    return response.json();
  }

  async updateCard(messageId: string, card: LarkCard): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: JSON.stringify(card),
        }),
      }
    );

    return response.json();
  }

  async sendWebhookCard(card: LarkCard): Promise<any> {
    if (!this.config.webhookUrl) {
      throw new Error("Webhook URL is not configured");
    }

    const response = await fetch(this.config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "interactive", card }),
    });

    return response.json();
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      }
    );

    const data = await response.json();
    this.accessToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire - 300) * 1000;

    return this.accessToken!;
  }
}

/** Build an OpenClaw agent response card */
export function buildAgentResponseCard(
  taskId: string,
  modelName: string,
  response: string,
  tokenUsage: { input: number; output: number; cost: number }
): LarkCard {
  const builder = new LarkCardBuilder();

  builder
    .setHeader("OpenClaw Agent Response", "indigo")
    .addMarkdown(response)
    .addDivider()
    .addNote(
      `Model: **${modelName}** | Task: \`${taskId}\` | Tokens: ${tokenUsage.input}→${tokenUsage.output} | Cost: ${tokenUsage.cost}`
    )
    .addButton("Continue Conversation", { action: "continue", taskId }, "primary")
    .addButton("View Details", { action: "details", taskId }, "default");

  return builder.build();
}
