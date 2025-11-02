/**
 * @gleam-openclaw/solana-gateway
 *
 * Solana wallet integration and MEME token payment gateway for OpenClaw.
 * Supports OKX, Phantom, Solflare, Bitget wallets and any SPL token as payment.
 */

export {
  SolanaConnectionManager,
  createConnection,
  type SolanaConnectionConfig,
} from "./utils/connection";

export {
  SPLTokenManager,
  type TokenInfo,
  type TokenBalance,
} from "./token/spl-token";

export {
  TokenRegistry,
  type TokenPricing,
  type TokenRegistryConfig,
} from "./token/registry";

export {
  MultiWalletAdapter,
  type WalletProvider,
  type WalletInfo,
  type WalletEvents,
  type WalletAdapterInterface,
} from "./wallet/adapter";

export {
  PaymentGateway,
  type PaymentRecord,
  type PaymentStatus,
  type PaymentGatewayConfig,
  type PaymentGatewayEvents,
} from "./payment/gateway";
