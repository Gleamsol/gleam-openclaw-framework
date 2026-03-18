# Changelog

All notable changes to the Gleam OpenClaw API Solana framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-25

### Added

#### AI Model Layer
- **GPT-5.4** as default flagship model with top-tier performance
- **MiniMax M2.7** integration with multi-modal capabilities
- **Anthropic Claude Vertex** access via Google Vertex AI
- **Gemini 3 Flash** support with 1M context window
- **MiniMax M2.1** support (outperforms M2.5 in reasoning)
- **Kimi K2.5** support with strong Chinese language capabilities
- Multi-model unified router with load balancing, failover, and cost optimization
- Model performance benchmarking endpoint

#### Solana Integration
- `@gleam-openclaw/solana-gateway` package for blockchain integration
- Multi-wallet adapter support (Phantom, Solflare, OKX, Bitget)
- SPL token operations and registry
- Payment gateway with transaction verification
- Token-gated access control with three tiers (Basic, Standard, Premium)

#### Agent Engine
- `@gleam-openclaw/core` package with ReAct-loop agent engine
- Task orchestration with configurable max steps
- Checkpoint and resume (breakpoint continuation) support
- 48-hour default timeout for long-running tasks
- Token gate guard with credential generation and verification

#### Plugin SDK
- `@gleam-openclaw/plugin-sdk` for plugin ecosystem
- Plugin discovery from Claude, Codex, Cursor, and npm registries
- Plugin installation and lifecycle management
- Automatic mapping from external plugin capabilities to OpenClaw skills
- Custom mapper registration for source-specific transformations

#### Browser & Agent
- `@gleam-openclaw/browser-agent` for browser automation
- Connect to Brave/Edge/Chrome via userDataDir
- Browser checkpoint save and restore
- `@gleam-openclaw/agent-browser` AI-native browser execution environment
- Visual anchor recognition for interactive elements
- Headless mode (HeadlessMode) for stealth browsing
- Anti-crawler penetration with stealth techniques
- Natural language browser control with 93% token reduction

#### Search & Multi-Modal
- `@gleam-openclaw/tavily-search` for AI-native web search
- Structured summaries with source attribution
- URL content extraction
- `@gleam-openclaw/rhclaw` multi-modal execution engine
- Image generation (DALL-E 3 integration)
- Audio generation and speech synthesis
- Video generation with cinematic styles
- Media analysis and transformation

#### Skill Vetter
- `@gleam-openclaw/skill-vetter` for skill validation
- Safety checks with blocked pattern detection
- Quality assessment with scoring
- Performance evaluation
- Security auditing
- Compatibility verification

#### Platform Integrations
- `@gleam-openclaw/platforms` package
- Android dark mode adaptation with CSS variable generation
- Lark (Feishu) interactive card builder and bot client
- Telegram topic auto-naming with multiple strategies
- Long conversation compression with four strategies:
  - Sliding window
  - Summary-based
  - Importance-weighted
  - Hybrid (recommended)

#### DApp Frontend
- React + TypeScript + Tailwind CSS frontend
- Solana wallet connection (multi-wallet support)
- Token balance display with real-time updates
- Agent console with model selection and skill toggling
- Tier-based access display
- Dark mode UI

#### Infrastructure
- Monorepo with pnpm workspaces and Turborepo
- Docker Compose for local development
- API server with Express, rate limiting, and CORS
- GitHub Actions CI/CD pipeline
- Comprehensive documentation (bilingual README, CONTRIBUTING, CHANGELOG)

### Notes
- MiniMax M2.5 is available but M2.1 is recommended due to superior reasoning performance
- GPT-5.4 is the default model for premium tier users

## [1.0.0] - 2025-12-20

### Added
- Initial release with basic OpenClaw integration
- Solana wallet connection
- Single model support
