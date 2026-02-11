# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeRight Protocol (TypeScript edition) - Prediction market intelligence terminal built for OpenClaw/Clawdbot platform. Provides arbitrage detection, superforecaster analysis, whale tracking, and news/social intelligence via Telegram.

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
└── utils.ts             # Helpers
```

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
