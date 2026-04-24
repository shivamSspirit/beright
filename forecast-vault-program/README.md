# Forecast Vault Program

Standalone Anchor workspace for BeRight's Solana-native forecaster vault protocol.

This workspace is intentionally separate from `calibration-program/`:

- `calibration-program/` remains the source of truth for on-chain forecasting reputation
- `forecast-vault-program/` manages capital custody, basket budgets, yield routing, and policy enforcement

## Product Thesis

Stop betting on markets. Start backing the forecasters who beat them.

The protocol combines:

- a `USDC` allocator vault
- a score-gated forecaster execution sleeve
- a Robin-style matching engine for `YES/NO` outcome-token baskets
- a conservative Solana yield router for the idle treasury sleeve

## Workspace Layout

```text
forecast-vault-program/
├── Anchor.toml
├── Cargo.toml
├── README.md
├── SPEC.md
└── programs/
    └── forecast-vault/
        ├── Cargo.toml
        └── src/
            ├── errors.rs
            ├── instructions/
            ├── lib.rs
            └── state/
```

## Scope Of This Scaffold

This workspace now implements the first real DeFi slice:

- protocol-level config and pause control
- SPL-token vault custody and receipt-share minting
- deposit / withdraw flows
- calibration-driven forecaster policy sync via `ScoreSnapshotV3`
- prediction-sleeve budget locking through trade intents

It does **not** yet implement:

- CPI adapters into Kamino / marginfi / Drift
- prediction-venue execution
- matching and neutralization
- withdraw queue logic

Those are specified in [SPEC.md](./SPEC.md) and should be implemented incrementally.
