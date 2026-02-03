/**
 * @gleam-openclaw/skill-vetter
 *
 * Skill Vetter — validate, audit, and vet agent skills for safety, quality,
 * and compatibility before they are deployed in the OpenClaw ecosystem.
 */

import { z } from "zod";
import EventEmitter from "eventemitter3";

export type VetStatus = "passed" | "failed" | "warning" | "pending";
export type VetCategory = "safety" | "quality" | "performance" | "compatibility" | "security";

export interface VetResult {
  skillName: string;
  status: VetStatus;
  score: number; // 0-100
  checks: VetCheck[];
  recommendations: string[];
  vettedAt: Date;
}

export interface VetCheck {
  category: VetCategory;
  name: string;
  status: VetStatus;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author?: string;
  parameters: Record<string, unknown>;
  execute: Function;
  permissions?: string[];
  timeout?: number;
  rateLimit?: number;
}

export interface VetterConfig {
  strictMode?: boolean;
  maxTimeout?: number;
  allowedPermissions?: string[];
  blockedPatterns?: string[];
  minQualityScore?: number;
}

export interface VetterEvents {
  vetStarted: (skillName: string) => void;
  vetCompleted: (result: VetResult) => void;
  checkPassed: (check: VetCheck) => void;
  checkFailed: (check: VetCheck) => void;
}

export class SkillVetter extends EventEmitter<VetterEvents> {
  private config: Required<VetterConfig>;
  private results: Map<string, VetResult> = new Map();

  constructor(config: VetterConfig = {}) {
    super();
    this.config = {
      strictMode: config.strictMode ?? false,
      maxTimeout: config.maxTimeout ?? 300000, // 5 minutes
      allowedPermissions: config.allowedPermissions || [
        "network",
        "filesystem.read",
        "browser",
        "search",
      ],
      blockedPatterns: config.blockedPatterns || [
        "eval(",
        "Function(",
        "child_process",
        "require('fs').writeFile",
        "rm -rf",
        "DROP TABLE",
      ],
      minQualityScore: config.minQualityScore ?? 60,
    };
  }

  async vet(skill: SkillDefinition): Promise<VetResult> {
    this.emit("vetStarted", skill.name);

    const checks: VetCheck[] = [];

    // Safety checks
    checks.push(...this.runSafetyChecks(skill));

    // Quality checks
    checks.push(...this.runQualityChecks(skill));

    // Performance checks
    checks.push(...this.runPerformanceChecks(skill));

    // Compatibility checks
    checks.push(...this.runCompatibilityChecks(skill));

    // Security checks
    checks.push(...this.runSecurityChecks(skill));

    // Calculate overall score
    const score = this.calculateScore(checks);
    const criticalFailures = checks.filter(
      (c) => c.status === "failed" && c.severity === "critical"
    );

    const status: VetStatus =
      criticalFailures.length > 0
        ? "failed"
        : score >= this.config.minQualityScore
          ? "passed"
          : "warning";

    const recommendations = this.generateRecommendations(checks);

    const result: VetResult = {
      skillName: skill.name,
      status,
      score,
      checks,
      recommendations,
      vettedAt: new Date(),
    };

    this.results.set(skill.name, result);
    this.emit("vetCompleted", result);

    return result;
  }

  getResult(skillName: string): VetResult | undefined {
    return this.results.get(skillName);
  }

  getAllResults(): VetResult[] {
    return Array.from(this.results.values());
  }

  private runSafetyChecks(skill: SkillDefinition): VetCheck[] {
    const checks: VetCheck[] = [];
    const code = skill.execute.toString();

    // Check for blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      const found = code.includes(pattern);
      checks.push({
        category: "safety",
        name: `blocked_pattern_${pattern.replace(/[^a-zA-Z]/g, "_")}`,
        status: found ? "failed" : "passed",
        message: found
          ? `Blocked pattern detected: "${pattern}"`
          : `No blocked pattern: "${pattern}"`,
        severity: found ? "critical" : "info",
      });
    }

    // Check permissions
    if (skill.permissions) {
      for (const perm of skill.permissions) {
        const allowed = this.config.allowedPermissions.includes(perm);
        checks.push({
          category: "safety",
          name: `permission_${perm}`,
          status: allowed ? "passed" : "failed",
          message: allowed
            ? `Permission "${perm}" is allowed`
            : `Permission "${perm}" is not in the allowed list`,
          severity: allowed ? "info" : "high",
        });
      }
    }

