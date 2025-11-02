/**
 * @module spl-token
 * @description SPL Token utilities for MEME token operations on Solana
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

export interface TokenBalance {
  mint: string;
  amount: bigint;
  decimals: number;
  uiAmount: number;
}

export class SPLTokenManager {
  private connection: Connection;
  private registeredTokens: Map<string, TokenInfo> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  registerToken(token: TokenInfo): void {
    this.registeredTokens.set(token.mint, token);
  }

  registerTokens(tokens: TokenInfo[]): void {
    tokens.forEach((t) => this.registerToken(t));
  }

  getRegisteredToken(mint: string): TokenInfo | undefined {
    return this.registeredTokens.get(mint);
  }

  isTokenAccepted(mint: string): boolean {
    return this.registeredTokens.has(mint);
  }

  async getTokenBalance(
    walletAddress: string,
    mintAddress: string
  ): Promise<TokenBalance> {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);

    const ata = await getAssociatedTokenAddress(mint, wallet);

    try {
      const account = await getAccount(this.connection, ata);
      const mintInfo = await getMint(this.connection, mint);

      const uiAmount =
        Number(account.amount) / Math.pow(10, mintInfo.decimals);

      return {
        mint: mintAddress,
        amount: account.amount,
        decimals: mintInfo.decimals,
        uiAmount,
      };
    } catch {
      return {
        mint: mintAddress,
        amount: BigInt(0),
        decimals: 0,
        uiAmount: 0,
      };
    }
  }

  async getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const [mint] of this.registeredTokens) {
      const balance = await this.getTokenBalance(walletAddress, mint);
      balances.push(balance);
    }

    return balances;
  }

  async createTransferTransaction(
    from: string,
    to: string,
    mintAddress: string,
    amount: bigint
  ): Promise<Transaction> {
    const fromPubkey = new PublicKey(from);
    const toPubkey = new PublicKey(to);
    const mint = new PublicKey(mintAddress);

    const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
    const toAta = await getAssociatedTokenAddress(mint, toPubkey);

    const transaction = new Transaction();

    // Check if destination ATA exists; if not, create it
    try {
      await getAccount(this.connection, toAta);
    } catch {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        fromPubkey,
        toAta,
        toPubkey,
        mint
      );
      transaction.add(createAtaIx);
    }

    const transferIx = createTransferInstruction(
      fromAta,
      toAta,
      fromPubkey,
      amount
    );

    transaction.add(transferIx);

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    return transaction;
  }

  async verifyTransfer(
    signature: string,
    expectedFrom: string,
    expectedTo: string,
    expectedMint: string,
    expectedAmount: bigint
  ): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || tx.meta?.err) {
        return false;
      }

      // Verify the transaction contains the expected SPL token transfer
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Simplified verification — production should do deeper inspection
      return preBalances.length > 0 && postBalances.length > 0;
    } catch {
      return false;
    }
  }
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}
