/**
 * @module token-gate
 * @description Token-gated access control — verifies Solana MEME token holdings for API access
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { TokenTier, DEFAULT_TOKEN_TIERS } from "../types/agent";

export interface TokenGateResult {
  authorized: boolean;
  tier: TokenTier | null;
  balance: bigint;
  walletAddress: string;
  message: string;
}

export interface CredentialPayload {
  walletAddress: string;
  balance: string;
  tier: string;
  allowedModels: string[];
  allowedSkills: string[];
  maxCallsPerDay: number;
  issuedAt: number;
  expiresAt: number;
}

export class TokenGateGuard {
  private connection: Connection;
  private tokenMint: PublicKey;
  private tiers: TokenTier[];
  private credentialSecret: string;

  constructor(
    connection: Connection,
    tokenMint: string,
    tiers?: TokenTier[],
    credentialSecret?: string
  ) {
    this.connection = connection;
    this.tokenMint = new PublicKey(tokenMint);
    this.tiers = tiers || DEFAULT_TOKEN_TIERS;
    this.credentialSecret = credentialSecret || process.env.JWT_SECRET || "openclaw-secret";
  }

  async verifyAccess(walletAddress: string): Promise<TokenGateResult> {
    try {
      const wallet = new PublicKey(walletAddress);

      // Get all token accounts for this wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        wallet,
        { mint: this.tokenMint }
      );

      let totalBalance = BigInt(0);
      for (const account of tokenAccounts.value) {
        const amount = account.account.data.parsed?.info?.tokenAmount?.amount;
        if (amount) {
          totalBalance += BigInt(amount);
        }
      }

      // Determine tier
      const tier = this.determineTier(totalBalance);

      if (!tier) {
        return {
          authorized: false,
          tier: null,
          balance: totalBalance,
          walletAddress,
          message: `Insufficient token balance. Minimum required: ${this.tiers[0]?.minTokens.toString() || "1000"} tokens`,
        };
      }

      return {
        authorized: true,
        tier,
        balance: totalBalance,
        walletAddress,
        message: `Access granted. Tier: ${tier.name}`,
      };
    } catch (error: any) {
      return {
        authorized: false,
        tier: null,
        balance: BigInt(0),
        walletAddress,
        message: `Verification failed: ${error.message}`,
      };
    }
  }

  generateCredential(result: TokenGateResult): string {
    if (!result.authorized || !result.tier) {
      throw new Error("Cannot generate credential for unauthorized access");
    }

    const payload: CredentialPayload = {
      walletAddress: result.walletAddress,
      balance: result.balance.toString(),
      tier: result.tier.name,
      allowedModels: result.tier.allowedModels,
      allowedSkills: result.tier.allowedSkills,
      maxCallsPerDay: result.tier.maxCallsPerDay,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Simple HMAC-based credential (production should use JWT)
    const payloadStr = JSON.stringify(payload);
    const encoded = Buffer.from(payloadStr).toString("base64url");
    const signature = this.sign(encoded);

    return `${encoded}.${signature}`;
  }

  verifyCredential(credential: string): CredentialPayload | null {
    try {
      const [encoded, signature] = credential.split(".");
      if (!encoded || !signature) return null;

      const expectedSignature = this.sign(encoded);
      if (signature !== expectedSignature) return null;

      const payloadStr = Buffer.from(encoded, "base64url").toString("utf-8");
      const payload: CredentialPayload = JSON.parse(payloadStr);

      if (payload.expiresAt < Date.now()) return null;

      return payload;
    } catch {
      return null;
    }
  }

  isModelAllowed(credential: CredentialPayload, modelId: string): boolean {
    return credential.allowedModels.includes(modelId);
  }

  isSkillAllowed(credential: CredentialPayload, skillName: string): boolean {
    return credential.allowedSkills.includes(skillName);
  }

  private determineTier(balance: bigint): TokenTier | null {
    const sortedTiers = [...this.tiers].sort(
      (a, b) => Number(b.minTokens - a.minTokens)
    );

    for (const tier of sortedTiers) {
      if (balance >= tier.minTokens) {
        return tier;
      }
    }

    return null;
  }

  private sign(data: string): string {
    // Simple hash-based signature (production should use crypto.createHmac)
    let hash = 0;
    const combined = data + this.credentialSecret;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