    return checks;
  }

  private runQualityChecks(skill: SkillDefinition): VetCheck[] {
    const checks: VetCheck[] = [];

    // Description quality
    checks.push({
      category: "quality",
      name: "description_quality",
      status: skill.description && skill.description.length > 20 ? "passed" : "warning",
      message:
        skill.description && skill.description.length > 20
          ? "Skill has a meaningful description"
          : "Skill description is too short or missing",
      severity: "medium",
    });

    // Version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    checks.push({
      category: "quality",
      name: "version_format",
      status: versionRegex.test(skill.version) ? "passed" : "warning",
      message: versionRegex.test(skill.version)
        ? "Version follows semver format"
        : "Version should follow semver format (x.y.z)",
      severity: "low",
    });

    // Parameters defined
    checks.push({
      category: "quality",
      name: "parameters_defined",
      status: Object.keys(skill.parameters).length > 0 ? "passed" : "warning",
      message:
        Object.keys(skill.parameters).length > 0
          ? "Skill has defined parameters"
          : "Skill has no parameters defined",
      severity: "low",
    });

    return checks;
  }

  private runPerformanceChecks(skill: SkillDefinition): VetCheck[] {
    const checks: VetCheck[] = [];

    // Timeout check
    const timeout = skill.timeout || 30000;
    checks.push({
      category: "performance",
      name: "timeout_reasonable",
      status: timeout <= this.config.maxTimeout ? "passed" : "warning",
      message:
        timeout <= this.config.maxTimeout
          ? `Timeout (${timeout}ms) is within acceptable range`
          : `Timeout (${timeout}ms) exceeds maximum (${this.config.maxTimeout}ms)`,
      severity: "medium",
    });

    // Rate limit check
    if (skill.rateLimit) {
      checks.push({
        category: "performance",
        name: "rate_limit_set",
        status: "passed",
        message: `Rate limit configured: ${skill.rateLimit} requests/minute`,
        severity: "info",
      });
    }

    return checks;
  }

  private runCompatibilityChecks(skill: SkillDefinition): VetCheck[] {
    const checks: VetCheck[] = [];

    // Execute function exists and is callable
    checks.push({
      category: "compatibility",
      name: "execute_callable",
      status: typeof skill.execute === "function" ? "passed" : "failed",
      message:
        typeof skill.execute === "function"
          ? "Skill execute function is callable"
          : "Skill execute must be a function",
      severity: "critical",
    });

    // Name format
    const nameRegex = /^[a-z][a-z0-9_]*$/;
    checks.push({
      category: "compatibility",
      name: "name_format",
      status: nameRegex.test(skill.name) ? "passed" : "warning",
      message: nameRegex.test(skill.name)
        ? "Skill name follows naming convention"
        : "Skill name should be lowercase with underscores",
      severity: "medium",
    });

    return checks;
  }

  private runSecurityChecks(skill: SkillDefinition): VetCheck[] {
    const checks: VetCheck[] = [];
    const code = skill.execute.toString();

    // Check for potential injection vectors
    const injectionPatterns = ["process.env", "require(", "import("];
    for (const pattern of injectionPatterns) {
      if (code.includes(pattern)) {
        checks.push({
          category: "security",
          name: `injection_check_${pattern.replace(/[^a-zA-Z]/g, "_")}`,
          status: this.config.strictMode ? "failed" : "warning",
          message: `Potential security concern: "${pattern}" found in skill code`,
          severity: this.config.strictMode ? "high" : "medium",
        });
      }
    }

    return checks;
  }

  private calculateScore(checks: VetCheck[]): number {
    if (checks.length === 0) return 0;

    const weights: Record<string, number> = {
      critical: 0,
      high: 25,
      medium: 50,
      low: 75,
      info: 100,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const check of checks) {
      const weight = check.status === "passed" ? 100 : weights[check.severity] || 50;
      weightedSum += weight;
      totalWeight++;
    }

    return Math.round(weightedSum / totalWeight);
  }

  private generateRecommendations(checks: VetCheck[]): string[] {
    const recommendations: string[] = [];
    const failedChecks = checks.filter((c) => c.status === "failed" || c.status === "warning");

    for (const check of failedChecks) {
      switch (check.category) {
        case "safety":
          recommendations.push(
            `[Safety] ${check.message}. Consider removing or sandboxing the flagged code.`
          );
          break;
        case "quality":
          recommendations.push(
            `[Quality] ${check.message}. Improve documentation and metadata.`
          );
          break;
        case "performance":
          recommendations.push(
            `[Performance] ${check.message}. Optimize resource usage.`
          );
          break;
        case "security":
          recommendations.push(
            `[Security] ${check.message}. Review and restrict access patterns.`
          );
          break;
        case "compatibility":
          recommendations.push(
            `[Compatibility] ${check.message}. Ensure OpenClaw SDK compliance.`
          );
          break;
      }
    }

    return recommendations;
  }
}
