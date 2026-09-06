# BeRight Passport Reputation Engine

This package is the deterministic calculation and verification library for
BeRight Passport v1. The former V3, composite-score, vault-score, and generated
leaderboard implementations have been retired.

The active reputation output is a vector of topic-specific score snapshots,
not a single universal rank. Each snapshot exposes evidence count, effective
sample size, Brier skill, calibration error, market alpha, confidence, status,
and anti-gaming flags. An evidence bundle commits the inputs and outputs to a
Merkle root so another process can replay the result.

The Polymarket ingestion worker lives in `../beright-ts/lib/passport/`. It uses
this package to calculate and verify Passport outputs after normalizing public
venue history.

## Commands

```bash
npm test
npm run typecheck
npm run verify:passport -- path/to/evidence-bundle.json
```

## Source map

```text
src/
├── protocol/v1/       # Schemas, canonical JSON, Merkle commitments, replay
├── reputation/        # Topic scoring and underwriting policy
└── cli/               # Offline evidence-bundle verification
```

See `ARCHITECTURE.md` for the active data flow and trust boundaries.
