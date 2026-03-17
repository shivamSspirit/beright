---
paths:
  - beright-ts/**/*.test.ts
  - beright-ts/**/*.spec.ts
---
# Testing Rules

## Test Structure
- Use descriptive test names: "should [action] when [condition]"
- Group related tests with describe blocks
- One assertion per test when possible

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Fast execution (<100ms per test)

### Integration Tests
- Test API routes end-to-end
- Use test database/environment
- Clean up after tests

### Agent Tests
- Test agent routing logic
- Mock LLM responses for determinism
- Verify response time constraints

## Mocking
- Mock external APIs (Polymarket, Kalshi, etc.)
- Mock Solana RPC for on-chain tests
- Use fixtures for consistent test data

## Coverage Goals
- Critical paths: 90%+ coverage
- Agents: 80%+ coverage
- Utils: 70%+ coverage

## Running Tests
```bash
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm test -- path/to/file # Specific file
```
