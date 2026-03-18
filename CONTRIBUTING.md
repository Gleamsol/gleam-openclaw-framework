# Contributing to Gleam OpenClaw API Solana

Thank you for your interest in contributing to the Gleam OpenClaw framework! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0
- **TypeScript** >= 5.3
- **Git**

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/gleam-openclaw-framework.git
cd gleam-openclaw-framework

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Project Structure

```
gleam-openclaw-framework/
├── apps/
│   ├── api/                    # REST API server
│   └── dapp/                   # Frontend DApp
├── packages/
│   ├── solana-gateway/         # Solana blockchain integration
│   ├── model-router/           # AI model unified router
│   ├── core/                   # Agent engine and token gate
│   ├── plugin-sdk/             # Plugin discovery and mapping
│   ├── browser-agent/          # Browser automation
│   ├── agent-browser/          # AI-native browser
│   ├── tavily-search/          # AI-native web search
│   ├── rhclaw/                 # Multi-modal execution
│   ├── skill-vetter/           # Skill validation
│   └── platforms/              # Platform integrations
├── docs/                       # Documentation
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include reproduction steps, expected behavior, and actual behavior
- Tag issues appropriately (bug, feature, documentation, etc.)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the coding standards
4. Write or update tests as needed
5. Commit using conventional commits: `git commit -m "feat(module): description"`
6. Push to your fork: `git push origin feat/your-feature`
7. Open a Pull Request against the `main` branch

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

Scopes: `core`, `api`, `dapp`, `solana-gateway`, `model-router`, `plugin-sdk`, `browser-agent`, `agent-browser`, `tavily-search`, `rhclaw`, `skill-vetter`, `platforms`

### Coding Standards

- **TypeScript** for all source code
- **ESM** module format
- Use `zod` for runtime validation
- Follow existing code patterns and naming conventions
- Add JSDoc comments for public APIs
- Keep functions focused and composable

### Adding a New AI Model Provider

1. Create a new provider file in `packages/model-router/src/providers/`
2. Extend the `BaseProvider` class
3. Add model definitions to the `DEFAULT_MODELS` array
4. Register the provider in the `UnifiedModelRouter`
5. Update documentation and tests

### Adding a New Plugin Source

1. Add the source type to `PluginSource` in `packages/plugin-sdk/src/types/plugin.ts`
2. Implement the registry fetcher in `PluginDiscovery`
3. Add any source-specific mapping logic to `SkillMapper`
4. Update documentation

### Adding a New Platform Integration

1. Create a new directory under `packages/platforms/src/`
2. Implement the integration module
3. Export from `packages/platforms/src/index.ts`
4. Update documentation

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @gleam-openclaw/core test

# Run tests in watch mode
pnpm --filter @gleam-openclaw/core test -- --watch
```

## Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md for all notable changes
- Add inline JSDoc comments for new public APIs
- Update architecture docs in `/docs` for structural changes

## Code of Conduct

Be respectful, inclusive, and constructive. We are committed to providing a welcoming and inspiring community for all.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
