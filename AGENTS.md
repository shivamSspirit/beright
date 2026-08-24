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

## Solana Program Standards

Use these rules whenever working in `calibration-program/` or any future Solana program:

- Treat the on-chain program as the source of truth for authority, account ownership, PDA seeds, and replay protection.
- Prefer Anchor account constraints for signer, seeds, bump, owner, `has_one`, and mutability checks; add explicit `require!` checks where business invariants are not expressible as constraints.
- Never let a user-controlled role decide outcomes that affect their own reputation, payouts, or limits. Use a protocol authority, oracle, verified market-resolution source, or clearly documented off-chain trust boundary.
- Keep PDA seed names stable and shared across Rust, TypeScript clients, tests, and docs. If a seed changes, update every derivation and add a regression test.
- Use fixed-point integers for scoring, probabilities, bps, prices, and risk caps when values must be deterministic or composable. Avoid `f64` in new on-chain state unless the tradeoff is explicitly justified.
- Size accounts from actual serialized layout and test account sizes. Avoid undocumented padding changes; reserve bytes intentionally for future schema evolution.
- Validate all externally supplied values: probability bounds, score ranges, timestamps, hashes, version bytes, enum ranges, and monotonic update rules.
- For mutable snapshots, prevent stale writes by checking epochs, slots, timestamps, or content hashes when order matters.
- Do not keep disabled prototype instructions in the active program surface. Archive or clearly isolate compression, vault, staking, or experimental paths unless they are part of the current demo.
- Tests must cover happy paths, wrong signer, wrong PDA seed, duplicate/replay attempt, invalid bounds, stale update, unauthorized resolution, and double resolution.
- Keep Anchor CLI, `@coral-xyz/anchor`, Solana CLI, and generated IDL/client versions aligned. Version mismatch warnings should be treated as cleanup work, not ignored.
- For hackathon/demo claims, phrase trust boundaries precisely. Do not call something trustless, verified, or tamper-proof unless the program enforces it or the verifier path is implemented and tested.

## Current Product Shape

BeRight currently does four things:

1. Aggregates prediction markets and related signals
2. Provides market analysis and API workflows
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
- `beright-ts/IDENTITY.md` — product/system framing

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
