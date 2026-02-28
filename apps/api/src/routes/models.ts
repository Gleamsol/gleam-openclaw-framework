/**
 * @module model-routes
 * @description REST API routes for AI model management and information
 */

import { Router, Request, Response } from "express";
import { DEFAULT_MODELS } from "@gleam-openclaw/model-router";

export const modelRoutes = Router();

// GET /api/models — List all available models
modelRoutes.get("/", async (_req: Request, res: Response) => {
  const models = DEFAULT_MODELS.map((m) => ({
    id: m.id,
    provider: m.provider,
    displayName: m.displayName,
    tier: m.tier,
    maxTokens: m.maxTokens,
    contextWindow: m.contextWindow,
    supportsVision: m.supportsVision,
    supportsTools: m.supportsTools,
    supportsStreaming: m.supportsStreaming,
    enabled: m.enabled,
    priority: m.priority,
  }));

  res.json({
    success: true,
    data: {
      models,
      defaultModel: "gpt-5.4",
      notes: {
        "minimax-m2.1":
          "Outperforms M2.5 in reasoning and instruction following — recommended over M2.5",
        "gpt-5.4": "Default flagship model with top-tier performance",
        "gemini-3-flash": "Best cost-performance ratio with 1M context window",
      },
    },
  });
});

// GET /api/models/:modelId — Get specific model info
modelRoutes.get("/:modelId", async (req: Request, res: Response) => {
  const model = DEFAULT_MODELS.find((m) => m.id === req.params.modelId);
  if (!model) {
    return res.status(404).json({ success: false, error: "Model not found" });
  }
  res.json({ success: true, data: model });
});

// GET /api/models/benchmark — Model performance comparison
modelRoutes.get("/meta/benchmark", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      benchmarks: [
        { model: "gpt-5.4", reasoning: 95, coding: 94, instruction: 96, multimodal: 93 },
        { model: "minimax-m2.7", reasoning: 91, coding: 89, instruction: 92, multimodal: 90 },
        { model: "claude-vertex", reasoning: 93, coding: 92, instruction: 94, multimodal: 91 },
        { model: "minimax-m2.1", reasoning: 87, coding: 85, instruction: 89, multimodal: 0 },
        { model: "minimax-m2.5", reasoning: 84, coding: 83, instruction: 85, multimodal: 82 },
        { model: "gemini-3-flash", reasoning: 86, coding: 84, instruction: 87, multimodal: 88 },
        { model: "kimi-k2.5", reasoning: 85, coding: 82, instruction: 86, multimodal: 84 },
      ],
      note: "M2.1 outperforms M2.5 in reasoning and instruction following",
    },
  });
});
