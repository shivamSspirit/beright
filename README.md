<p align="center">
  <img src="beright-logo.svg" alt="BeRight Logo" width="180" />
</p>

<h1 align="center">BeRight</h1>

<p align="center">
  <strong>AI prediction market intelligence with on-chain forecasting reputation.</strong><br/>
  BeRight helps forecasters discover markets, reason about edge, record predictions, and build a portable calibration record.
</p>

<p align="center">
  <a href="#vision">Vision</a> •
  <a href="#provenance">Provenance</a> •
  <a href="#active-scope">Active Scope</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#environment">Environment</a> •
  <a href="#verification">Verification</a>
</p>

---

## Vision

Prediction markets create public signals about the future, but the best forecasters still have fragmented tooling and weak portable reputation. BeRight is built around a simple idea: forecasting skill should be measurable, composable, and useful across market venues.

The product combines market aggregation, AI-assisted analysis, Solana-linked forecast records, and calibration scoring so that a user can move from market discovery to accountable reputation in one workflow.

## Provenance

BeRight has been developed through a private four-month build cycle and is published here as a clean reviewer snapshot. The public history is intentionally squashed to keep the review surface focused on the current product and to avoid redistributing old operational noise, retired implementation branches, or sensitive development artifacts.

For collaborators who need to inspect earlier development history, the recovered commits are available on GitHub in two review branches:

- `restore/original-history` — the main recovered historical chain.
- `restore/all-recovered-commits` — all recoverable commits, including additional dangling commits anchored for review.

See [Project Provenance](docs/PROVENANCE.md) for the full note on authorship, reviewer trust, and why the public repository uses a clean single-commit history.

## What BeRight Does

- Aggregates prediction markets and related signals from supported venues.
- Powers an AI-assisted terminal for market research and forecasting workflows.
- Records forecasts through Solana-linked infrastructure.
- Scores forecaster calibration and produces leaderboard/reputation outputs.
- Presents the experience through a mobile-first Next.js web app.

## Active Scope

This repository is focused on four active systems:

| Area | Path | Purpose |
| --- | --- | --- |
| Web product | `berightweb/` | Next.js app, landing page, markets, terminal, profile, leaderboard, docs |
| API and agents | `beright-ts/` | API routes, market adapters, agent runtime, orchestration, integrations |
| Calibration program | `calibration-program/` | Solana prediction recording and calibration program work |
| Scoring engine | `forecaster-scoring-engine/` | Forecaster scoring, market ingestors, leaderboard outputs |

Retired vault, staking, pool, yield, and delegation features are not active product scope.

## Repo Layout

```text
.
├── beright-ts/                 # API, orchestration, adapters, agents
├── berightweb/                 # Next.js frontend
├── calibration-program/        # Solana calibration program
├── forecaster-scoring-engine/  # Scoring and leaderboard logic
├── AGENTS.md                   # Codex operating instructions
├── CLAUDE.md                   # Claude project context
├── .env.example                # Local environment template
└── package.json                # Root npm workspace scripts
```

## Quick Start

Prerequisites:

- Node.js 18+
- npm 10+
- Rust and Cargo for `calibration-program`
- Solana CLI and Anchor tooling if you are building or testing the on-chain program

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Run the web app:

```bash
npm run dev --workspace berightweb
```

Run the API app:

```bash
npm run dev --workspace beright-ts
```

Run both workspace dev servers through Turbo:

```bash
npm run dev
```

## Environment

Use `.env.example` as the template. Do not commit real `.env` files, private keys, wallet keypairs, PEM files, or provider tokens.

Minimum local demo setup:

| Variable | Required | Notes |
| --- | --- | --- |
| `BERIGHT_MODE` | Yes | Use `demo` for local development unless testing production integrations |
| `NEXT_PUBLIC_BERIGHT_MODE` | Yes | Frontend mode mirror, usually `demo` locally |
| `NEXT_PUBLIC_APP_URL` | Yes | Local web URL, usually `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Yes | Local API URL, usually `http://localhost:3001` |

Common service variables:

| Group | Variables |
| --- | --- |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Solana/RPC | `SOLANA_PRIVATE_KEY`, `SOLANA_RPC_URL`, `HELIUS_API_KEY`, `HELIUS_RPC_MAINNET`, `HELIUS_RPC_DEVNET`, `HELIUS_WEBSOCKET_URL`, `NEXT_PUBLIC_SOLANA_RPC` |
| Wallet auth | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` |
| AI/search | `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `SERPER_API_KEY`, optional `OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY` |
| Markets | optional `KALSHI_API_KEY`, `KALSHI_API_SECRET`, `DFLOW_API_KEY`, Jupiter routing and fee variables |
| Infra | optional `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, deployment URLs |
| Payments | optional `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Safety switches | `TRADING_ENABLED`, `WALLET_WITHDRAWALS`, `API_PUBLIC_ACCESS`, `TELEGRAM_BOT_ENABLED` |

Production secrets should live only in the deployment provider, for example Railway, Vercel, Supabase, or the relevant vendor dashboard.

## Verification

Useful reviewer checks:

```bash
npm run lint --workspace berightweb
npx tsc --noEmit -p berightweb/tsconfig.json
npm run typecheck --workspace beright-ts
npm run typecheck --workspace forecaster-scoring-engine
cd calibration-program && cargo check
cd calibration-program && npx tsc --noEmit
```

Secret scanning:

```bash
gitleaks detect --source . --redact --no-banner
```

## Development Notes

- Root npm workspaces are `beright-ts`, `berightweb`, and `forecaster-scoring-engine`.
- `calibration-program` is not an npm workspace; run its Rust and TypeScript checks inside that directory.
- The web app uses Next.js App Router and TypeScript.
- Demo mode is the safest default for local UI and market-flow testing.
- Real market data, authenticated wallets, on-chain writes, Telegram, and AI workflows require their corresponding provider credentials.

## Security Notes

- Never commit `.env`, `.env.local`, PEM files, Solana keypairs, wallet private keys, or provider tokens.
- Rotate any credential that was ever committed, even if it is later removed from Git history.
- Treat `SOLANA_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, wallet keypairs, Telegram bot tokens, AI provider keys, Stripe keys, and Kalshi private keys as production secrets.
- Run gitleaks before opening a review or sharing the repository.

## Removed From Active Scope

The previous vault, staking, pool, yield, and delegation code paths are intentionally retired. Do not reintroduce those systems unless the product scope explicitly changes.
