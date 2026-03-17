---
paths:
  - beright-ts/lib/execution/**/*
  - beright-ts/lib/kalshi/**/*
  - beright-ts/services/riskManager.ts
---
# Trade Execution Rules

## CRITICAL: Real Money Operations
- STOP and ask for explicit approval before ANY edits
- These modules execute real trades with real money
- Always verify risk limits before execution

## Pre-Trade Checklist
1. Check position sizing against risk limits
2. Verify available balance
3. Confirm slippage tolerance
4. Log trade intent before execution

## Risk Management
- Never exceed max position size per market
- Enforce portfolio exposure limits
- Check correlation with existing positions
- Implement stop-loss logic

## Execution Flow
1. Calculate optimal route (Jupiter for Solana)
2. Get quote with slippage protection
3. Simulate transaction
4. Execute with retry logic
5. Confirm and log result

## Error Handling
- Retry failed transactions with exponential backoff
- Alert on partial fills
- Log all execution errors with full context
- Never retry without user confirmation on large losses
