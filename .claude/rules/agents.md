---
paths: beright-ts/agents/**/*.ts
---
# Agent Development Rules

## Agent Architecture
Each agent in BeRight has a specific role and performance envelope:

| Agent | Max Response | LLM Calls | Purpose |
|-------|--------------|-----------|---------|
| Scout | 2s | 0 | Fast data fetching, arb detection |
| Analyst | 15s | 1-3 | Deep research, probability estimation |
| Trader | 3s | 0-1 | Execution, risk checks, sizing |
| xDegen | 5s | 1 | Social content generation |
| Orchestrator | 1s | 0 | Request routing only |

## Implementation Patterns

### Scout Agent
- Pure data fetching, no LLM reasoning
- Use Data Fabric for unified market data
- Cache aggressively (30s TTL)
- Return structured data, not prose

### Analyst Agent
- Can make LLM calls for reasoning
- Must cite sources for probability estimates
- Track confidence levels
- Support calibration workflow

### Trader Agent
- Always check risk limits first
- Use Tier 1 (calculation) before Tier 2 (LLM)
- Log all trade decisions
- Support dry-run mode

### xDegen Agent
- Focus on engagement, not accuracy
- Use trending topics
- Never post trade advice without disclaimers
- Rate limit posts

## Error Handling
- Each agent must handle its own errors gracefully
- Return structured error responses
- Never expose internal errors to users
- Log with agent context
