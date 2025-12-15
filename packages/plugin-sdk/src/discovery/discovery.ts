/**
 * @module discovery
 * @description Plugin discovery service — search and find plugins from Claude, Codex, Cursor ecosystems
 */

import EventEmitter from "eventemitter3";
import {
  PluginManifest,
  PluginSource,
  PluginSearchResult,
  PluginRegistryEntry,
} from "../types/plugin";

export interface DiscoveryConfig {
  registryUrls?: Record<PluginSource, string>;
  cacheTimeout?: number;
}

export interface DiscoveryEvents {
  pluginFound: (plugin: PluginSearchResult) => void;
  searchComplete: (results: PluginSearchResult[]) => void;
  error: (error: Error) => void;
}

export class PluginDiscovery extends EventEmitter<DiscoveryEvents> {
  private registry: Map<string, PluginRegistryEntry> = new Map();
  private cache: Map<string, { data: PluginSearchResult[]; timestamp: number }> = new Map();
  private cacheTimeout: number;

  private readonly defaultRegistries: Record<PluginSource, string> = {
    claude: "https://registry.anthropic.com/plugins",
    codex: "https://registry.openai.com/codex-plugins",
    cursor: "https://registry.cursor.com/plugins",
    openai: "https://registry.openai.com/plugins",
    custom: "",
    npm: "https://registry.npmjs.org",
  };

  constructor(config: DiscoveryConfig = {}) {
    super();
    this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour
  }

  async search(
    query: string,
    sources?: PluginSource[],
    limit: number = 20
  ): Promise<PluginSearchResult[]> {
    const cacheKey = `${query}:${sources?.join(",") || "all"}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const targetSources = sources || (["claude", "codex", "cursor", "npm"] as PluginSource[]);
    const results: PluginSearchResult[] = [];

    for (const source of targetSources) {
      try {
        const sourceResults = await this.searchSource(query, source, limit);
        results.push(...sourceResults);
      } catch (error: any) {
        this.emit("error", new Error(`Failed to search ${source}: ${error.message}`));
      }
    }

    // Sort by relevance and downloads
    results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    const limited = results.slice(0, limit);

    this.cache.set(cacheKey, { data: limited, timestamp: Date.now() });
    this.emit("searchComplete", limited);

    return limited;
  }

  async getPluginManifest(
    name: string,
    source: PluginSource
  ): Promise<PluginManifest | null> {
    const entry = this.registry.get(`${source}:${name}`);
    if (entry) return entry.manifest;

    // Try to fetch from source registry
    try {
      const manifest = await this.fetchManifest(name, source);
      if (manifest) {
        this.registry.set(`${source}:${name}`, {
          manifest,
          publishedAt: new Date(),
          updatedAt: new Date(),
          downloads: 0,
          verified: false,
        });
      }
      return manifest;
    } catch {
      return null;
    }
  }

  registerPlugin(manifest: PluginManifest): void {
    const key = `${manifest.source}:${manifest.name}`;
    this.registry.set(key, {
      manifest,
      publishedAt: new Date(),
      updatedAt: new Date(),
      downloads: 0,
      verified: false,
    });
  }

  getRegisteredPlugins(): PluginRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  private async searchSource(
    query: string,
    source: PluginSource,
    limit: number
  ): Promise<PluginSearchResult[]> {
    // In production, this would make HTTP requests to the actual registries
    // For the framework, we provide the interface and local registry search
    const results: PluginSearchResult[] = [];

    for (const [key, entry] of this.registry) {
      if (!key.startsWith(`${source}:`)) continue;

      const manifest = entry.manifest;
      const matchesQuery =
        manifest.name.toLowerCase().includes(query.toLowerCase()) ||
        manifest.description.toLowerCase().includes(query.toLowerCase()) ||
        manifest.keywords.some((k) =>
          k.toLowerCase().includes(query.toLowerCase())
        );

      if (matchesQuery) {
        results.push({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          source: manifest.source,
          downloads: entry.downloads,
          keywords: manifest.keywords,
        });
      }
    }

    return results.slice(0, limit);
  }

  private async fetchManifest(
    name: string,
    source: PluginSource
  ): Promise<PluginManifest | null> {
    // Framework placeholder — implement actual registry fetching per source
    return null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
