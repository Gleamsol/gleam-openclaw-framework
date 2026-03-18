# Architecture Overview

## System Architecture

The Gleam OpenClaw API Solana framework follows a layered monorepo architecture with clear separation of concerns. Each layer communicates through well-defined interfaces, enabling independent development, testing, and deployment of individual modules.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                             │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐ │
│  │   DApp Frontend  │  │            API Server                    │ │
│  │  (React + Vite)  │  │  (Express + REST + Rate Limiting)        │ │
│  └──────────────────┘  └──────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      Orchestration Layer                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Agent Engine │  │  Token Gate  │  │  Conversation Compressor │  │
│  │ (ReAct Loop) │  │  (Access)    │  │  (Context Management)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                       Capability Layer                              │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   Model    │ │  Plugin    │ │  Skill   │ │    Platforms     │  │
│  │   Router   │ │    SDK     │ │  Vetter  │ │ (Lark/TG/Android)│  │
│  └────────────┘ └────────────┘ └──────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Skill Layer                                  │
│                                                                     │
│  ┌────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Tavily    │ │    Agent     │ │  Browser │ │    RHClaw      │  │
│  │  Search    │ │   Browser    │ │  Agent   │ │  (Multimodal)  │  │
│  └────────────┘ └──────────────┘ └──────────┘ └────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      Blockchain Layer                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Solana Gateway                             │   │
│  │  Wallet Adapter · SPL Token · Payment · Token Registry       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Token-Gated API Access Flow

The token-gated access system follows a three-step verification process. First, the user connects their Solana wallet to the DApp, which queries the blockchain for their GLEAM token balance. Second, the Token Gate Guard determines the user's access tier based on their holdings and generates a time-limited credential. Third, the credential is attached to all subsequent API requests, where the server validates it before routing to the Agent Engine.

```
User Wallet → DApp → Solana RPC (balance check) → Token Gate Guard
    → Credential Generation → API Request with Credential
    → Server Validation → Agent Engine Execution
```

### Agent Task Execution Flow

When a task is submitted, the Agent Engine enters a ReAct (Reasoning + Acting) loop. The engine calls the selected AI model through the Unified Model Router, which handles provider selection, load balancing, and failover. If the model response includes tool calls, the engine dispatches them to the appropriate skills (Tavily Search, AgentBrowser, RHClaw, etc.) and feeds the results back into the conversation. This loop continues until the model produces a final response or the task reaches its step limit or timeout.

Checkpoints are saved at configurable intervals, enabling task resumption after interruptions. The default timeout is 48 hours, supporting long-running autonomous tasks.

## Package Dependency Graph

```
@gleam-openclaw/api
  ├── @gleam-openclaw/core
  │     └── @gleam-openclaw/model-router
  ├── @gleam-openclaw/model-router
  └── @gleam-openclaw/solana-gateway

@gleam-openclaw/dapp
  └── (standalone React app)

@gleam-openclaw/agent-browser
  └── @gleam-openclaw/browser-agent

@gleam-openclaw/rhclaw
  └── @gleam-openclaw/model-router

@gleam-openclaw/platforms
  └── @gleam-openclaw/model-router

@gleam-openclaw/plugin-sdk (standalone)
@gleam-openclaw/tavily-search (standalone)
@gleam-openclaw/skill-vetter (standalone)
@gleam-openclaw/browser-agent (standalone)
```

## Model Router Strategy

The Unified Model Router implements a sophisticated selection strategy. When a request specifies a model, the router uses that model directly. When no model is specified, the router selects the best available model based on a weighted scoring algorithm that considers the model's priority rating, current availability, estimated latency, and cost per token.

The router also implements automatic failover. If the primary model fails, the router retries with the next highest-priority model of the same tier, ensuring high availability. All model calls are tracked for usage analytics and cost optimization.

## Security Model

The framework implements defense in depth through multiple security layers. The Solana-based token gate provides the first layer of access control, ensuring only token holders can access the API. The credential system uses HMAC-based signatures with 24-hour expiration, preventing replay attacks. The API server adds rate limiting, CORS protection, and input validation via Zod schemas. The Skill Vetter provides an additional safety layer by auditing all agent skills for dangerous patterns before deployment.
