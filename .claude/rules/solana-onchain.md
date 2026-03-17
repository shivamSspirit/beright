---
paths:
  - beright-ts/lib/onchain/**/*
  - staking-pool/**/*
---
# Solana On-Chain Code Rules

## CRITICAL: Approval Required
- STOP and ask for explicit user approval before ANY edits to these files
- These directories handle real SOL transactions and user funds
- Mistakes here can result in financial loss

## Before Any Transaction
1. Verify wallet has sufficient SOL for fees (minimum 0.01 SOL buffer)
2. Simulate transaction before sending
3. Log transaction details before execution
4. Use devnet for all testing

## Code Standards
- Use Anchor framework patterns consistently
- All PDAs must be derived deterministically
- Include proper error codes with descriptive messages
- Implement proper account validation

## Testing Requirements
- Test on devnet first, ALWAYS
- Verify with `solana confirm <signature>`
- Check account state after transactions
- Test edge cases: insufficient funds, invalid accounts

## Deployment Checklist
- [ ] All tests passing on devnet
- [ ] Security audit completed (if significant changes)
- [ ] Backup of current program state
- [ ] User explicitly approved mainnet deployment
