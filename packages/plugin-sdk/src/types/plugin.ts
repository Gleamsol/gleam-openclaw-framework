/**
 * @module plugin-types
 * @description Type definitions for the OpenClaw Plugin SDK
 */

import { z } from "zod";

export type PluginSource = "claude" | "codex" | "cursor" | "openai" | "custom" | "npm";
export type PluginStatus = "available" | "installed" | "active" | "disabled" | "error";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  source: PluginSource;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords: string[];
  capabilities: PluginCapability[];
  configuration?: Record<string, PluginConfigField>;
  dependencies?: Record<string, string>;
  openclawMapping?: SkillMapping[];
}

export interface PluginCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface PluginConfigField {
  type: "string" | "number" | "boolean" | "select";
  description: string;
  required: boolean;
  default?: unknown;
  options?: string[];
}

export interface SkillMapping {
  pluginCapability: string;
  openclawSkillName: string;
  parameterMapping: Record<string, string>;
  outputMapping?: Record<string, string>;
  description?: string;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  status: PluginStatus;
  installedAt: Date;
  config: Record<string, unknown>;
  mappedSkills: string[];
  errorMessage?: string;
}

export interface PluginSearchResult {
  name: string;
  version: string;
  description: string;
  author: string;
  source: PluginSource;
  downloads?: number;
  rating?: number;
  keywords: string[];
}

export interface PluginRegistryEntry {
  manifest: PluginManifest;
  publishedAt: Date;
  updatedAt: Date;
  downloads: number;
  verified: boolean;
}
