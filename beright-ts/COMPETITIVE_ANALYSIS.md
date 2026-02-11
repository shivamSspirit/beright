# BeRight Protocol - Competitive Analysis Report

> Comprehensive Analysis of Colosseum Agent Hackathon Projects & Winning Architecture Design

**Date:** February 9, 2026
**Hackathon Status:** Ongoing (Feb 2-12, 2026) - 515 projects submitted
**Analysis Scope:** Technical architecture, competitive positioning, winning strategies

---

## 1. Overview

### 1.1 Market Context

The Colosseum Agent Hackathon represents the frontier of autonomous AI agents on Solana, with **515 projects** competing for $100,000 in prizes. This analysis examines the strongest patterns emerging across categories:

| Category | # Projects | Key Theme |
|----------|------------|-----------|
| **Trading/DeFi Agents** | ~120 | Autonomous execution, MEV, arbitrage |
| **Infrastructure** | ~80 | Identity, trust, memory, coordination |
| **Prediction Markets** | ~40 | Aggregation, arbitrage, forecasting |
| **Social/Creative** | ~60 | Agent networks, content, games |
| **Security** | ~30 | Threat detection, auditing, compliance |
| **Developer Tools** | ~50 | SDKs, frameworks, integrations |

### 1.2 BeRight's Position

BeRight is a **prediction market intelligence terminal** targeting the intersection of:
- Prediction market aggregation (Polymarket, Kalshi, Manifold)
- Superforecaster methodology (Tetlock-style calibration)
- Multi-channel AI agent (Telegram, Web, future: Discord)
- Gamification (leaderboards, Brier scoring, streaks)

**Direct Competitors:** Clodds, Predly, Prediction Hunt, ArbBets, Oddpool

---

## 2. Project-by-Project Deep Dive

### 2.1 TIER 1: Direct Competitors (Prediction Markets)

#### **Clodds** ⭐⭐⭐⭐⭐
*AI Trading Terminal for Prediction Markets*

**Core Idea:** Personal AI trading terminal supporting prediction markets, crypto spot, and perpetual futures with leverage. "Claude + Odds = Clodds"

**Technical Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    CLODDS ARCHITECTURE                   │
├─────────────────────────────────────────────────────────┤
│  CHANNELS (22 platforms)                                 │
│  Telegram, Discord, Slack, WhatsApp, Teams, Signal...   │
├─────────────────────────────────────────────────────────┤
│  CORE ENGINE                                             │
│  • Claude-powered reasoning                              │
│  • Arbitrage detection (arXiv:2508.03474 based)         │
│  • Risk management module                                │
│  • Order execution layer                                 │
├─────────────────────────────────────────────────────────┤
│  MARKET CONNECTORS (9 platforms, 700+ markets)          │
│  Polymarket, Kalshi, Binance, Hyperliquid, Solana DEXs │
├─────────────────────────────────────────────────────────┤
│  AGENT COMMERCE PROTOCOL                                 │
│  Machine-to-machine payments for compute/execution       │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- 22 messaging platforms (massive distribution)
- 700+ markets across 9 platforms (comprehensive coverage)
- Agent commerce protocol (future-proof for agent economy)
- Self-hosted (privacy, control)

**Weaknesses:**
- Complex setup (self-hosted requirement)
- No calibration/forecasting methodology
- No gamification layer

**Differentiators:**
- Academic arbitrage research integration (arXiv paper)
- Compute API for agent-to-agent payments
- Multi-chain execution (EVM + Solana)

---

#### **Predly** ⭐⭐⭐⭐
*AI-Powered Prediction Market Analytics*

**Core Idea:** Detects mispricings between market prices and AI-calculated probabilities with 89% alert accuracy.

**Technical Architecture:**
- AI probability models trained on historical resolution data
- Cross-platform price comparison (Polymarket, Kalshi)
- Alert system with confidence scoring
- Web dashboard + API

