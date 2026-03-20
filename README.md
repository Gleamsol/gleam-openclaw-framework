# Gleam OpenClaw API Solana

<div align="center">

**Solana-Powered AI Agent Framework — Use MEME Tokens to Access OpenClaw Agent**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3-purple.svg)](https://solana.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

[English](#english) | [中文](#中文)

</div>

---

## English

### Overview

**Gleam OpenClaw API Solana** is a comprehensive open-source framework that bridges the Solana blockchain ecosystem with AI Agent capabilities. It enables developers to build applications where Solana MEME tokens serve as the payment mechanism for accessing powerful AI models and agent skills through the OpenClaw platform.

The framework supports a multi-tiered access system based on token holdings, allowing users to unlock different AI models and capabilities depending on their token balance.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DApp Frontend                            │
│  (Wallet Connect · Token Balance · Agent Console · Dark Mode)   │
├─────────────────────────────────────────────────────────────────┤
│                         API Layer                               │
│  (REST Endpoints · Rate Limiting · Token Gate Middleware)        │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│  Model   │  Agent   │  Plugin  │ Browser  │    Platforms        │
│  Router  │  Engine  │   SDK    │  Agent   │  (Lark/TG/Android)  │
├──────────┴──────────┴──────────┴──────────┴─────────────────────┤
│                      Core Services                              │
│  Tavily Search · RHClaw Multimodal · Skill Vetter               │
├─────────────────────────────────────────────────────────────────┤
│                    Solana Gateway                               │
│  (Wallet Adapter · SPL Token · Payment · Token Registry)        │
└─────────────────────────────────────────────────────────────────┘
```

### Supported AI Models

| Model | Provider | Tier | Notes |
|-------|----------|------|-------|
| **GPT-5.4** | OpenAI | Premium | Default flagship model |
| **MiniMax M2.7** | MiniMax | Premium | Integrated multi-modal |
| **Claude Vertex** | Anthropic | Premium | Via Google Vertex AI |
| **Gemini 3 Flash** | Google | Standard | Best cost-performance ratio, 1M context |
| **MiniMax M2.1** | MiniMax | Standard | Outperforms M2.5 in reasoning |
| **Kimi K2.5** | Moonshot | Standard | Strong Chinese language support |
| **MiniMax M2.5** | MiniMax | Standard | Available but M2.1 recommended |

> **Note:** MiniMax M2.1 outperforms M2.5 in reasoning and instruction following. M2.1 is recommended over M2.5 for most use cases.

### Token Tiers

| Tier | Min Tokens | Daily Calls | Models | Skills |
|------|-----------|-------------|--------|--------|
| **Basic** | 1,000 | 50 | Gemini 3 Flash, M2.1 | Search, Browser |
| **Standard** | 10,000 | 500 | + M2.7, Kimi K2.5 | + Code, Data |
| **Premium** | 100,000 | 5,000 | All models (GPT-5.4) | All skills |

### Packages

| Package | Description |
|---------|-------------|
| `@gleam-openclaw/solana-gateway` | Solana wallet integration, SPL token operations, payment gateway |
| `@gleam-openclaw/model-router` | Unified AI model router with load balancing and failover |
| `@gleam-openclaw/core` | Agent engine, task orchestration, checkpoint/resume, token gate |
| `@gleam-openclaw/plugin-sdk` | Plugin discovery, installation, and skill mapping |
| `@gleam-openclaw/browser-agent` | Browser automation via userDataDir (Brave/Edge/Chrome) |
| `@gleam-openclaw/agent-browser` | AI-native browser with visual anchoring and anti-crawler |
| `@gleam-openclaw/tavily-search` | AI-native web search with structured summaries |
| `@gleam-openclaw/rhclaw` | Multi-modal execution (image/audio/video/speech) |
| `@gleam-openclaw/skill-vetter` | Skill validation, auditing, and quality assurance |
| `@gleam-openclaw/platforms` | Android dark mode, Lark cards, Telegram, conversation compression |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Gleamsol/gleam-openclaw-framework.git
cd gleam-openclaw-framework

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and Solana RPC URL

# Start development
pnpm dev

# Build all packages
pnpm build
```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# Or build and start
docker-compose up --build -d
```

### Environment Variables

```env
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
GLEAM_TOKEN_MINT=<your-token-mint-address>

# AI Models
OPENAI_API_KEY=sk-...
MINIMAX_API_KEY=...
GOOGLE_AI_API_KEY=...
MOONSHOT_API_KEY=...
ANTHROPIC_API_KEY=...

# Services
TAVILY_API_KEY=tvly-...
JWT_SECRET=<your-secret>

# Platforms
TELEGRAM_BOT_TOKEN=...
LARK_APP_ID=...
LARK_APP_SECRET=...
```

### Key Features

**AI Model Layer**
- GPT-5.4 as default flagship model
- MiniMax M2.7 integration
- Anthropic Vertex access
- Multi-model unified router with load balancing, failover, and cost optimization

**Platform Features**
- Android dark mode adaptation
- Lark (Feishu) interactive cards
- Telegram topic auto-naming
- Long conversation compression mechanism

**Plugin SDK**
- `@gleam-openclaw/plugin-sdk` module
- Claude/Codex/Cursor plugin discovery and installation
- Automatic mapping from external plugins to OpenClaw skills

**Browser & Agent**
- Connect to Brave/Edge via userDataDir
- Agent default timeout raised to 48 hours
- Task checkpoint and resume support

**Tavily Search (AI-Native Search)**
- Real-time web search optimized for AI interaction
- Structured summaries with trusted source attribution
- No ad interference, eliminates LLM hallucinations

**AgentBrowser (Browser Automation)**
- Visual anchor recognition
- Headless mode (HeadlessMode)
- Anti-crawler penetration
- 93% token consumption reduction

**RHClaw (Multi-Modal Executor)**
- Image, audio, video full-stack creation
- Unified multi-modal capabilities
- Ends skill fragmentation era

**Skill Vetter**
- Safety, quality, and performance validation
- Security auditing
- Compatibility checking

---

## 中文

### 概述

**Gleam OpenClaw API Solana** 是一个综合性开源框架，将 Solana 区块链生态系统与 AI Agent 能力相结合。开发者可以构建使用 Solana MEME 代币作为支付机制来访问强大 AI 模型和 Agent 技能的应用程序。

该框架支持基于代币持有量的多层级访问系统，用户可以根据其代币余额解锁不同的 AI 模型和功能。

### 支持的 AI 模型

| 模型 | 提供商 | 层级 | 备注 |
|------|--------|------|------|
| **GPT-5.4** | OpenAI | 高级 | 默认旗舰模型 |
| **MiniMax M2.7** | MiniMax | 高级 | 集成多模态 |
| **Claude Vertex** | Anthropic | 高级 | 通过 Google Vertex AI |
| **Gemini 3 Flash** | Google | 标准 | 最佳性价比，100万上下文 |
| **MiniMax M2.1** | MiniMax | 标准 | 推理能力优于 M2.5 |
| **Kimi K2.5** | Moonshot | 标准 | 强大的中文支持 |

> **注意：** MiniMax M2.1 在推理和指令遵循方面的表现优于 M2.5。大多数场景推荐使用 M2.1 而非 M2.5。

### 代币层级

| 层级 | 最低持币量 | 每日调用 | 可用模型 | 可用技能 |
|------|-----------|---------|---------|---------|
| **基础** | 1,000 | 50 | Gemini 3 Flash, M2.1 | 搜索、浏览器 |
| **标准** | 10,000 | 500 | + M2.7, Kimi K2.5 | + 代码、数据 |
| **高级** | 100,000 | 5,000 | 所有模型 (GPT-5.4) | 所有技能 |

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/Gleamsol/gleam-openclaw-framework.git
cd gleam-openclaw-framework

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API 密钥和 Solana RPC URL

# 启动开发
pnpm dev

# 构建所有包
pnpm build
```

### Docker 部署

```bash
# 启动所有服务
docker-compose up -d
```

### 核心功能

**AI 模型层**
- GPT-5.4 默认上位
- MiniMax M2.7 整合
- Anthropic Vertex 接入
- 多模型统一路由器（负载均衡、故障转移、成本优化）

**平台功能**
- Android 深色模式适配
- 飞书交互卡片
- Telegram 话题自动命名
- 长对话压缩机制

**Plugin SDK**
- 全新 `@gleam-openclaw/plugin-sdk` 模块
- Claude/Codex/Cursor 插件包发现与安装
- 外部插件到 OpenClaw 技能的自动映射

**浏览器与 Agent**
- 通过 userDataDir 直连 Brave/Edge 等浏览器
- Agent 默认超时时间提升至 48 小时
- 支持任务检查点与断点续传

**Tavily Search（AI 原生检索）**
- 专为 AI 交互优化的实时联网搜索工具
- 输出结构化摘要，来源可信标注，无广告干扰
- 终结大模型"幻觉"

**AgentBrowser（浏览器自动化）**
- 视觉锚点识别
- 无头操控（HeadlessMode）
- 反爬虫穿透
- 减少 93% 的 Token 消耗

**RHClaw（多模态执行官）**
- 图片、音视频全栈创作
- 统一多模态能力
- 终结 Skill 碎片化时代

**Skill Vetter**
- 安全性、质量和性能验证
- 安全审计
- 兼容性检查

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
