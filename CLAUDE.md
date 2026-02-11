# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is a prediction market intelligence terminal with an autonomous AI agent platform. The flagship product is **BeRight Protocol** - a superforecaster-style prediction market analyzer that runs 24/7 via autonomous agents.

This is a Turbo monorepo with two workspaces:
- `beright-ts` - Backend API + AI agents (Next.js 14, port 3001)
- `berightweb` - Frontend web dashboard (Next.js 16, port 3000)

## Commands

```bash
# Development (runs both workspaces)
npm run dev

# Run workspaces individually
npm run dev:api    # Backend only (port 3001)
npm run dev:web    # Frontend only (port 3000)

# Build and lint
npm run build
npm run lint

# Run specific skills directly
npx ts-node beright-ts/skills/markets.ts search "bitcoin"
npx ts-node beright-ts/skills/arbitrage.ts "fed rate"
npx ts-node beright-ts/skills/research.ts "trump 2028"
npx ts-node beright-ts/skills/whale.ts scan
npx ts-node beright-ts/skills/intel.ts news "crypto"
npx ts-node beright-ts/skills/heartbeat.ts once

# Run heartbeat loop (5 min intervals)
npx ts-node beright-ts/skills/heartbeat.ts loop 300

# OpenClaw gateway deployment
npm run gateway

# Telegram bot
npm run telegram

# Test (runs market search)
cd beright-ts && npm test
```

## Architecture

### Skill-Based System

All skills return a consistent response format:
```typescript
interface SkillResponse {
  text: string;        // Markdown response
  mood?: Mood;         // BULLISH | BEARISH | NEUTRAL | ALERT | EDUCATIONAL | ERROR
  data?: unknown;      // Structured data for further processing
  voice?: string;
  sticker?: string;
}
```

### Backend Structure (`beright-ts/`)

```
skills/
├── telegramHandler.ts   # Main router (30+ commands)
├── markets.ts           # Unified market data (5 platforms)
├── arbitrage.ts         # Cross-platform arb detection
├── research.ts          # Superforecaster analysis
├── whale.ts             # Solana wallet monitoring
├── intel.ts             # News RSS + sentiment
├── heartbeat.ts         # Autonomous 5-min loop
├── calibration.ts       # Brier score tracking
├── brief.ts             # Market summaries
└── analyst/, trader/, scout/  # Sub-agents

lib/
├── kalshi.ts            # RSA-authenticated Kalshi client
├── onchain/             # Solana Memo verification
│   ├── memo.ts          # Format: BERIGHT:PREDICT:v1|...
│   ├── commit.ts        # Prediction commits
│   └── verify.ts        # Verification
├── supabase/
│   ├── client.ts        # Database connection
│   └── schema.sql       # Tables: users, predictions, alerts, etc.
└── agentSpawner.ts      # Multi-agent coordination

config/
├── agents.ts            # Agent definitions (Scout/Analyst/Trader)
├── platforms.ts         # API endpoints + RSS feeds
├── commands.ts          # Telegram command registry
└── thresholds.ts        # Trading limits

app/api/                 # REST endpoints
├── markets/route.ts     # GET /api/markets
├── research/route.ts    # GET/POST /api/research
├── arbitrage/route.ts   # GET /api/arbitrage
├── whale/route.ts       # GET/POST /api/whale
├── leaderboard/route.ts # GET /api/leaderboard
└── ...

memory/                  # File-based state (fallback)
├── positions.json
├── watchlist.json
├── whales.json
└── heartbeat-state.json
```

### Frontend Structure (`berightweb/`)

```
src/
├── app/
│   ├── page.tsx         # Home with CardStack
│   ├── forecaster/      # Forecasting tools
│   ├── markets/         # Market browser
│   ├── leaderboard/     # Rankings
│   └── profile/         # User profile
├── components/
│   ├── CardStack.tsx    # Swipeable market cards
│   ├── SwipeCard.tsx    # Individual cards
│   ├── ConsensusView.tsx# Price visualization
│   └── AIDebateModal.tsx# AI debate UI
└── lib/
    ├── api.ts           # API client
    └── supabase.ts      # Supabase client
```

### Platform Abstraction

Unified interface for 5 prediction markets:
- **Polymarket** - gamma-api
- **Kalshi/DFlow** - RSA-authenticated
- **Manifold** - play money
- **Limitless** - crypto-native
- **Metaculus** - forecasting community

### On-Chain Verification

Predictions committed to Solana Memo Program:
```
Format: BERIGHT:PREDICT:v1|user_pubkey|market_id|probability|direction|timestamp|hash
```

### Multi-Agent System

- **Orchestrator**: Main coordinator (Claude Opus 4.5)
- **Scout Agent**: Fast market scanning (Sonnet)
- **Analyst Agent**: Deep research (Opus)
- **Trader Agent**: Trade execution (Sonnet)

80% of queries use Sonnet for cost optimization; Opus reserved for deep analysis.

## Key Files

| Purpose | Location |
|---------|----------|
| Command router | `beright-ts/skills/telegramHandler.ts` |
| Market aggregation | `beright-ts/skills/markets.ts` |
| Agent config | `beright-ts/config/agents.ts` |
| Platform APIs | `beright-ts/config/platforms.ts` |
| Database types | `beright-ts/lib/supabase/types.ts` |
| API proxy config | `berightweb/next.config.ts` |
| Frontend API client | `berightweb/src/lib/api.ts` |

## Data Flow

```
Telegram Bot / Web UI
        │
        ▼
telegramHandler.ts / API routes
        │
        ├──▶ skills/* (markets, research, arbitrage, etc.)
        │
        ├──▶ lib/supabase/client.ts (persistence)
        │
        ├──▶ lib/onchain/* (Solana verification)
        │
        └──▶ lib/agentSpawner.ts (multi-agent delegation)
```

Frontend proxies `/api/*` to backend via `next.config.ts`.

## Environment Variables

Copy `.env.example` to `.env`:

**Required:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (e.g., `http://localhost:3001`)
- `TELEGRAM_BOT_TOKEN`
- `ANTHROPIC_API_KEY`
- `HELIUS_API_KEY`, `SOLANA_PRIVATE_KEY`, `SOLANA_RPC_URL`
- `NEXT_PUBLIC_PRIVY_APP_ID`

**Optional:**
- `KALSHI_API_KEY`, `KALSHI_API_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Key Patterns

1. **Routing**: `telegramHandler.ts` pattern-matches commands to skills
2. **Platform Abstraction**: `markets.ts` unifies all prediction market APIs
3. **Similarity Matching**: `utils.ts` uses 40% sequence + 60% Jaccard for market matching
4. **Autonomous Tasks**: `heartbeat.ts` runs arb/whale scans every 5 minutes
5. **On-Chain Calibration**: Every prediction gets a Solana Memo for verifiable history
