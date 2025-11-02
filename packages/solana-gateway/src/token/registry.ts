/**
 * @module registry
 * @description Token registry for managing accepted MEME tokens and their pricing
 */

import { TokenInfo } from "./spl-token";

export interface TokenPricing {
  mint: string;
  costPerCall: bigint;
  costPerToken: bigint;
  bulkDiscount: Map<number, number>; // threshold -> discount percentage
}

export interface TokenRegistryConfig {
  acceptedTokens: TokenInfo[];
  defaultCostPerCall: bigint;
  defaultCostPerToken: bigint;
}

export class TokenRegistry {
  private tokens: Map<string, TokenInfo> = new Map();
  private pricing: Map<string, TokenPricing> = new Map();
  private defaultCostPerCall: bigint;
  private defaultCostPerToken: bigint;

  constructor(config: TokenRegistryConfig) {
    this.defaultCostPerCall = config.defaultCostPerCall;
    this.defaultCostPerToken = config.defaultCostPerToken;

    config.acceptedTokens.forEach((token) => {
      this.tokens.set(token.mint, token);
      this.pricing.set(token.mint, {
        mint: token.mint,
        costPerCall: config.defaultCostPerCall,
        costPerToken: config.defaultCostPerToken,
        bulkDiscount: new Map([
          [100, 5],
          [500, 10],
          [1000, 15],
          [5000, 20],
        ]),
      });
    });
  }

  addToken(token: TokenInfo, pricing?: Partial<TokenPricing>): void {
    this.tokens.set(token.mint, token);
    this.pricing.set(token.mint, {
      mint: token.mint,
      costPerCall: pricing?.costPerCall || this.defaultCostPerCall,
      costPerToken: pricing?.costPerToken || this.defaultCostPerToken,
      bulkDiscount:
        pricing?.bulkDiscount ||
        new Map([
          [100, 5],
          [500, 10],
          [1000, 15],
        ]),
    });
  }

  removeToken(mint: string): void {
    this.tokens.delete(mint);
    this.pricing.delete(mint);
  }

  getToken(mint: string): TokenInfo | undefined {
    return this.tokens.get(mint);
  }

  getPricing(mint: string): TokenPricing | undefined {
    return this.pricing.get(mint);
  }

  isAccepted(mint: string): boolean {
    return this.tokens.has(mint);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  calculateCost(
    mint: string,
    callCount: number
  ): { totalCost: bigint; discount: number } {
    const pricing = this.pricing.get(mint);
    if (!pricing) {
      throw new Error(`Token ${mint} is not registered in the registry`);
    }

    let discount = 0;
    const discountEntries = Array.from(pricing.bulkDiscount.entries()).sort(
      (a, b) => b[0] - a[0]
    );

    for (const [threshold, disc] of discountEntries) {
      if (callCount >= threshold) {
        discount = disc;
        break;
      }
    }

    const baseCost = pricing.costPerCall * BigInt(callCount);
    const discountAmount = (baseCost * BigInt(discount)) / BigInt(100);
    const totalCost = baseCost - discountAmount;

    return { totalCost, discount };
  }

  updatePricing(mint: string, pricing: Partial<TokenPricing>): void {
    const existing = this.pricing.get(mint);
    if (!existing) {
      throw new Error(`Token ${mint} is not registered`);
    }
    this.pricing.set(mint, { ...existing, ...pricing });
  }

  toJSON(): Record<string, unknown>[] {
    return this.getAllTokens().map((token) => ({
      ...token,
      pricing: {
        costPerCall: this.pricing.get(token.mint)?.costPerCall.toString(),
        costPerToken: this.pricing.get(token.mint)?.costPerToken.toString(),
      },
    }));
  }
}
