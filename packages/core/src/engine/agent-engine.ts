/**
 * @module agent-engine
 * @description Core agent execution engine with ReAct loop, checkpoint, and token-gated access
 */

import { v4 as uuidv4 } from "uuid";
import EventEmitter from "eventemitter3";
import {
  AgentConfig,
  AgentTask,
  AgentStep,
  AgentStatus,
  Checkpoint,
  Skill,
  SkillContext,
  TokenGateConfig,
  DEFAULT_TOKEN_TIERS,
} from "../types/agent";
import { UnifiedModelRouter, CompletionRequest, ChatMessage } from "@gleam-openclaw/model-router";

export interface AgentEngineConfig {
  modelRouter: UnifiedModelRouter;
  tokenGate?: TokenGateConfig;
  defaultTimeout?: number;
  defaultMaxSteps?: number;
  checkpointStore?: CheckpointStore;
}

export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>;
  load(taskId: string, stepIndex?: number): Promise<Checkpoint | null>;
  list(taskId: string): Promise<Checkpoint[]>;
  delete(taskId: string): Promise<void>;
}

export interface EngineEvents {
  taskStarted: (task: AgentTask) => void;
  stepCompleted: (task: AgentTask, step: AgentStep) => void;
  taskCompleted: (task: AgentTask) => void;
  taskFailed: (task: AgentTask, error: Error) => void;
  taskPaused: (task: AgentTask) => void;
  checkpointSaved: (checkpoint: Checkpoint) => void;
  skillExecuted: (skillName: string, result: any) => void;
}

export class InMemoryCheckpointStore implements CheckpointStore {
  private store: Map<string, Checkpoint[]> = new Map();

  async save(checkpoint: Checkpoint): Promise<void> {
    const existing = this.store.get(checkpoint.taskId) || [];
    existing.push(checkpoint);
    this.store.set(checkpoint.taskId, existing);
  }

  async load(taskId: string, stepIndex?: number): Promise<Checkpoint | null> {
    const checkpoints = this.store.get(taskId) || [];
    if (stepIndex !== undefined) {
      return checkpoints.find((c) => c.stepIndex === stepIndex) || null;
    }
    return checkpoints[checkpoints.length - 1] || null;
  }

  async list(taskId: string): Promise<Checkpoint[]> {
    return this.store.get(taskId) || [];
  }

  async delete(taskId: string): Promise<void> {
    this.store.delete(taskId);
  }
}

export class AgentEngine extends EventEmitter<EngineEvents> {
  private modelRouter: UnifiedModelRouter;
  private skills: Map<string, Skill> = new Map();
  private activeTasks: Map<string, AgentTask> = new Map();
  private checkpointStore: CheckpointStore;
  private defaultTimeout: number;
  private defaultMaxSteps: number;

  constructor(config: AgentEngineConfig) {
    super();
    this.modelRouter = config.modelRouter;
    this.checkpointStore =
      config.checkpointStore || new InMemoryCheckpointStore();
    this.defaultTimeout = config.defaultTimeout || 172800000; // 48 hours
    this.defaultMaxSteps = config.defaultMaxSteps || 100;
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  registerSkills(skills: Skill[]): void {
    skills.forEach((s) => this.registerSkill(s));
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  async executeTask(
    agentConfig: AgentConfig,
    input: string,
    resumeFromCheckpoint?: string
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: uuidv4(),
      agentId: agentConfig.id || uuidv4(),
      input,
      status: "running",
      steps: [],
      startedAt: new Date(),
      checkpoints: [],
      tokenUsage: { totalInput: 0, totalOutput: 0, totalCost: 0 },
    };

    this.activeTasks.set(task.id, task);
    this.emit("taskStarted", task);

    const messages: ChatMessage[] = [];
    let startStep = 0;

    // Resume from checkpoint if specified
    if (resumeFromCheckpoint) {
      const checkpoint = await this.checkpointStore.load(resumeFromCheckpoint);
      if (checkpoint) {
        messages.push(...(checkpoint.messages as ChatMessage[]));
        startStep = checkpoint.stepIndex + 1;
      }
    }

    // Build system prompt with available skills
    const systemPrompt = this.buildSystemPrompt(agentConfig);
    messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: input });

    const timeout = agentConfig.timeout || this.defaultTimeout;
    const maxSteps = agentConfig.maxSteps || this.defaultMaxSteps;
    const startTime = Date.now();

    try {
      for (let stepIndex = startStep; stepIndex < maxSteps; stepIndex++) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          task.status = "failed";
          task.error = "Task execution timed out";
          break;
        }