**Strengths:**
- High accuracy (89% claimed)
- AI-driven edge detection (not just price arbitrage)
- Clean UX for retail traders

**Weaknesses:**
- No execution capability (alerts only)
- No multi-channel presence (web only)
- No social/gamification features

**Differentiators:**
- AI probability modeling vs. pure price arbitrage
- Calibrated confidence intervals

---

#### **Prediction Hunt** ⭐⭐⭐⭐
*Prediction Market Aggregator*

**Core Idea:** Real-time cross-exchange comparison with smart matching across Kalshi, Polymarket, PredictIt.

**Technical Architecture:**
- 5-minute data refresh cycles
- Text similarity matching for cross-platform market pairing
- Arbitrage detection algorithm
- Web interface with filtering

**Strengths:**
- Multi-platform coverage including PredictIt
- Market matching AI (handles different market phrasings)
- Free tier available

**Weaknesses:**
- 5-minute refresh (not real-time)
- No AI analysis/forecasting
- No execution

**Differentiators:**
- Smart matching algorithm for similar markets
- Historical price tracking

---

### 2.2 TIER 1: Infrastructure Leaders

#### **SOLPRISM** ⭐⭐⭐⭐⭐
*Verifiable AI Reasoning On-Chain*

**Core Idea:** Every AI agent commits cryptographic proof of reasoning on-chain BEFORE acting, enabling trust and auditability.

**Technical Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    SOLPRISM PROTOCOL                     │
├─────────────────────────────────────────────────────────┤
│  SDK (@solprism/sdk)                                     │
│  5 Core Functions: register, commit, reveal, verify,    │
│  getAgent                                                │
├─────────────────────────────────────────────────────────┤
│  FRAMEWORK INTEGRATIONS                                  │
│  • Eliza Plugin (4 actions)                             │
│  • solana-agent-kit (3 modes)                           │
│  • MCP Server (5 tools for Claude)                      │
├─────────────────────────────────────────────────────────┤
│  PROOF MECHANISM                                         │
│  1. Agent commits hash(reasoning) on-chain              │
│  2. Agent acts                                          │
│  3. Agent reveals reasoning                             │
│  4. Anyone can verify: hash matches                     │
├─────────────────────────────────────────────────────────┤
│  EXPLORER (solprism.app)                                │
│  Browse agents, commitments, verify proofs              │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- Novel trust primitive (no competitor has this)
- Framework-agnostic (works with Eliza, solana-agent-kit, MCP)
- 30-minute integration time
- Already has external integrations (Vectix-Agent)

**Weaknesses:**
- Adds latency (commit before act)
- Gas costs for every decision
- Limited to agents that want transparency

**Differentiators:**
- First verifiable AI reasoning layer on any blockchain
- Token launch used the protocol itself (dogfooding)

---

#### **Solana Agent Kit v2** ⭐⭐⭐⭐⭐
*The Standard AI-Solana Development Kit*

**Core Idea:** Modular, plugin-based toolkit giving AI agents native access to Solana DeFi with safety guardrails.

**Technical Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│              SOLANA AGENT KIT V2 ARCHITECTURE            │
├─────────────────────────────────────────────────────────┤
│  CORE RUNTIME                                            │
│  • Embedded wallet support (Privy/Turnkey)              │
│  • Transaction simulation before execution               │
│  • Human-in-the-loop confirmation                       │
│  • Fine-grained policy rules                            │
├─────────────────────────────────────────────────────────┤
│  PLUGIN MODULES (Official)                               │
│  @plugin-token: Transfer, swap, bridge, rug-check       │
│  @plugin-nft: Mint, list, metadata                      │
│  @plugin-defi: Stake, lend, borrow, perps               │
│  @plugin-misc: Airdrops, prices, domains                │
│  @plugin-blinks: Arcade, social                         │
├─────────────────────────────────────────────────────────┤
│  FRAMEWORK INTEGRATIONS                                  │
│  LangChain, Vercel AI SDK, LangGraph (multi-agent)      │
├─────────────────────────────────────────────────────────┤
│  60+ SOLANA ACTIONS                                      │
│  Jupiter swaps, Kamino lending, Marginfi, Jito tips...  │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- Industry standard (most agents use this)
- 60+ pre-built actions
- Safety-first design (simulation, guardrails)
- Multi-agent examples with LangGraph

