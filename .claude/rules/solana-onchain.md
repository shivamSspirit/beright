---
paths:
  - beright-ts/lib/onchain/**/*
  - staking-pool/**/*
---
# CRITICAL: Solana On-Chain

**STOP - Ask for explicit approval before ANY edits. Real SOL, real funds.**

## Before Transactions
1. Verify SOL balance (min 0.01 buffer)
2. Simulate before sending
3. Test on devnet FIRST

## Standards
- Anchor patterns, deterministic PDAs
- Proper error codes, account validation

## Mainnet Deploy
Requires: devnet tests pass, security audit, user approval
