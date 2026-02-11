# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeRight Protocol (TypeScript edition) - Prediction market intelligence terminal built for OpenClaw/Clawdbot platform. Provides arbitrage detection, superforecaster analysis, whale tracking, and news/social intelligence via Telegram.

**Autonomous Building**: This codebase includes a Builder subagent that can autonomously build and improve itself 24/7.

## Commands

```bash
# Install dependencies
npm install

# Run skills directly
npx ts-node skills/markets.ts search "bitcoin"
npx ts-node skills/arbitrage.ts "fed rate"
npx ts-node skills/research.ts "trump 2028"
npx ts-node skills/whale.ts scan
npx ts-node skills/intel.ts news "crypto"
npx ts-node skills/heartbeat.ts once

# Run heartbeat loop (5 min intervals)
npx ts-node skills/heartbeat.ts loop 300

# Build TypeScript
npm run build

# ============================================
# BUILDER COMMANDS (Autonomous Development)
# ============================================

# Run one build iteration (analyze, implement, test, commit)
npx ts-node skills/buildLoop.ts once

# Run continuous build loop (default: every 30 minutes)
npx ts-node skills/buildLoop.ts loop

# Run with custom interval (seconds)
npx ts-node skills/buildLoop.ts loop 1800

# Check builder status
npx ts-node skills/buildLoop.ts status

# List discovered tasks
npx ts-node skills/buildLoop.ts tasks

# Development Skills
npx ts-node skills/devBackend.ts analyze      # Find backend issues
npx ts-node skills/devBackend.ts typecheck    # Run TypeScript check
npx ts-node skills/devBackend.ts todos        # Find all TODOs
npx ts-node skills/devFrontend.ts analyze     # Find frontend issues
npx ts-node skills/devTest.ts generate <skill> # Generate tests for a skill
npx ts-node skills/devTest.ts validate        # Run full validation
```

## Architecture

### OpenClaw Skills Pattern

```
agent/system.md          # Agent identity + skill registration
skills/
├── telegramHandler.ts   # Main router/dispatcher (triggered by telegram)
├── markets.ts           # Unified market data (Polymarket, Kalshi, Manifold)
├── arbitrage.ts         # Cross-platform arb detection
├── research.ts          # Superforecaster analysis
├── whale.ts             # Solana wallet monitoring (Helius)
├── intel.ts             # News RSS + Reddit sentiment
├── heartbeat.ts         # Autonomous periodic tasks (cron)
├── utils.ts             # Helpers
│
# Builder Subagent (Autonomous Development)
├── builder/SKILL.md     # Builder agent definition
├── buildLoop.ts         # Main autonomous build loop
├── devFrontend.ts       # Frontend development helpers
├── devBackend.ts        # Backend development helpers
└── devTest.ts           # Test generation and validation
```

### Builder Subagent

The Builder is an autonomous agent that builds and improves the codebase 24/7:

```
ANALYZE → PLAN → IMPLEMENT → TEST → COMMIT → PUSH
   ↑                                           |
   └───────────────────────────────────────────┘
```

**Trigger Methods:**
1. Manual: `/build`, `/improve` commands
2. Heartbeat: Every 30 minutes via cron
3. Continuous: `npm run builder` for 24/7 operation

**Build Priorities:**
- P0: TypeScript errors, critical bugs, hackathon requirements
- P1: MVP features, missing tests, TODOs in code
- P2: Refactoring, documentation, polish

### Skill Response Format

All skills return:
```typescript
interface SkillResponse {
  text: string;        // Markdown response
  mood?: Mood;         // BULLISH | BEARISH | NEUTRAL | ALERT | EDUCATIONAL | ERROR
  data?: unknown;      // Structured data for further processing
}
```

### Types

- `types/market.ts` - Market, Platform, ArbitrageOpportunity
- `types/response.ts` - SkillResponse, TelegramMessage, NewsResult
- `types/wallet.ts` - Position, Trade, KnownWhale

### Config

- `config/platforms.ts` - API endpoints, RSS feeds, token addresses
- `config/thresholds.ts` - Trading limits, alert thresholds
- `config/commands.ts` - Telegram command definitions

### Memory (File-based state)

- `memory/positions.json` - Open positions
- `memory/watchlist.json` - Tracked markets
- `memory/whales.json` - Known whale wallets
- `memory/heartbeat-state.json` - Last execution timestamps

## Key Patterns

1. **Routing**: `telegramHandler.ts` routes commands and keywords to specific skills
2. **Platform Abstraction**: `markets.ts` unifies Polymarket/Kalshi/Manifold APIs
3. **Similarity Matching**: `utils.ts` has text similarity for market matching (40% sequence + 60% Jaccard)
4. **Autonomous Tasks**: `heartbeat.ts` runs arb/whale scans on intervals

## Environment Variables

Required in `.env`:
- `HELIUS_API_KEY` - Solana RPC for whale tracking
- `TELEGRAM_BOT_TOKEN` - Bot token (for production)
- `KALSHI_API_KEY` - Optional, for Kalshi trading
