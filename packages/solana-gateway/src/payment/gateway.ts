/**
 * @module gateway
 * @description Payment gateway for processing MEME token payments for OpenClaw API calls
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import EventEmitter from "eventemitter3";
import { SPLTokenManager, TokenBalance } from "../token/spl-token";
import { TokenRegistry } from "../token/registry";
import { MultiWalletAdapter } from "../wallet/adapter";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "failed"
  | "refunded";

export interface PaymentRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: bigint;
  modelId: string;
  callType: string;
  signature: string;
  status: PaymentStatus;
  createdAt: Date;
  confirmedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PaymentGatewayConfig {
  connection: Connection;
  treasuryWallet: string;
  tokenRegistry: TokenRegistry;
  confirmationTimeout?: number;
  maxRetries?: number;
}

export interface PaymentGatewayEvents {
  paymentCreated: (record: PaymentRecord) => void;
  paymentConfirmed: (record: PaymentRecord) => void;
  paymentFailed: (record: PaymentRecord, error: Error) => void;
  balanceInsufficient: (wallet: string, required: bigint, available: bigint) => void;
}

export class PaymentGateway extends EventEmitter<PaymentGatewayEvents> {
  private connection: Connection;
  private treasuryWallet: PublicKey;
  private tokenManager: SPLTokenManager;
  private tokenRegistry: TokenRegistry;
  private payments: Map<string, PaymentRecord> = new Map();
  private confirmationTimeout: number;
  private maxRetries: number;

  constructor(config: PaymentGatewayConfig) {
    super();
    this.connection = config.connection;
    this.treasuryWallet = new PublicKey(config.treasuryWallet);
    this.tokenManager = new SPLTokenManager(config.connection);
    this.tokenRegistry = config.tokenRegistry;
    this.confirmationTimeout = config.confirmationTimeout || 60000;
    this.maxRetries = config.maxRetries || 3;

    // Register all accepted tokens
    const tokens = this.tokenRegistry.getAllTokens();
    this.tokenManager.registerTokens(tokens);
  }

  async checkBalance(
    walletAddress: string,
    tokenMint: string
  ): Promise<TokenBalance> {
    return this.tokenManager.getTokenBalance(walletAddress, tokenMint);
  }

  async estimateCost(
    tokenMint: string,
    callCount: number
  ): Promise<{ totalCost: bigint; discount: number }> {
    return this.tokenRegistry.calculateCost(tokenMint, callCount);
  }

  async createPayment(
    walletAdapter: MultiWalletAdapter,
    tokenMint: string,
    amount: bigint,
    modelId: string,
    callType: string = "agent-call"
  ): Promise<PaymentRecord> {
    const publicKey = walletAdapter.getPublicKey();
    if (!publicKey) throw new Error("Wallet not connected");

    if (!this.tokenRegistry.isAccepted(tokenMint)) {
      throw new Error(`Token ${tokenMint} is not accepted for payment`);
    }

    // Check balance
    const balance = await this.checkBalance(publicKey.toString(), tokenMint);
    if (balance.amount < amount) {
      this.emit(
        "balanceInsufficient",
        publicKey.toString(),
        amount,
        balance.amount
      );
      throw new Error(
        `Insufficient balance. Required: ${amount}, Available: ${balance.amount}`
      );
    }

    // Create transfer transaction
    const transaction = await this.tokenManager.createTransferTransaction(
      publicKey.toString(),
      this.treasuryWallet.toString(),
      tokenMint,
      amount
    );

    const paymentId = this.generatePaymentId();
    const record: PaymentRecord = {
      id: paymentId,
      walletAddress: publicKey.toString(),
      tokenMint,
      amount,
      modelId,
      callType,
      signature: "",
      status: "pending",
      createdAt: new Date(),
    };

    this.payments.set(paymentId, record);
    this.emit("paymentCreated", record);

    try {
      // Sign the transaction
      const signedTx = await walletAdapter.signTransaction(transaction);

      // Send and confirm
      const signature = await this.connection.sendRawTransaction(
        signedTx.serialize()
      );

      record.signature = signature;
      record.status = "processing";

      // Wait for confirmation
      await this.waitForConfirmation(signature);

      record.status = "confirmed";
      record.confirmedAt = new Date();
      this.emit("paymentConfirmed", record);

      return record;
    } catch (error: any) {
      record.status = "failed";
      this.emit("paymentFailed", record, error);
      throw error;
    }
  }

  async verifyPayment(paymentId: string): Promise<boolean> {
    const record = this.payments.get(paymentId);
    if (!record) return false;

    if (record.status === "confirmed") return true;

    if (record.signature) {
      const verified = await this.tokenManager.verifyTransfer(
        record.signature,
        record.walletAddress,
        this.treasuryWallet.toString(),
        record.tokenMint,
        record.amount
      );

      if (verified) {
        record.status = "confirmed";
        record.confirmedAt = new Date();
      }

      return verified;
    }

    return false;
  }

  getPayment(paymentId: string): PaymentRecord | undefined {
    return this.payments.get(paymentId);
  }

  getPaymentsByWallet(walletAddress: string): PaymentRecord[] {
    return Array.from(this.payments.values()).filter(
      (p) => p.walletAddress === walletAddress
    );
  }

  private async waitForConfirmation(signature: string): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < this.confirmationTimeout) {
      const status = await this.connection.getSignatureStatus(signature);

      if (status.value?.confirmationStatus === "confirmed" || 
          status.value?.confirmationStatus === "finalized") {
        if (!status.value.err) return;
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Transaction confirmation timeout after ${this.confirmationTimeout}ms`);
  }

  private generatePaymentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `pay_${timestamp}_${random}`;
  }
}
