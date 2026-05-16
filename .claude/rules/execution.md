---
paths:
  - beright-ts/lib/execution/**/*
  - beright-ts/lib/kalshi/**/*
  - beright-ts/services/riskManager.ts
---
# CRITICAL: Trade Execution

**STOP - Ask for explicit approval before ANY edits. Real money.**

## Pre-Trade
1. Check risk limits
2. Verify balance
3. Simulate first
4. Log intent

## Execution
Route (Jupiter) -> Quote -> Simulate -> Execute -> Log

## Errors
- Exponential backoff on retry
- Never retry large losses without confirmation
