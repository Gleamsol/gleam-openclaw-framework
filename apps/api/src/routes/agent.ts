/**
 * @module agent-routes
 * @description REST API routes for OpenClaw Agent task execution
 */

import { Router, Request, Response } from "express";
import { z } from "zod";

export const agentRoutes = Router();

const ExecuteTaskSchema = z.object({
  agentName: z.string().optional().default("default"),
  modelId: z.string().optional().default("gpt-5.4"),
  input: z.string().min(1),
  skills: z.array(z.string()).optional().default([]),
  maxSteps: z.number().optional().default(50),
  timeout: z.number().optional().default(172800000),
  checkpointEnabled: z.boolean().optional().default(true),
  credential: z.string().optional(),
  paymentId: z.string().optional(),
  stream: z.boolean().optional().default(false),
});

// POST /api/agent/execute — Execute an agent task
agentRoutes.post("/execute", async (req: Request, res: Response) => {
  try {
    const body = ExecuteTaskSchema.parse(req.body);

    // In production, this would use the AgentEngine instance
    // For now, return a structured response showing the API contract
    res.json({
      success: true,
      data: {
        taskId: `task_${Date.now().toString(36)}`,
        agentName: body.agentName,
        modelId: body.modelId,
        status: "queued",
        input: body.input,
        skills: body.skills,
        maxSteps: body.maxSteps,
        timeout: body.timeout,
        checkpointEnabled: body.checkpointEnabled,
        createdAt: new Date().toISOString(),
        message: "Task queued for execution",
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/agent/task/:taskId — Get task status
agentRoutes.get("/task/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  res.json({
    success: true,
    data: {
      taskId,
      status: "running",
      steps: [],
      tokenUsage: { totalInput: 0, totalOutput: 0, totalCost: 0 },
    },
  });
});

// POST /api/agent/task/:taskId/pause — Pause a running task
agentRoutes.post("/task/:taskId/pause", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  res.json({ success: true, data: { taskId, status: "paused" } });
});

// POST /api/agent/task/:taskId/resume — Resume from checkpoint
agentRoutes.post("/task/:taskId/resume", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  res.json({ success: true, data: { taskId, status: "running", resumedFrom: "checkpoint" } });
});

// GET /api/agent/skills — List available skills
agentRoutes.get("/skills", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      skills: [
        { name: "tavily_search", category: "search", description: "AI-native web search" },
        { name: "agent_browser", category: "browser", description: "Browser automation for agents" },
        { name: "rhclaw_multimodal", category: "multimodal", description: "Multi-modal content creation" },
        { name: "code_executor", category: "code", description: "Execute code in sandboxed environment" },
        { name: "skill_vetter", category: "custom", description: "Validate and vet agent skills" },
      ],
    },
  });
});