**Weaknesses:**
- Solana-only (no EVM)
- Plugin ecosystem fragmented
- Some modules still experimental

**Differentiators:**
- Most comprehensive Solana action coverage
- Human-in-the-loop native support
- Open-source community

---

#### **ElizaOS (ai16z)** ⭐⭐⭐⭐⭐
*The Operating System for AI Agents*

**Core Idea:** Open-source TypeScript framework for building autonomous AI agents with persistent personalities, memory, and multi-platform presence.

**Technical Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    ELIZAOS ARCHITECTURE                  │
├─────────────────────────────────────────────────────────┤
│  AGENT CORE                                              │
│  • Character files (personality, voice, goals)          │
│  • Memory system (short-term + long-term)               │
│  • Action/Provider/Evaluator pattern                    │
│  • Plugin loading system                                │
├─────────────────────────────────────────────────────────┤
│  PLUGINS (90+)                                           │
│  Discord, Twitter/X, Telegram, Solana, Ethereum...      │
├─────────────────────────────────────────────────────────┤
│  SOLANA PLUGIN                                           │
│  • Built-in wallet management                           │
│  • Trust scoring system                                 │
│  • Transaction execution                                │
├─────────────────────────────────────────────────────────┤
│  AUTO.FUN (No-code launchpad)                           │
│  Create agents without coding                           │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- Largest agent framework ecosystem
- 90+ plugins (massive connectivity)
- Trust scoring built-in
- Token ($elizaOS) for ecosystem

**Weaknesses:**
- Complex to customize deeply
- v1 to v2 migration pains
- Token economics can distract from utility

**Differentiators:**
- Agent-to-agent interactions native
- Character file system (personality as code)
- Largest community (forks, extensions)

---

### 2.3 TIER 1: Trading/DeFi Agents

#### **SIDEX** ⭐⭐⭐⭐
*Autonomous AI Trading Agent for Crypto Futures*

**Core Idea:** Local Llama 3 model for perpetuals trading on Solana - fully autonomous, privacy-preserving.

**Technical Architecture:**
- Local LLM (Llama 3) - no API calls
- Perpetuals trading via Drift/Zeta
- Risk management with position sizing
- Backtesting module

**Strengths:**
- Privacy (local model)
- No API costs
- Full autonomy

**Weaknesses:**
- Requires powerful hardware
- Limited to perps (not prediction markets)
- Single-chain

**Differentiators:**
- First local LLM trading agent on Solana
- Zero cloud dependency

---

#### **DeFi Risk Guardian** ⭐⭐⭐⭐
*Autonomous Lending Protocol Monitor*

**Core Idea:** Monitors positions across Kamino, Marginfi, Solend with autonomous risk classification and mitigation simulation.

**Technical Architecture:**
- Real-time position monitoring
- Risk scoring (health factor, liquidation distance)
- Simulation engine for mitigation actions
- Alert system (Telegram/Discord)

**Strengths:**
- Multi-protocol coverage
- Proactive risk detection
- Simulation before action

**Weaknesses:**
- DeFi-only (not prediction markets)
- Complex integration per protocol

**Differentiators:**
- First autonomous DeFi risk manager
- Simulation-first approach

---

#### **Super Router** ⭐⭐⭐⭐
*Multi-Agent Solana Trading Infrastructure*

**Core Idea:** On-chain leaderboard with epoch-based rewards for autonomous trading agents - gamified agent competition.

