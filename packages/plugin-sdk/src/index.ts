/**
 * @gleam-openclaw/plugin-sdk
 *
 * Plugin SDK for OpenClaw — discover, install, and automatically map
 * Claude/Codex/Cursor plugins to OpenClaw skills.
 */

export * from "./types/plugin";
export { PluginDiscovery, type DiscoveryConfig, type DiscoveryEvents } from "./discovery/discovery";
export { PluginInstaller, type InstallerEvents } from "./installer/installer";
export { SkillMapper, type MappedSkill } from "./mapper/skill-mapper";
