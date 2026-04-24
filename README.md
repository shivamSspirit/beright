<p align="center">
  <img src="beright-logo.svg" alt="BeRight Logo" width="200" />
</p>

<h1 align="center">BeRight</h1>

<p align="center">
  <strong>AI-native prediction market intelligence and on-chain forecasting reputation</strong><br/>
  Search markets, analyze edge, record predictions, and track calibration on Solana.
</p>

<p align="center">
  <a href="#current-scope">Current Scope</a> •
  <a href="#repo-layout">Repo Layout</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#development-notes">Development Notes</a> •
  <a href="https://github.com/shivamSspirit/beright/issues">Issues</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-yellow" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" />
</p>

---

## Current Scope

BeRight is currently focused on four active areas:

- **`berightweb`** — the user-facing Next.js application
- **`beright-ts`** — the API, adapters, and agent orchestration layer
- **`calibration-program`** — Solana prediction recording and calibration work
- **`forecaster-scoring-engine`** — leaderboard and scoring logic

Vaults, staking pools, and capital delegation are no longer active product scope in this repository.

## What the Product Does

- Aggregates prediction market data from venues such as Polymarket, Kalshi, and Jupiter
- Provides AI-assisted market analysis through BeRight Terminal and API endpoints
- Records forecasts on Solana-linked infrastructure
- Tracks forecaster calibration with Brier-style scoring
- Surfaces forecaster reputation and leaderboard data across the product

## Scope Status

| Component | Status | Notes |
|-----------|--------|-------|
| `berightweb` | ✅ Active | Markets, terminal, profile, ranks, docs |
| `beright-ts` | ✅ Active | APIs, adapters, orchestration, agent runtime |
| `calibration-program` | ✅ Active | Prediction recording and calibration program work |
| `forecaster-scoring-engine` | ✅ Active | Scoring calculations and leaderboard outputs |
| Vault / staking stack | ❌ Removed | Retired from active repo scope |

## Repo Layout

```text
.
├── beright-ts/                 # API, agents, adapters, orchestration
├── berightweb/                # Next.js web client
├── calibration-program/       # Solana calibration program work
├── forecaster-scoring-engine/ # Forecaster scoring and leaderboard logic
├── AGENTS.md                 # Shared Codex project instructions
├── CLAUDE.md                # Shared Claude project instructions
└── .claude/                 # Claude-specific local setup notes
```

## Quick Start

### Install

```bash
npm install
```

### Run the web app

```bash
npm run dev --workspace berightweb
```

### Run the API app

```bash
npm run dev --workspace beright-ts
```

## Development Notes

- Root workspaces are `beright-ts` and `berightweb`
- Calibration and scoring code live outside the main turbo workspace on purpose
- Demo mode is supported for market browsing and UI testing
- Production market connectivity depends on provider API keys

## Active Priorities

- Keep web flows aligned with the calibration program
- Keep recent activity, leaderboard, and scoring consistent
- Keep Jupiter and market ingestion stable
- Keep docs and UI copy aligned with active product scope

## Removed From Active Scope

These areas were intentionally retired from the active repository surface:

- `staking-pool/`
- `beright-vault/`
- vault / pool API routes in `beright-ts`
- vault / pool UI routes in `berightweb`

If those features return later, they should come back as a fresh implementation instead of half-connected legacy code.