**Technical Architecture:**
- Agent registry (on-chain)
- Performance tracking (PnL, Sharpe, drawdown)
- Epoch-based reward distribution
- Leaderboard with staking

**Strengths:**
- Gamification for agents (novel)
- Performance accountability
- Economic incentives aligned

**Weaknesses:**
- Cold start problem (need agents to join)
- Gaming risk (wash trading)

**Differentiators:**
- First gamified agent competition protocol
- On-chain performance verification

---

### 2.4 TIER 1: Trust & Identity

#### **SAID Protocol** ⭐⭐⭐⭐
*Verifiable Identity for AI Agents*

**Core Idea:** One-command agent creation with reputation scoring and trust tier verification.

**Technical Architecture:**
- Agent registry (DID-like)
- Reputation scoring based on history
- Trust tiers (unverified → verified → trusted)
- API for identity verification

**Strengths:**
- Simple onboarding (one command)
- Progressive trust building
- Cross-platform identity

**Weaknesses:**
- Chicken-egg (agents need to adopt)
- Reputation gaming possible

**Differentiators:**
- First agent identity standard on Solana
- Trust tier system

---

#### **KAMIYO Protocol** ⭐⭐⭐⭐⭐
*Production Trust Infrastructure for Agent Commerce*

**Core Idea:** Escrow, ZK reputation, and multi-oracle dispute resolution for agent-to-agent transactions.

**Technical Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    KAMIYO PROTOCOL                       │
├─────────────────────────────────────────────────────────┤
│  ESCROW LAYER                                            │
│  • Multi-sig escrow for agent commerce                  │
│  • Milestone-based release                              │
│  • Timeout protection                                   │
├─────────────────────────────────────────────────────────┤
│  ZK REPUTATION                                           │
│  • Prove reputation without revealing history           │
│  • Sybil resistance                                     │
├─────────────────────────────────────────────────────────┤
│  DISPUTE RESOLUTION                                      │
│  • Multi-oracle consensus                               │
│  • Stake-weighted voting                                │
│  • Appeal mechanism                                     │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- Complete commerce stack
- ZK privacy for reputation
- Dispute resolution (critical for real commerce)

**Weaknesses:**
- Complex to integrate
- Requires ecosystem adoption

**Differentiators:**
- Most complete agent commerce infrastructure
- ZK reputation (unique)

---

### 2.5 TIER 2: Notable Projects

| Project | Core Idea | Strength | Weakness |
|---------|-----------|----------|----------|
| **AgentTrace Protocol** | Shared memory layer for agents to learn from each other | Cross-agent learning | Privacy concerns |
| **GUARDIAN** | 17-agent security swarm | Comprehensive protection | Resource intensive |
| **AuditSwarm** | Compliance automation (150+ jurisdictions) | Regulatory coverage | Niche market |
| **Makora** | Privacy-preserving DeFi with ZK | Privacy focus | Complex UX |
| **Tuna Agent Launchpad** | Agent-only token launches | Novel mechanism | Speculative |
| **AION SDK** | TypeScript agent toolkit | Developer friendly | Competing with SAK |
| **Oods** | 24-hour prediction markets for token launches | Fair price discovery | Untested model |

---

## 3. Comparative Analysis

### 3.1 BeRight vs. Competitors Matrix

| Feature | BeRight | Clodds | Predly | Prediction Hunt | SOLPRISM |
|---------|---------|--------|--------|-----------------|----------|
| **Prediction Market Aggregation** | ✅ 3 platforms | ✅ 2+ | ✅ 2 | ✅ 3 | ❌ |
| **Arbitrage Detection** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **AI Forecasting** | ✅ Superforecaster | ❌ | ✅ AI probability | ❌ | ❌ |
| **Multi-Channel (Telegram/Discord)** | ✅ OpenClaw | ✅ 22 platforms | ❌ Web only | ❌ Web only | ❌ |
| **Trade Execution** | 🔨 Planned | ✅ | ❌ | ❌ | ❌ |
| **Calibration/Brier Scoring** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Gamification (Leaderboard)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Whale Tracking** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **On-Chain Verification** | 🔨 Planned | ❌ | ❌ | ❌ | ✅ Core |
| **Self-Hosted** | ✅ OpenClaw | ✅ | ❌ | ❌ | N/A |

