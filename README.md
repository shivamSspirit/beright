<p align="center">
  <img src="berightweb/public/logo.jpg" alt="BeRight Logo" width="200" />
</p>

# BeRight

Prediction market intelligence terminal with autonomous AI agents, built on OpenClaw technology.

## Structure

```
beright/
├── beright-ts/   # Backend API + AI agents (Next.js 14, port 3001)
└── berightweb/   # Frontend dashboard (Next.js 16, port 3000)
```

## Quick Start

```bash
# Install dependencies
npm install

# Run both workspaces
npm run dev

# Or run individually
npm run dev:api    # Backend (port 3001)
npm run dev:web    # Frontend (port 3000)
```

## Skills

```bash
npx ts-node beright-ts/skills/markets.ts search "bitcoin"
npx ts-node beright-ts/skills/arbitrage.ts "fed rate"
npx ts-node beright-ts/skills/research.ts "trump 2028"
npx ts-node beright-ts/skills/whale.ts scan
npx ts-node beright-ts/skills/intel.ts news "crypto"
npx ts-node beright-ts/skills/heartbeat.ts once
```

## Supported Platforms

- Polymarket
- Kalshi/DFlow
- Manifold
- Limitless
- Metaculus

## Environment

Copy `.env.example` to `.env` and configure:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ANTHROPIC_API_KEY`
- `HELIUS_API_KEY`, `SOLANA_PRIVATE_KEY`
- `NEXT_PUBLIC_PRIVY_APP_ID`

## Build

```bash
npm run build
npm run lint
```
