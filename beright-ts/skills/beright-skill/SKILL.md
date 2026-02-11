---
name: beright
description: Prediction market intelligence - arbitrage detection, market research, whale tracking, portfolio manager. Use for /arb, /hot, /brief, /research, /whale, /portfolio commands.
user-invocable: true
triggers:
  - /arb
  - /hot
  - /brief
  - /research
  - /whale
  - /portfolio
  - /odds
  - /news
  - /predict
  - /calibration
  - /me
  - /leaderboard
  - arbitrage
  - prediction market
  - polymarket
  - kalshi
  - manifold
---

# BeRight - Prediction Market Intelligence

You have TypeScript skills in the workspace that provide **real API access** to prediction markets. NEVER use web_fetch to scrape websites. ALWAYS use these commands via bash.

## Commands (run via bash with ts-node)

### Market Data
```bash
# Trending markets (all platforms)
npx ts-node skills/markets.ts hot

# Search markets
npx ts-node skills/markets.ts search "bitcoin"

# Compare odds across platforms
npx ts-node skills/markets.ts compare "fed rate"

# DFlow hot markets (tokenized Kalshi)
npx ts-node skills/markets.ts dflow
```

### Arbitrage Scanner
```bash
# Full arb scan (all platforms)
npx ts-node skills/arbitrage.ts

# Targeted arb scan
npx ts-node skills/arbitrage.ts "trump"
```

### Research & Analysis
```bash
# Deep research on a topic
npx ts-node skills/research.ts "bitcoin 100k"
```

### Whale Tracking
```bash
# Scan whale activity
npx ts-node skills/whale.ts scan
```

### Morning Brief
```bash
# Generate morning briefing
npx ts-node skills/brief.ts
```

### News & Intel
```bash
# News search
npx ts-node skills/intel.ts news "crypto"

# Social sentiment
npx ts-node skills/intel.ts social "bitcoin"
```

## Working Directory

All commands MUST be run from: `/Users/shivamsoni/Desktop/openclaw/beright-ts`

## Response Format

After running commands, format the output nicely for Telegram:
- Use emojis for visual hierarchy
- Keep responses concise
- Highlight key numbers (spreads, odds, volumes)
- Always mention the data source (Polymarket, Kalshi/DFlow, Manifold)

## API Sources (DO NOT SCRAPE)

The skills use these APIs directly:
- **Polymarket**: gamma-api.polymarket.com
- **Kalshi**: dev-prediction-markets-api.dflow.net (DFlow - tokenized)
- **Manifold**: api.manifold.markets
- **Metaculus**: metaculus.com/api2

NEVER use web_fetch for market data. Always run the ts-node commands.