### 3.2 BeRight's Unique Position

**Where BeRight is UNIQUE:**
1. **Superforecaster methodology** - No competitor uses Tetlock's calibration framework
2. **Brier score tracking** - Only platform measuring prediction accuracy over time
3. **Gamification layer** - Leaderboards, streaks, achievements (retail engagement)
4. **Whale tracking integration** - Polymarket whale signals + prediction markets
5. **OpenClaw multi-agent skills** - Scout/Analyst/Trader specialization

**Where BeRight is SIMILAR:**
1. Multi-platform aggregation (Clodds, Prediction Hunt have this)
2. Arbitrage detection (Clodds is more comprehensive)
3. Telegram bot interface (Clodds has 22 platforms)

**Where BeRight is BEHIND:**
1. Trade execution - Clodds can execute, BeRight is quotes only
2. Platform coverage - Clodds has 700+ markets vs BeRight's ~100
3. On-chain verification - SOLPRISM has a novel trust layer

### 3.3 Architectural Patterns Emerging as Winners

| Pattern | Projects Using | Why It Wins |
|---------|---------------|-------------|
| **Modular Plugin Architecture** | Solana Agent Kit, ElizaOS | Extensibility without core changes |
| **Skill-Based Routing** | OpenClaw, Clodds | Specialized agents for specific tasks |
| **Simulation-First Execution** | DeFi Risk Guardian, Super Router | Safety before action |
| **On-Chain Commitment** | SOLPRISM, KAMIYO | Trust and accountability |
| **Human-in-the-Loop** | Solana Agent Kit v2 | Safety for high-stakes decisions |
| **Multi-Agent Coordination** | GUARDIAN, ClaudeCraft | Parallelism and specialization |

---

## 4. Winning Architecture Proposal for BeRight

### 4.1 Architecture Vision

Combining the best patterns from the competitive landscape:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BERIGHT WINNING ARCHITECTURE                              │
│                    "Prediction Intelligence OS"                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   USER LAYER    │
                              │                 │
                              │  Telegram  Web  │
                              │  Discord   API  │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENCLAW GATEWAY                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Channel   │  │   Session   │  │    Cron     │  │    Auth     │        │
