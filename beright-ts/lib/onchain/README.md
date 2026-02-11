# BeRight On-Chain Calibration System

## Overview

Verifiable prediction tracking using Solana Memo Program. Every prediction is committed on-chain before resolution, creating an immutable track record.

## Why Memo Program (Not SOLPRISM)

| Aspect | Memo Program | SOLPRISM |
|--------|-------------|----------|
| **Stability** | Production (since 2020) | Beta |
| **Cost** | ~0.000005 SOL | ~0.001 SOL + SDK |
| **Dependency** | None (native Solana) | External SDK |
| **Control** | Full | Limited to their format |
| **Complexity** | Simple | Medium |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  ON-CHAIN CALIBRATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

  USER MAKES PREDICTION                    MARKET RESOLVES
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────┐
│  1. COMMIT TX   │                    │  3. RESOLVE TX  │
│                 │                    │                 │
│  Memo contains: │                    │  Memo contains: │
│  • User pubkey  │                    │  • Commit TX sig│
│  • Market ID    │                    │  • Outcome      │
│  • Probability  │                    │  • Brier score  │
│  • Direction    │                    │                 │
│  • Timestamp    │                    │                 │
│  • Hash         │                    │                 │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SOLANA BLOCKCHAIN                           │
│                                                                  │
│  TX: abc123...                        TX: def456...              │
│  Memo: BERIGHT:PREDICT:v1|...         Memo: BERIGHT:RESOLVE:v1|..│
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                     IMMUTABLE HISTORY                            │
└─────────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Mirror)                           │
│                                                                  │
│  predictions table:                                              │
│  • id, user_id, question, probability, direction                │
│  • on_chain_tx: "abc123..."  ← Links to Solana                  │
│  • resolved_at, outcome, brier_score                            │
│  • resolution_tx: "def456..."                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Memo Format

### Prediction Commit (v1)
```
BERIGHT:PREDICT:v1|<user_pubkey>|<market_id>|<probability>|<direction>|<timestamp>|<hash>
```

Example:
```
BERIGHT:PREDICT:v1|7vHK...xYz|KXBTC-26DEC31-T100K|0.72|YES|1707494400|a3f2b1...
```

Fields:
- `user_pubkey`: User's Solana wallet (base58)
- `market_id`: Platform-specific market identifier
- `probability`: Predicted probability (0.00-1.00)
- `direction`: YES or NO
- `timestamp`: Unix timestamp
- `hash`: SHA256(user + market + prob + direction + timestamp + secret_salt)

### Resolution (v1)
```
BERIGHT:RESOLVE:v1|<commit_tx>|<outcome>|<brier_score>
```

Example:
```
BERIGHT:RESOLVE:v1|abc123...|YES|0.0784
```

Fields:
- `commit_tx`: Transaction signature of the original prediction
- `outcome`: Actual result (YES or NO)
- `brier_score`: Calculated Brier score (0.0000-1.0000)

## Verification

Anyone can verify a prediction by:

1. **Fetch commit TX** from Solana
2. **Parse memo** to get prediction details
3. **Check timestamp** is before market close
4. **Fetch resolution TX**
5. **Verify Brier score** calculation matches

```typescript
// Verification example
const commitTx = await connection.getTransaction(commitSig);
const memo = parseMemo(commitTx);

// Verify timestamp is before market resolution
assert(memo.timestamp < market.resolvedAt);

// Verify Brier score
const expectedBrier = calculateBrierScore(memo.probability, memo.direction, outcome);
assert(resolutionMemo.brierScore === expectedBrier);
```

## Cost Analysis

| Action | Transactions | Cost (SOL) | Cost (USD @ $150) |
|--------|-------------|------------|-------------------|
| Make prediction | 1 | 0.000005 | $0.00075 |
| Resolve prediction | 1 | 0.000005 | $0.00075 |
| **Per prediction lifecycle** | 2 | 0.00001 | $0.0015 |
| **1000 predictions** | 2000 | 0.01 | $1.50 |

## Privacy Considerations

- **Public**: User pubkey, market, probability, direction, timestamp, Brier score
- **Private**: Nothing (all on-chain is public)
- **Optional**: Use derived wallet per prediction for pseudonymity

## Implementation Files

```
lib/onchain/
├── README.md           # This file
├── memo.ts             # Memo formatting/parsing
├── commit.ts           # Commit predictions
├── resolve.ts          # Resolve predictions
├── verify.ts           # Verification utilities
└── types.ts            # TypeScript types
```