        // Call model
        const request: CompletionRequest = {
          model: agentConfig.modelId,
          messages,
          temperature: 0.7,
          tools: this.buildToolDefinitions(agentConfig.skills),
        };

        const response = await this.modelRouter.complete(request);
        const choice = response.choices[0];

        task.tokenUsage.totalInput += response.usage.promptTokens;
        task.tokenUsage.totalOutput += response.usage.completionTokens;

        // Record step
        const step: AgentStep = {
          id: uuidv4(),
          index: stepIndex,
          type: choice.message.tool_calls ? "skill_call" : "response",
          content: choice.message.content as string,
          timestamp: new Date(),
          durationMs: response.latencyMs,
          tokenUsage: {
            input: response.usage.promptTokens,
            output: response.usage.completionTokens,
          },
        };

        // Handle tool calls
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            const skillName = toolCall.function.name;
            const skillInput = JSON.parse(toolCall.function.arguments);

            step.skillName = skillName;
            step.skillInput = skillInput;

            const skill = this.skills.get(skillName);
            if (skill) {
              const context: SkillContext = {
                agentId: task.agentId,
                taskId: task.id,
                stepIndex,
                modelRouter: this.modelRouter,
                logger: console,
              };

              const result = await skill.execute(skillInput, context);
              step.skillOutput = result as any;
              this.emit("skillExecuted", skillName, result);

              messages.push({
                role: "tool",
                content: JSON.stringify(result.data || result.error),
                tool_call_id: toolCall.id,
              });
            } else {
              messages.push({
                role: "tool",
                content: `Skill "${skillName}" not found`,
                tool_call_id: toolCall.id,
              });
            }
          }
        } else {
          // Final response — no more tool calls
          task.result = choice.message.content as string;
          task.status = "completed";
          task.completedAt = new Date();

          step.type = "response";
          task.steps.push(step);
          this.emit("stepCompleted", task, step);
          break;
        }

        task.steps.push(step);
        this.emit("stepCompleted", task, step);

        // Save checkpoint if enabled
        if (
          agentConfig.checkpointEnabled &&
          stepIndex % (agentConfig.checkpointInterval || 5) === 0
        ) {
          const checkpoint: Checkpoint = {
            id: uuidv4(),
            taskId: task.id,
            stepIndex,
            state: { status: task.status },
            messages: [...messages],
            createdAt: new Date(),
          };

          await this.checkpointStore.save(checkpoint);
          task.checkpoints.push(checkpoint);
          this.emit("checkpointSaved", checkpoint);
        }
      }

      if (task.status === "running") {
        task.status = "completed";
        task.completedAt = new Date();
      }

      this.emit("taskCompleted", task);
    } catch (error: any) {
      task.status = "failed";
      task.error = error.message;
      this.emit("taskFailed", task, error);
    }

    this.activeTasks.delete(task.id);
    return task;
  }

  async pauseTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = "paused";
      this.emit("taskPaused", task);
    }
  }

  getActiveTask(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId);
  }

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  private buildSystemPrompt(config: AgentConfig): string {
    const skillDescriptions = config.skills
      .map((name) => {
        const skill = this.skills.get(name);
        return skill ? `- ${skill.name}: ${skill.description}` : null;
      })
      .filter(Boolean)
      .join("\n");

    return `${config.systemPrompt || "You are OpenClaw Agent, a powerful AI assistant."}

Available Skills:
${skillDescriptions || "No skills registered."}

Instructions:
1. Analyze the user's request carefully.
2. Use available skills to gather information and take actions.
3. Provide comprehensive, well-structured responses.
4. If a task requires multiple steps, plan and execute them sequentially.
5. Always verify results before providing the final answer.`;
  }

  private buildToolDefinitions(skillNames: string[]): any[] {
    return skillNames
      .map((name) => {
        const skill = this.skills.get(name);
        if (!skill) return null;

        return {
          type: "function",
          function: {
            name: skill.name,
            description: skill.description,
            parameters:
              skill.parameters instanceof z.ZodType
                ? zodToJsonSchema(skill.parameters)
                : skill.parameters,
          },
        };
      })
      .filter(Boolean);
  }
}

/** Simple Zod to JSON Schema converter for tool definitions */
function zodToJsonSchema(schema: z.ZodType<any>): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType<any>);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: "object", properties, required };
  }

  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }

  return { type: "string" };
}

// Re-export zod for convenience
import { z } from "zod";