│  │   Router    │  │   Manager   │  │   Scheduler │  │   Manager   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT ORCHESTRATOR                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      SKILL ROUTER (Intent Detection)                    ││
│  │  "What arb?" → Scout  │  "Research BTC" → Analyst  │  "Buy YES" → Trader││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│         ┌─────────────────────────────┼─────────────────────────────┐       │
│         ▼                             ▼                             ▼       │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐  │
│  │   SCOUT     │              │   ANALYST   │              │   TRADER    │  │
│  │  (Sonnet)   │              │   (Opus)    │              │  (Sonnet)   │  │
│  │             │              │             │              │             │  │
│  │ • Arb scan  │              │ • Research  │              │ • Quotes    │  │
│  │ • Hot mkts  │              │ • Forecast  │              │ • Execute   │  │
│  │ • Compare   │              │ • Base rate │              │ • Portfolio │  │
│  └─────────────┘              └─────────────┘              └─────────────┘  │
│         │                             │                             │       │
│         └─────────────────────────────┼─────────────────────────────┘       │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         TOOL LAYER                                      ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      ││
│  │  │ Markets  │ │ Arbitrage│ │ Research │ │  Whale   │ │  Intel   │      ││
│  │  │  .ts     │ │   .ts    │ │   .ts    │ │   .ts    │ │   .ts    │      ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │     EXTERNAL APIS            │  │     INTERNAL STORAGE         │        │
│  │  ┌────────┐ ┌────────┐      │  │  ┌────────────────────────┐  │        │
│  │  │Polymar-│ │ Kalshi │      │  │  │      SUPABASE          │  │        │
│  │  │  ket   │ │        │      │  │  │  • users               │  │        │
│  │  └────────┘ └────────┘      │  │  │  • predictions         │  │        │
│  │  ┌────────┐ ┌────────┐      │  │  │  • alerts              │  │        │
│  │  │Manifold│ │ Helius │      │  │  │  • leaderboard (view)  │  │        │
│  │  │        │ │(Solana)│      │  │  │  • watchlist           │  │        │
│  │  └────────┘ └────────┘      │  │  └────────────────────────┘  │        │
│  │  ┌────────┐ ┌────────┐      │  │  ┌────────────────────────┐  │        │
│  │  │ News   │ │ Reddit │      │  │  │    UPSTASH REDIS       │  │        │
│  │  │  RSS   │ │  API   │      │  │  │  • rate limiting       │  │        │
│  │  └────────┘ └────────┘      │  │  │  • session cache       │  │        │
│  └──────────────────────────────┘  │  │  • market data cache   │  │        │
│                                     │  └────────────────────────┘  │        │
│                                     └──────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER (Future)                                 │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  SOLPRISM        │  │  JUPITER         │  │  REPUTATION      │          │
│  │  Integration     │  │  Execution       │  │  NFTs            │          │
│  │                  │  │                  │  │                  │          │
│  │  • Commit        │  │  • Token swaps   │  │  • Achievement   │          │
│  │    predictions   │  │  • Best route    │  │    badges        │          │
│  │    on-chain      │  │  • MEV protect   │  │  • Forecaster    │          │
│  │  • Verifiable    │  │                  │  │    rank tokens   │          │
│  │    forecasts     │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Architectural Decisions

#### Decision 1: Skill-Based Multi-Agent (vs. Single Agent)
**Pattern from:** OpenClaw, Clodds
**Rationale:** Specialized agents (Scout=speed, Analyst=depth, Trader=safety) with appropriate model costs (Sonnet for fast tasks, Opus for research)

**Pros:**
- Cost optimization (80% of queries use cheaper Sonnet)
- Better performance per specialization
- Parallel processing possible

**Cons:**
- More complex routing logic
- Cross-agent context sharing challenges

---

#### Decision 2: SOLPRISM Integration for Verifiable Predictions
**Pattern from:** SOLPRISM
**Rationale:** Unique differentiator - commit prediction reasoning on-chain before market resolution for verifiable track record

**Implementation:**
```typescript
// Before making prediction
const commitment = await solprism.commit({
  agentId: 'beright-analyst',
  reasoning: 'Base rate: 65%. Adjustments: +5% for recent news...',
  prediction: { market: 'BTC-100k', probability: 0.72, direction: 'YES' }
});

// After resolution
await solprism.reveal(commitment.id, actualReasoning);
```

**Pros:**
- Verifiable forecaster credentials
- Gaming-resistant leaderboard
- Trust primitive for the platform

**Cons:**
- Adds latency (~2s for on-chain commit)
- Gas costs (~0.001 SOL per prediction)

---

#### Decision 3: Simulation-First Execution
**Pattern from:** DeFi Risk Guardian, Solana Agent Kit v2
**Rationale:** For any trade execution, simulate first, show expected outcome, require confirmation

**Implementation:**
```typescript
// Quote phase (no execution)
const quote = await trader.simulate({
  market: 'KXBTC-26DEC31-T100K',
  direction: 'YES',
  amount: 50
});
// Returns: { input: 50, output: 96 contracts, fees: 0.50, slippage: 0.02 }

// Execution phase (after user confirms)
if (userConfirmed) {
  await trader.execute(quote.id);
}
```

