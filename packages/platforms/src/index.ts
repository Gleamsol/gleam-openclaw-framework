/**
 * @gleam-openclaw/platforms
 *
 * Platform integrations for OpenClaw:
 * - Android dark mode adaptation
 * - Lark (Feishu) interactive cards
 * - Telegram topic auto-naming
 * - Long conversation compression
 */

export {
  AndroidDarkMode,
  type ThemeColors,
  type AndroidThemeConfig,
  type ThemeMode,
} from "./android/dark-mode";

export {
  LarkCardBuilder,
  LarkBotClient,
  buildAgentResponseCard,
  type LarkCardConfig,
  type LarkCard,
  type CardElement,
  type CardAction,
} from "./lark/interactive-card";

export {
  TelegramTopicNamer,
  type TelegramBotConfig,
  type TopicInfo,
  type NamingStrategy,
} from "./telegram/topic-namer";

export {
  ConversationCompressor,
  type CompressorConfig,
  type CompressionStrategy,
  type CompressionResult,
  type Message,
} from "./compression/conversation-compressor";
