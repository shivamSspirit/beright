---
paths: beright-ts/agents/**/*.ts
---
# Agent Rules

| Agent | Max | LLM | Key Rule |
|-------|-----|-----|----------|
| Scout | 2s | 0 | Data only, no reasoning |
| Analyst | 15s | 1-3 | Cite sources, track confidence |
| Trader | 3s | 0-1 | Risk check first, log decisions |
| xDegen | 5s | 1 | Rate limit, disclaimer on advice |

## All Agents
- Use Data Fabric for market data
- Return structured JSON, not prose
- Handle errors gracefully, log with context