**Pros:**
- User safety (no surprise losses)
- Regulatory compliance (clear disclosures)
- Trust building

**Cons:**
- Slower execution (quote → confirm → execute)
- Price may move between quote and execution

---

#### Decision 4: Calibration-Centric Gamification
**Pattern from:** Superforecasting (Tetlock), Super Router (agent leaderboard)
**Rationale:** Brier score as the core metric, not just accuracy. This rewards well-calibrated probability estimates.

**Implementation:**
```typescript
// Brier Score = (forecast - outcome)²
// Lower is better. Perfect = 0, worst = 1

interface ForecastRecord {
  userId: string;
  prediction: number;      // 0.72 (72% YES)
  direction: 'YES' | 'NO';
  outcome: boolean;        // true = YES won
  brierScore: number;      // calculated on resolution
}

// Leaderboard ranks by avg Brier score, not win rate
```

**Pros:**
- Rewards calibration, not overconfidence
- Aligns with academic forecasting standards
- Creates meaningful differentiation

**Cons:**
- Harder to explain to casual users
- Requires sufficient predictions to be meaningful

---

#### Decision 5: Progressive On-Chain Integration
**Pattern from:** KAMIYO, SAID Protocol
**Rationale:** Start off-chain for speed, add on-chain for trust milestones

**Phase 1 (Current):** Off-chain (Supabase)
- Fast, free, iterable
- All predictions stored in PostgreSQL
- Leaderboard calculated in real-time

**Phase 2 (Q2 2026):** Hybrid
- High-confidence predictions committed via SOLPRISM
- Reputation scores derived from on-chain history
- Optional on-chain verification for power users

**Phase 3 (Q3 2026):** On-Chain Native
- Prediction staking (skin in the game)
- Reputation NFTs (forecaster badges)
- DAO governance for market creation

---

### 4.3 Data Flow Diagrams

#### Flow 1: Arbitrage Scan (/arb)
```
User: /arb bitcoin
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ SKILL ROUTER: Intent = "arbitrage scan" → Route to SCOUT   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ SCOUT AGENT (Sonnet)                                        │
│                                                             │
│ 1. Call arbitrage.ts with query "bitcoin"                   │
│ 2. Parallel fetch:                                          │
│    - Polymarket: GET /markets?query=bitcoin                 │
│    - Kalshi: GET /markets?query=bitcoin                     │
│    - Manifold: GET /markets?query=bitcoin                   │
│ 3. Match markets by similarity (>60% match)                 │
│ 4. Calculate spreads                                        │
│ 5. Filter spreads > 2%                                      │
│ 6. Format response                                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
User receives:
🎯 ARB FOUND: Bitcoin 100k by Dec 2026

🟣 Polymarket: 58% ($2.1M vol)
🔵 Kalshi: 52% ($890K vol)
📊 Spread: 6%

Action: Buy Kalshi YES, sell Polymarket YES
Use /research bitcoin 100k for analysis
```

#### Flow 2: Superforecaster Analysis (/research)
```
User: /research "Will Fed cut rates in March 2026?"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ SKILL ROUTER: Intent = "research" → Route to ANALYST       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ANALYST AGENT (Opus)                                        │
│                                                             │
│ 1. research.ts: Fetch market data                           │
│ 2. intel.ts: Fetch news (Fed, economy, inflation)           │
│ 3. Apply superforecaster framework:                         │
│    a. BASE RATE: Historical Fed decisions                   │
│    b. SPECIFIC FACTORS: Current inflation, employment       │
│    c. KEY UNCERTAINTIES: Geopolitics, banking stress        │
│    d. SYNTHESIS: Combine inside/outside views               │
│ 4. Generate probability estimate with confidence interval   │
│ 5. Compare to market prices                                 │
│ 6. Identify edge (if any)                                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
User receives:
📊 RESEARCH: Fed Rate Cut March 2026

BASE RATE (Outside View)
• Historical March cuts: 35%
• Mid-cycle cuts: 42%
• Adjusted base: 38%

SPECIFIC FACTORS (Inside View)
Bullish: Inflation cooling, unemployment rising
Bearish: Services inflation sticky, Fed rhetoric hawkish

KEY UNCERTAINTIES
1. January CPI print
2. February FOMC statement

MY FORECAST: 45% (±8%)

Market prices: Poly 52%, Kalshi 48%
Edge: Slight overpricing on Polymarket
```

