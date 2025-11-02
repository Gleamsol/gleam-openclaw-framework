/**
 * @module connection
 * @description Solana RPC connection manager with failover and Helius integration
 */

import { Connection, Commitment, ConnectionConfig } from "@solana/web3.js";

export interface SolanaConnectionConfig {
  rpcUrl: string;
  wsUrl?: string;
  commitment?: Commitment;
  heliusApiKey?: string;
  fallbackRpcUrls?: string[];
}

const DEFAULT_CONFIG: SolanaConnectionConfig = {
  rpcUrl: "https://api.mainnet-beta.solana.com",
  commitment: "confirmed",
};

export class SolanaConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private primaryUrl: string;
  private fallbackUrls: string[];
  private commitment: Commitment;

  constructor(config: Partial<SolanaConnectionConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };

    if (merged.heliusApiKey) {
      this.primaryUrl = `https://mainnet.helius-rpc.com/?api-key=${merged.heliusApiKey}`;
    } else {
      this.primaryUrl = merged.rpcUrl;
    }

    this.fallbackUrls = merged.fallbackRpcUrls || [
      "https://api.mainnet-beta.solana.com",
      "https://solana-api.projectserum.com",
    ];
    this.commitment = merged.commitment || "confirmed";
  }

  getConnection(): Connection {
    if (this.connections.has(this.primaryUrl)) {
      return this.connections.get(this.primaryUrl)!;
    }

    const connConfig: ConnectionConfig = {
      commitment: this.commitment,
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
    };

    const connection = new Connection(this.primaryUrl, connConfig);
    this.connections.set(this.primaryUrl, connection);
    return connection;
  }

  async getHealthyConnection(): Promise<Connection> {
    const allUrls = [this.primaryUrl, ...this.fallbackUrls];

    for (const url of allUrls) {
      try {
        const conn = new Connection(url, { commitment: this.commitment });
        const blockHeight = await conn.getBlockHeight();
        if (blockHeight > 0) {
          this.connections.set(url, conn);
          return conn;
        }
      } catch {
        continue;
      }
    }

    throw new Error(
      "All Solana RPC endpoints are unreachable. Please check your network configuration."
    );
  }

  async getLatency(url?: string): Promise<number> {
    const conn = url
      ? new Connection(url, { commitment: this.commitment })
      : this.getConnection();
    const start = Date.now();
    await conn.getBlockHeight();
    return Date.now() - start;
  }

  disconnect(): void {
    this.connections.clear();
  }
}

export const createConnection = (
  config?: Partial<SolanaConnectionConfig>
): SolanaConnectionManager => {
  return new SolanaConnectionManager(config);
};
