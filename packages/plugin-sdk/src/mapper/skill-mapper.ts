/**
 * @module skill-mapper
 * @description Automatic mapping from external plugin capabilities to OpenClaw skills
 */

import {
  PluginManifest,
  SkillMapping,
  PluginCapability,
} from "../types/plugin";

export interface MappedSkill {
  openclawSkillName: string;
  pluginName: string;
  pluginCapability: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  parameterMapping: Record<string, string>;
  outputMapping?: Record<string, string>;
}

export class SkillMapper {
  private mappings: Map<string, MappedSkill> = new Map();
  private customMappers: Map<string, (cap: PluginCapability) => MappedSkill | null> = new Map();

  mapPlugin(manifest: PluginManifest): MappedSkill[] {
    const results: MappedSkill[] = [];

    for (const capability of manifest.capabilities) {
      // Check for explicit mapping in manifest
      const explicitMapping = manifest.openclawMapping?.find(
        (m) => m.pluginCapability === capability.name
      );

      let mapped: MappedSkill;

      if (explicitMapping) {
        mapped = {
          openclawSkillName: explicitMapping.openclawSkillName,
          pluginName: manifest.name,
          pluginCapability: capability.name,
          description: explicitMapping.description || capability.description,
          inputSchema: capability.inputSchema,
          outputSchema: capability.outputSchema,
          parameterMapping: explicitMapping.parameterMapping,
          outputMapping: explicitMapping.outputMapping,
        };
      } else {
        // Auto-generate mapping
        mapped = this.autoMap(manifest.name, capability);
      }

      this.mappings.set(mapped.openclawSkillName, mapped);
      results.push(mapped);
    }

    return results;
  }

  unmapPlugin(manifest: PluginManifest): void {
    for (const [key, mapping] of this.mappings) {
      if (mapping.pluginName === manifest.name) {
        this.mappings.delete(key);
      }
    }
  }

  getMapping(skillName: string): MappedSkill | undefined {
    return this.mappings.get(skillName);
  }

  getAllMappings(): MappedSkill[] {
    return Array.from(this.mappings.values());
  }

  getMappingsByPlugin(pluginName: string): MappedSkill[] {
    return Array.from(this.mappings.values()).filter(
      (m) => m.pluginName === pluginName
    );
  }

  registerCustomMapper(
    source: string,
    mapper: (cap: PluginCapability) => MappedSkill | null
  ): void {
    this.customMappers.set(source, mapper);
  }

  private autoMap(pluginName: string, capability: PluginCapability): MappedSkill {
    // Generate a standardized OpenClaw skill name
    const skillName = `${pluginName}_${capability.name}`
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_");

    // Auto-generate parameter mapping (identity mapping)
    const parameterMapping: Record<string, string> = {};
    if (capability.inputSchema && typeof capability.inputSchema === "object") {
      const properties = (capability.inputSchema as any).properties || {};
      for (const key of Object.keys(properties)) {
        parameterMapping[key] = key;
      }
    }

    return {
      openclawSkillName: skillName,
      pluginName,
      pluginCapability: capability.name,
      description: `[Auto-mapped] ${capability.description}`,
      inputSchema: capability.inputSchema,
      outputSchema: capability.outputSchema,
      parameterMapping,
    };
  }
}