---

### 4.4 Technology Stack (Justified)

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Agent Runtime** | OpenClaw Gateway | Multi-channel (Telegram, Discord, WhatsApp), cron, sessions - already battle-tested |
| **Primary LLM** | Claude Sonnet 4 | Best cost/performance for fast tasks (Scout, Trader) |
| **Research LLM** | Claude Opus 4.5 | Best reasoning for complex analysis (Analyst) |
| **Database** | Supabase (PostgreSQL) | Free tier, real-time, Row Level Security, already integrated |
| **Cache** | Upstash Redis | Serverless, rate limiting, already integrated |
| **Auth** | Privy | Web3 wallet + social login, already integrated |
| **Frontend** | Next.js 14 | SSR, API routes, Vercel deployment |
| **On-Chain** | Solana + SOLPRISM | Verifiable predictions, Jupiter for swaps |
| **Whale Tracking** | Helius | Best Solana RPC with webhooks |

---

## 5. Recommendations & Next Steps

### 5.1 Immediate Actions (This Week)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add `/predict` command with Brier tracking | 4h | Core differentiator |
| **P0** | Add `/me` command (user stats) | 2h | Engagement |
| **P0** | Add `/leaderboard` command | 2h | Gamification |
| **P1** | Expand platform coverage (add Metaculus) | 4h | More markets |
| **P1** | Improve market matching algorithm | 4h | Better arb detection |

### 5.2 Short-Term (Next 2 Weeks)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | SOLPRISM integration (commit predictions on-chain) | 8h | Unique differentiator |
| **P1** | Trade execution via Jupiter/Kalshi | 12h | Revenue opportunity |
| **P1** | Web dashboard live charts | 8h | Retail appeal |
| **P2** | Discord channel integration | 4h | Distribution |

### 5.3 Medium-Term (Next Month)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Prediction staking (SOL/USDC) | 20h | Skin in the game |
| **P1** | Reputation NFTs | 12h | Status signaling |
| **P1** | Agent commerce (pay for research) | 16h | Revenue model |
| **P2** | Mobile app (React Native) | 40h | Distribution |

### 5.4 Competitive Moats to Build

1. **Verifiable Forecasting** - SOLPRISM integration makes BeRight the only platform with on-chain proof of predictions
2. **Calibration Database** - Accumulated Brier scores create network effects (more data = better calibration)
3. **Superforecaster Methodology** - Academic rigor differentiates from pure arbitrage bots
4. **Multi-Agent Specialization** - Scout/Analyst/Trader provides better UX than monolithic agents

---

## 6. Sources

- [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/)
- [SOLPRISM Explorer](https://www.solprism.app/)
- [Solana Agent Kit Documentation](https://docs.sendai.fun/docs/v2/introduction)
- [ElizaOS on Solana Compass](https://solanacompass.com/projects/elizaos)
- [Clodds Bot GitHub](https://github.com/alsk1992/CloddsBot)
- [Awesome Prediction Market Tools](https://github.com/aarora4/Awesome-Prediction-Market-Tools)
- [Polymarket Ecosystem Guide](https://defiprime.com/definitive-guide-to-the-polymarket-ecosystem)
- [OpenClaw Documentation](https://docs.openclaw.ai/)

---

*Report generated by BeRight Analyst Agent*
*Last updated: February 9, 2026*
