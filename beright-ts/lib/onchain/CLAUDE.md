# On-Chain Module - HIGH RISK

## Warning
This module handles **real SOL transactions** and **Brier score commits**.
**DO NOT modify without explicit user approval.**

## What This Does
- Commits predictions to Solana blockchain
- Records Brier scores on-chain (portable reputation)
- Manages wallet transactions

## Files

| File | Purpose | Risk |
|------|---------|------|
| `commit.ts` | Transaction building | HIGH - sends real SOL |
| `calibration.ts` | Brier score commits | HIGH - immutable on-chain |
| `memo.ts` | Memo program encoding | LOW |
| `verify.ts` | Signature verification | LOW |
| `types.ts` | Type definitions | LOW |

## Before Modifying

1. **Get explicit approval** - "I want to modify lib/onchain/..."
2. **Understand the transaction flow** - read existing code first
3. **Test on devnet** - never test with mainnet first
4. **Check wallet balance** - ensure enough SOL for fees

## Common Gotchas

- Transactions require SOL for fees (~0.000005 SOL per tx)
- RPC endpoints can be rate-limited
- Brier commits are **immutable** - no undo
- Use `SOLANA_RPC_URL` env var, not hardcoded endpoints

## Testing

```bash
# Use devnet for testing
SOLANA_RPC_URL=https://api.devnet.solana.com npm test

# Never test with mainnet wallet on dev
```
