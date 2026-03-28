/**
 * @module payment-routes
 * @description REST API routes for Solana MEME token payment processing
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Connection } from "@solana/web3.js";
import { TokenRegistry, PaymentGateway } from "@gleam-openclaw/solana-gateway";

export const paymentRoutes = Router();

// ---- Service Singletons ----
let tokenRegistry: TokenRegistry | null = null;
let paymentGateway: PaymentGateway | null = null;

function getTokenRegistry(): TokenRegistry {
  if (!tokenRegistry) {
    tokenRegistry = new TokenRegistry();

    // Register accepted tokens from environment
    const mints = (process.env.ACCEPTED_TOKEN_MINTS || "").split(",").filter(Boolean);
    mints.forEach((mint) => {
      tokenRegistry!.addToken({
        mint: mint.trim(),
        symbol: "MEME",
        name: "MEME Token",
        decimals: 9,
        logoUri: "",
      });
    });
  }
  return tokenRegistry;
}

function getPaymentGateway(): PaymentGateway {
  if (!paymentGateway) {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const treasury = process.env.TREASURY_WALLET_ADDRESS || "";

    paymentGateway = new PaymentGateway({
      connection,
      treasuryWallet: treasury || "11111111111111111111111111111111",
      tokenRegistry: getTokenRegistry(),
    });
  }
  return paymentGateway;
}

// ---- Schemas ----
const EstimateCostSchema = z.object({
  tokenMint: z.string(),
  callCount: z.number().int().positive(),
  modelId: z.string().optional(),
});

const VerifyPaymentSchema = z.object({
  paymentId: z.string(),
});

const CheckBalanceSchema = z.object({
  walletAddress: z.string(),
  tokenMint: z.string().optional(),
});

// POST /api/payment/estimate — Estimate cost for API calls
paymentRoutes.post("/estimate", async (req: Request, res: Response) => {
  try {
    const body = EstimateCostSchema.parse(req.body);
    const registry = getTokenRegistry();
    const { totalCost, discount } = await registry.calculateCost(
      body.tokenMint,
      body.callCount
    );

    res.json({
      success: true,
      data: {
        tokenMint: body.tokenMint,
        callCount: body.callCount,
        costPerCall: registry.getPricing(body.tokenMint)?.costPerCall?.toString() || "1000000",
        totalCost: totalCost.toString(),
        discount,
        currency: registry.getToken(body.tokenMint)?.symbol || "MEME Token",
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/payment/verify — Verify a payment by ID
paymentRoutes.post("/verify", async (req: Request, res: Response) => {
  try {
    const body = VerifyPaymentSchema.parse(req.body);
    const gateway = getPaymentGateway();
    const verified = await gateway.verifyPayment(body.paymentId);

    const record = gateway.getPayment(body.paymentId);

    res.json({
      success: true,
      data: {
        paymentId: body.paymentId,
        verified,
        status: record?.status || "not_found",
        signature: record?.signature || null,
        confirmedAt: record?.confirmedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/payment/balance — Check token balance
paymentRoutes.post("/balance", async (req: Request, res: Response) => {
  try {
    const body = CheckBalanceSchema.parse(req.body);
    const registry = getTokenRegistry();
    const gateway = getPaymentGateway();

    if (body.tokenMint) {
      // Check specific token balance
      const balance = await gateway.checkBalance(body.walletAddress, body.tokenMint);
      res.json({
        success: true,
        data: {
          walletAddress: body.walletAddress,
          balances: [
            {
              mint: body.tokenMint,
              symbol: registry.getToken(body.tokenMint)?.symbol || "Unknown",
              amount: balance.amount.toString(),
              uiAmount: balance.uiAmount,
            },
          ],
        },
      });
    } else {
      // Check all accepted token balances
      const tokens = registry.getAllTokens();
      const balances = await Promise.all(
        tokens.map(async (token) => {
          try {
            const balance = await gateway.checkBalance(body.walletAddress, token.mint);
            return {
              mint: token.mint,
              symbol: token.symbol,
              amount: balance.amount.toString(),
              uiAmount: balance.uiAmount,
            };
          } catch {
            return {
              mint: token.mint,
              symbol: token.symbol,
              amount: "0",
              uiAmount: 0,
            };
          }
        })
      );

      res.json({
        success: true,
        data: { walletAddress: body.walletAddress, balances },
      });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/payment/tokens — List accepted tokens
paymentRoutes.get("/tokens", async (_req: Request, res: Response) => {
  const registry = getTokenRegistry();
  const tokens = registry.getAllTokens();

  res.json({
    success: true,
    data: {
      tokens: tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoUri: t.logoUri,
        pricing: registry.getPricing(t.mint),
      })),
      count: tokens.length,
    },
  });
});

// GET /api/payment/:paymentId — Get payment status
paymentRoutes.get("/:paymentId", async (req: Request, res: Response) => {
  const gateway = getPaymentGateway();
  const record = gateway.getPayment(req.params.paymentId);

  if (record) {
    res.json({
      success: true,
      data: {
        paymentId: record.id,
        status: record.status,
        walletAddress: record.walletAddress,
        tokenMint: record.tokenMint,
        amount: record.amount.toString(),
        modelId: record.modelId,
        signature: record.signature,
        createdAt: record.createdAt.toISOString(),
        confirmedAt: record.confirmedAt?.toISOString() || null,
      },
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Payment ${req.params.paymentId} not found`,
    });
  }
});
