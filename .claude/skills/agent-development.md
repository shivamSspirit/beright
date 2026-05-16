# Skill: Agent Development

Guidelines for developing and modifying BeRight agents.

## When to Use
- Adding new agent capabilities
- Modifying agent behavior
- Creating new agent types
- Debugging agent issues

## Agent Architecture

```
beright-ts/agents/
├── orchestrator/    # Routes requests to agents
├── scout/           # Fast data fetching
├── analyst/         # Deep research
├── trader/          # Execution and risk
└── xdegen/          # Social content
```

## Performance Envelopes

| Agent | Max Time | LLM Calls | Tier |
|-------|----------|-----------|------|
| Scout | 2s | 0 | 1 |
| Analyst | 15s | 1-3 | 2 |
| Trader | 3s | 0-1 | 1-2 |
| xDegen | 5s | 1 | 2 |
| Orchestrator | 1s | 0 | 1 |

## Two-Tier System

### Tier 1: Data Fetching
- No LLM calls
- Pure computation and API calls
- Fast response times
- Use for: prices, volumes, calculations

### Tier 2: Reasoning
- LLM calls allowed
- Deeper analysis
- Slower response times
- Use for: probability estimation, content generation

## Implementation Pattern

```typescript
// beright-ts/agents/[name]/index.ts

import { AgentResponse } from '../types';

export interface AgentConfig {
  maxResponseTime: number;
  allowLLM: boolean;
}

export async function handleRequest(
  input: string,
  context: AgentContext
): Promise<AgentResponse> {
  // 1. Parse intent
  const intent = parseIntent(input);

  // 2. Tier 1: Fetch data
  const data = await fetchData(intent);

  // 3. Tier 2: Reason (if needed)
  if (needsReasoning(intent)) {
    return await analyzeWithLLM(data, intent);
  }

  // 4. Return structured response
  return formatResponse(data);
}
```

## Adding New Capability

1. Identify which agent owns the capability
2. Add to orchestrator routing
3. Implement handler in agent
4. Add tests
5. Update agent documentation

## Testing Agents

```bash
# Test via API
curl -X POST http://localhost:3001/api/v2/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "test query", "userId": "test"}'

# Test specific skill
npx ts-node skills/[skill].ts
```

## Common Issues

### Agent Too Slow
- Check if using Tier 2 when Tier 1 would work
- Check external API response times
- Add caching

### Wrong Agent Routing
- Check orchestrator intent parsing
- Add new patterns to routing

### LLM Errors
- Check API key is valid
- Check rate limits
- Add fallback behavior
