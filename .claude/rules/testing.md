---
paths:
  - beright-ts/**/*.test.ts
  - beright-ts/**/*.spec.ts
---
# Testing Rules

## Structure
- Name: "should [action] when [condition]"
- One assertion per test
- Mock external APIs and Solana RPC

## Coverage
Critical: 90% | Agents: 80% | Utils: 70%

## Commands
```bash
npm test                 # All tests
npm test -- path/to/file # Specific file
```
