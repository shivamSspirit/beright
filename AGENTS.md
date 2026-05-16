# BeRight Codex Guide

AI prediction market intelligence with on-chain forecasting reputation.

This file is the root operating contract for Codex working in this repository.

## Active Scope

Keep work focused on these areas:

- `beright-ts/` — API, orchestration, market adapters, agent runtime
- `berightweb/` — web product
- `calibration-program/` — Solana prediction recording and calibration
- `forecaster-scoring-engine/` — scoring and leaderboard logic

Do not reintroduce retired vault, staking pool, or delegation features unless explicitly requested.

## Commands

```bash
npm install
npm run dev --workspace berightweb
npm run dev --workspace beright-ts
npx tsc --noEmit
```

## Critical Rules

1. Keep changes minimal and production-oriented.
2. Prefer editing existing files over creating new ones.
3. Align web, API, calibration, and scoring flows.
4. Remove dead references when retiring a feature.
5. Do not leave screenshots, videos, scratch notes, or temporary research files in the repo.
6. Preserve `CLAUDE.md`, `AGENTS.md`, `.claude/`, and `.agents/`.

## Off-Limits Without Explicit User Direction

- Reintroducing `staking-pool/`, `beright-vault/`, or related pool/delegation code
- Risky changes to real transaction / execution paths without verification
- Secret or credential changes beyond what the user explicitly requested

## Code Style

- TypeScript strict mode
- No `any` without justification
- Clear names over short names
- Small focused functions
- Explicit error handling on external calls
- Use guard clauses and fail fast on invalid state

## Current Product Shape

BeRight currently does four things:

1. Aggregates prediction markets and related signals
2. Powers AI-assisted terminal and API workflows
3. Records forecasts on Solana-linked infrastructure
4. Calculates forecaster reputation and leaderboard outputs

## Repo Map

```text
.
├── beright-ts/
│   ├── app/api/                # API routes
│   ├── agents/                 # Agent implementations
│   ├── skills/                 # Skill entrypoints and orchestration helpers
│   ├── lib/                    # Core services, adapters, routers, scoring, security
│   ├── docs/                   # Internal technical docs for backend architecture
│   ├── AGENTS.md               # Agent roster / behavior reference
│   ├── SOUL.md                 # Agent personality
│   ├── TOOLS.md                # Tooling overview
│   └── IDENTITY.md             # System identity
├── berightweb/                 # Next.js app
├── calibration-program/        # Solana calibration program work
├── forecaster-scoring-engine/  # Scoring engine
├── CLAUDE.md                   # Claude project setup
└── .claude/                    # Claude local setup files
```

## Working Priorities

- Prediction recording correctness
- Calibration and recent-activity consistency
- Leaderboard and scoring integrity
- Jupiter / market ingestion reliability
- Mobile-first web UX quality

## Useful References

- `CLAUDE.md` — legacy Claude operating guide and architecture context
- `README.md` — current repo scope
- `beright-ts/AGENTS.md` — backend agent roster
- `beright-ts/ARCHITECTURE.md` — backend architecture reference
- `beright-ts/IDENTITY.md` — product/system framing
- `beright-ts/LOCAL_DEV.md` — backend local setup

## Codex Behavior Expectations

- Explain the concrete change before doing large edits.
- Use a plan for multi-step cleanup, refactors, or cross-package work.
- Fix root causes where practical, not just symptoms.
- When removing a feature, also remove its stale routes, imports, copy, and docs.
- If a cleanup might break active code, verify references first.
- Leave the repository cleaner than you found it, but stay inside scope.

## Session Hygiene

- Keep work grouped by feature or subsystem.
- Re-check `git status` after broad deletions.
- Call out anything intentionally left in place because it is still active or risky to remove blindly.
