/**
 * @module installer
 * @description Plugin installer — install, update, and manage plugin lifecycle
 */

import EventEmitter from "eventemitter3";
import {
  PluginManifest,
  InstalledPlugin,
  PluginStatus,
} from "../types/plugin";
import { PluginDiscovery } from "../discovery/discovery";
import { SkillMapper } from "../mapper/skill-mapper";

export interface InstallerEvents {
  installed: (plugin: InstalledPlugin) => void;
  uninstalled: (pluginName: string) => void;
  updated: (plugin: InstalledPlugin) => void;
  activated: (pluginName: string) => void;
  deactivated: (pluginName: string) => void;
  error: (pluginName: string, error: Error) => void;
}

export class PluginInstaller extends EventEmitter<InstallerEvents> {
  private installed: Map<string, InstalledPlugin> = new Map();
  private discovery: PluginDiscovery;
  private skillMapper: SkillMapper;

  constructor(discovery: PluginDiscovery, skillMapper: SkillMapper) {
    super();
    this.discovery = discovery;
    this.skillMapper = skillMapper;
  }

  async install(
    manifest: PluginManifest,
    config?: Record<string, unknown>
  ): Promise<InstalledPlugin> {
    if (this.installed.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already installed`);
    }

    // Validate configuration
    if (manifest.configuration) {
      this.validateConfig(manifest, config || {});
    }

    // Map plugin capabilities to OpenClaw skills
    const mappedSkills = this.skillMapper.mapPlugin(manifest);

    const plugin: InstalledPlugin = {
      manifest,
      status: "installed",
      installedAt: new Date(),
      config: config || {},
      mappedSkills: mappedSkills.map((s) => s.openclawSkillName),
    };

    this.installed.set(manifest.name, plugin);
    this.emit("installed", plugin);

    return plugin;
  }

  async uninstall(pluginName: string): Promise<void> {
    const plugin = this.installed.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" is not installed`);
    }

    // Remove skill mappings
    this.skillMapper.unmapPlugin(plugin.manifest);

    this.installed.delete(pluginName);
    this.emit("uninstalled", pluginName);
  }

  async activate(pluginName: string): Promise<void> {
    const plugin = this.installed.get(pluginName);
    if (!plugin) throw new Error(`Plugin "${pluginName}" is not installed`);

    plugin.status = "active";
    this.emit("activated", pluginName);
  }

  async deactivate(pluginName: string): Promise<void> {
    const plugin = this.installed.get(pluginName);
    if (!plugin) throw new Error(`Plugin "${pluginName}" is not installed`);

    plugin.status = "disabled";
    this.emit("deactivated", pluginName);
  }

  async update(
    pluginName: string,
    newManifest: PluginManifest
  ): Promise<InstalledPlugin> {
    const existing = this.installed.get(pluginName);
    if (!existing) throw new Error(`Plugin "${pluginName}" is not installed`);

    // Unmap old skills and remap new ones
    this.skillMapper.unmapPlugin(existing.manifest);
    const mappedSkills = this.skillMapper.mapPlugin(newManifest);

    existing.manifest = newManifest;
    existing.mappedSkills = mappedSkills.map((s) => s.openclawSkillName);

    this.emit("updated", existing);
    return existing;
  }

  getPlugin(name: string): InstalledPlugin | undefined {
    return this.installed.get(name);
  }

  getAllPlugins(): InstalledPlugin[] {
    return Array.from(this.installed.values());
  }

  getActivePlugins(): InstalledPlugin[] {
    return this.getAllPlugins().filter((p) => p.status === "active");
  }

  updateConfig(
    pluginName: string,
    config: Record<string, unknown>
  ): void {
    const plugin = this.installed.get(pluginName);
    if (!plugin) throw new Error(`Plugin "${pluginName}" is not installed`);

    this.validateConfig(plugin.manifest, config);
    plugin.config = { ...plugin.config, ...config };
  }

  private validateConfig(
    manifest: PluginManifest,
    config: Record<string, unknown>
  ): void {
    if (!manifest.configuration) return;

    for (const [key, field] of Object.entries(manifest.configuration)) {
      if (field.required && !(key in config)) {
        throw new Error(
          `Missing required configuration field: ${key} (${field.description})`
        );
      }
    }
  }
}
