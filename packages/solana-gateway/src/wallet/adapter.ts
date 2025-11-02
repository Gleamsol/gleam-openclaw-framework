/**
 * @module adapter
 * @description Multi-wallet adapter supporting OKX, Phantom, Solflare, Bitget and more
 */

import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import EventEmitter from "eventemitter3";

export type WalletProvider =
  | "okx"
  | "phantom"
  | "solflare"
  | "bitget"
  | "backpack"
  | "coinbase";

export interface WalletInfo {
  provider: WalletProvider;
  publicKey: PublicKey | null;
  connected: boolean;
  label: string;
  icon: string;
}

export interface WalletEvents {
  connect: (publicKey: PublicKey) => void;
  disconnect: () => void;
  error: (error: Error) => void;
  accountChange: (publicKey: PublicKey) => void;
}

export interface WalletAdapterInterface {
  connect(): Promise<PublicKey>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): PublicKey | null;
  isConnected(): boolean;
}

export class MultiWalletAdapter extends EventEmitter<WalletEvents> {
  private currentWallet: WalletAdapterInterface | null = null;
  private currentProvider: WalletProvider | null = null;
  private walletInfo: WalletInfo | null = null;

  private readonly walletConfigs: Record<
    WalletProvider,
    { label: string; icon: string; detectKey: string }
  > = {
    okx: {
      label: "OKX Wallet",
      icon: "https://static.okx.com/cdn/assets/imgs/226/icon.png",
      detectKey: "okxwallet.solana",
    },
    phantom: {
      label: "Phantom",
      icon: "https://phantom.app/img/logo.png",
      detectKey: "phantom.solana",
    },
    solflare: {
      label: "Solflare",
      icon: "https://solflare.com/favicon.ico",
      detectKey: "solflare",
    },
    bitget: {
      label: "Bitget Wallet",
      icon: "https://web3.bitget.com/favicon.ico",
      detectKey: "bitkeep.solana",
    },
    backpack: {
      label: "Backpack",
      icon: "https://backpack.app/favicon.ico",
      detectKey: "backpack",
    },
    coinbase: {
      label: "Coinbase Wallet",
      icon: "https://www.coinbase.com/favicon.ico",
      detectKey: "coinbaseSolana",
    },
  };

  getAvailableWallets(): WalletProvider[] {
    if (typeof window === "undefined") return [];

    const available: WalletProvider[] = [];
    const win = window as Record<string, any>;

    for (const [provider, config] of Object.entries(this.walletConfigs)) {
      const keys = config.detectKey.split(".");
      let obj = win;
      let found = true;

      for (const key of keys) {
        if (obj && obj[key]) {
          obj = obj[key];
        } else {
          found = false;
          break;
        }
      }

      if (found) {
        available.push(provider as WalletProvider);
      }
    }

    return available;
  }

  async connect(provider: WalletProvider): Promise<PublicKey> {
    const win = typeof window !== "undefined" ? (window as any) : null;
    if (!win) throw new Error("Wallet connection requires a browser environment");

    let walletInstance: any;

    switch (provider) {
      case "okx":
        walletInstance = win.okxwallet?.solana;
        break;
      case "phantom":
        walletInstance = win.phantom?.solana;
        break;
      case "solflare":
        walletInstance = win.solflare;
        break;
      case "bitget":
        walletInstance = win.bitkeep?.solana;
        break;
      case "backpack":
        walletInstance = win.backpack;
        break;
      case "coinbase":
        walletInstance = win.coinbaseSolana;
        break;
      default:
        throw new Error(`Unsupported wallet provider: ${provider}`);
    }

    if (!walletInstance) {
      throw new Error(
        `${this.walletConfigs[provider].label} is not installed. Please install it first.`
      );
    }

    try {
      const response = await walletInstance.connect();
      const publicKey = new PublicKey(
        response.publicKey?.toString() || response.toString()
      );

      this.currentWallet = this.createAdapterFromInstance(
        walletInstance,
        publicKey
      );
      this.currentProvider = provider;
      this.walletInfo = {
        provider,
        publicKey,
        connected: true,
        label: this.walletConfigs[provider].label,
        icon: this.walletConfigs[provider].icon,
      };

      this.emit("connect", publicKey);
      return publicKey;
    } catch (error: any) {
      const err = new Error(
        `Failed to connect ${this.walletConfigs[provider].label}: ${error.message}`
      );
      this.emit("error", err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentWallet) {
      await this.currentWallet.disconnect();
      this.currentWallet = null;
      this.currentProvider = null;
      this.walletInfo = null;
      this.emit("disconnect");
    }
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    if (!this.currentWallet) throw new Error("No wallet connected");
    return this.currentWallet.signTransaction(transaction);
  }

  async signAllTransactions(
    transactions: Transaction[]
  ): Promise<Transaction[]> {
    if (!this.currentWallet) throw new Error("No wallet connected");
    return this.currentWallet.signAllTransactions(transactions);
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.currentWallet) throw new Error("No wallet connected");
    return this.currentWallet.signMessage(message);
  }

  getPublicKey(): PublicKey | null {
    return this.currentWallet?.getPublicKey() || null;
  }

  isConnected(): boolean {
    return this.currentWallet?.isConnected() || false;
  }

  getWalletInfo(): WalletInfo | null {
    return this.walletInfo;
  }

  getCurrentProvider(): WalletProvider | null {
    return this.currentProvider;
  }

  private createAdapterFromInstance(
    instance: any,
    publicKey: PublicKey
  ): WalletAdapterInterface {
    return {
      connect: async () => publicKey,
      disconnect: async () => {
        if (instance.disconnect) await instance.disconnect();
      },
      signTransaction: async (tx: Transaction) => instance.signTransaction(tx),
      signAllTransactions: async (txs: Transaction[]) =>
        instance.signAllTransactions(txs),
      signMessage: async (msg: Uint8Array) => {
        const result = await instance.signMessage(msg, "utf8");
        return result.signature || result;
      },
      getPublicKey: () => publicKey,
      isConnected: () => true,
    };
  }
}
