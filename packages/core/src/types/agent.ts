/**
 * @module agent-types
 * @description Core type definitions for OpenClaw Agent system
 */

import { z } from "zod";

export type AgentStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "checkpoint";

export type SkillCategory =
  | "search"
  | "browser"
  | "code"
  | "multimodal"
  | "communication"
  | "data"
  | "custom";

export interface AgentConfig {
  id?: string;
  name: string;
  description?: string;
  modelId: string;
  systemPrompt?: string;
  skills: string[];
  maxSteps: number;
  timeout: number; // Default: 172800000 (48 hours)
  checkpointEnabled: boolean;
  checkpointInterval: number;
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  agentId: string;
  input: string;
  status: AgentStatus;
  steps: AgentStep[];
  result?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  checkpoints: Checkpoint[];
  tokenUsage: {
    totalInput: number;
    totalOutput: number;
    totalCost: number;
  };
  paymentId?: string;
}

export interface AgentStep {
  id: string;
  index: number;
  type: "thinking" | "skill_call" | "observation" | "response";
  content: string;
  skillName?: string;
  skillInput?: Record<string, unknown>;
  skillOutput?: Record<string, unknown>;
  timestamp: Date;
  durationMs: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface Checkpoint {
  id: string;
  taskId: string;
  stepIndex: number;
  state: Record<string, unknown>;
  messages: unknown[];
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Skill {
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  parameters: z.ZodType<any>;
  execute: (params: any, context: SkillContext) => Promise<SkillResult>;
  validate?: (params: any) => boolean;
}

export interface SkillContext {
  agentId: string;
  taskId: string;
  stepIndex: number;
  modelRouter: any;
  logger: any;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenGateConfig {
  requiredTokenAmount: bigint;
  tokenMint: string;
  tiers: TokenTier[];
}

export interface TokenTier {
  name: string;
  minTokens: bigint;
  maxCallsPerDay: number;
  allowedModels: string[];
  allowedSkills: string[];
  features: string[];
}

export const DEFAULT_TOKEN_TIERS: TokenTier[] = [
  {
    name: "basic",
    minTokens: BigInt(1000),
    maxCallsPerDay: 50,
    allowedModels: ["gemini-3-flash", "minimax-m2.1"],
    allowedSkills: ["search", "browser"],
    features: ["basic-chat", "web-search"],
  },
  {
    name: "standard",
    minTokens: BigInt(10000),
    maxCallsPerDay: 500,
    allowedModels: ["gemini-3-flash", "minimax-m2.1", "minimax-m2.7", "kimi-k2.5"],
    allowedSkills: ["search", "browser", "code", "data"],
    features: ["basic-chat", "web-search", "code-execution", "data-analysis"],
  },
  {
    name: "premium",
    minTokens: BigInt(100000),
    maxCallsPerDay: 5000,
    allowedModels: [
      "gpt-5.4",
      "minimax-m2.7",
      "gemini-3-flash",
      "kimi-k2.5",
      "claude-vertex",
      "minimax-m2.1",
    ],
    allowedSkills: ["search", "browser", "code", "multimodal", "communication", "data", "custom"],
    features: [
      "basic-chat",
      "web-search",
      "code-execution",
      "data-analysis",
      "multimodal",
      "agent-browser",
      "telegram-bot",
      "lark-bot",
    ],
  },
];
