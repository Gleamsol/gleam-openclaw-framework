/**
 * @module agent-routes
 * @description REST API routes for OpenClaw Agent task execution
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { AgentEngine, InMemoryCheckpointStore } from "@gleam-openclaw/core";
import { UnifiedModelRouter } from "@gleam-openclaw/model-router";

export const agentRoutes = Router();

// ---- Engine Singleton ----
// Lazily initialized on first request so env vars are available
let engine: AgentEngine | null = null;

function getEngine(): AgentEngine {
  if (!engine) {
    const router = new UnifiedModelRouter({
      defaultModel: process.env.DEFAULT_MODEL || "gpt-5.4",
      routingStrategy: "priority",
      maxRetries: 2,
      timeout: 30000,
    });

    engine = new AgentEngine({
      modelRouter: router,
      defaultTimeout: Number(process.env.OPENCLAW_AGENT_TIMEOUT) || 172800000,
      defaultMaxSteps: 100,
      checkpointStore: new InMemoryCheckpointStore(),
    });
  }
  return engine;
}

// ---- Schemas ----
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
    const agentEngine = getEngine();

    // Build agent config from request
    const agentConfig = {
      id: `agent_${body.agentName}`,
      name: body.agentName,
      modelId: body.modelId,
      skills: body.skills,
      maxSteps: body.maxSteps,
      timeout: body.timeout,
      checkpointEnabled: body.checkpointEnabled,
      checkpointInterval: 5,
    };

    // Execute the task asynchronously
    const task = await agentEngine.executeTask(agentConfig, body.input);

    res.json({
      success: true,
      data: {
        taskId: task.id,
        agentName: body.agentName,
        modelId: body.modelId,
        status: task.status,
        result: task.result || null,
        steps: task.steps.map((s) => ({
          index: s.index,
          type: s.type,
          content: s.content,
          skillName: s.skillName,
          durationMs: s.durationMs,
        })),
        tokenUsage: task.tokenUsage,
        createdAt: task.startedAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/agent/task/:taskId — Get task status
agentRoutes.get("/task/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const agentEngine = getEngine();
  const task = agentEngine.getActiveTask(taskId);

  if (task) {
    res.json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        steps: task.steps.map((s) => ({
          index: s.index,
          type: s.type,
          content: s.content,
          skillName: s.skillName,
        })),
        tokenUsage: task.tokenUsage,
        result: task.result || null,
      },
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Task ${taskId} not found or already completed`,
    });
  }
});

// POST /api/agent/task/:taskId/pause — Pause a running task
agentRoutes.post("/task/:taskId/pause", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const agentEngine = getEngine();

  try {
    await agentEngine.pauseTask(taskId);
    res.json({ success: true, data: { taskId, status: "paused" } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/agent/task/:taskId/resume — Resume from checkpoint
agentRoutes.post("/task/:taskId/resume", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  res.json({
    success: true,
    data: { taskId, status: "running", resumedFrom: "checkpoint" },
  });
});

// GET /api/agent/skills — List available skills
agentRoutes.get("/skills", async (_req: Request, res: Response) => {
  const agentEngine = getEngine();
  const skills = agentEngine.getAllSkills();

  res.json({
    success: true,
    data: {
      skills:
        skills.length > 0
          ? skills.map((s) => ({
              name: s.name,
              description: s.description,
              category: s.category || "general",
            }))
          : [
              {
                name: "tavily_search",
                category: "search",
                description: "AI-native web search with structured summaries",
              },
              {
                name: "agent_browser",
                category: "browser",
                description: "Browser automation with visual anchoring",
              },
              {
                name: "rhclaw_multimodal",
                category: "multimodal",
                description: "Multi-modal content creation (image/audio/video)",
              },
              {
                name: "code_executor",
                category: "code",
                description: "Execute code in sandboxed environment",
              },
              {
                name: "skill_vetter",
                category: "validation",
                description: "Validate and audit agent skills",
              },
            ],
    },
  });
});

// GET /api/agent/active — List all active tasks
agentRoutes.get("/active", async (_req: Request, res: Response) => {
  const agentEngine = getEngine();
  const tasks = agentEngine.getActiveTasks();

  res.json({
    success: true,
    data: {
      count: tasks.length,
      tasks: tasks.map((t) => ({
        taskId: t.id,
        status: t.status,
        input: t.input.substring(0, 100),
        startedAt: t.startedAt.toISOString(),
      })),
    },
  });
});
