# Skill: API Integration

Guidelines for integrating new prediction market APIs or external services.

## When to Use
- Adding a new prediction market platform
- Integrating external data sources
- Adding new API endpoints

## Research Phase

### 1. API Documentation
- Find official API docs
- Identify authentication requirements
- Note rate limits
- Check data formats

### 2. Existing Patterns
Check how similar APIs are integrated:
```bash
# See existing platform integrations
ls beright-ts/lib/dataFabric/platforms/

# Check existing API clients
grep -r "fetch(" beright-ts/lib/
```

## Implementation

### 1. Create Client Module
Location: `beright-ts/lib/[service]/client.ts`

```typescript
// Standard structure
export class ServiceClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: ServiceConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  async fetchData(): Promise<Data> {
    // Implementation
  }
}
```

### 2. Add Type Definitions
Location: `beright-ts/lib/[service]/types.ts`

- Define all response types
- Use Zod for runtime validation
- Export type helpers

### 3. Add to Data Fabric (if prediction market)
Location: `beright-ts/lib/dataFabric/platforms/[platform].ts`

- Implement `PlatformAdapter` interface
- Normalize to common `Market` type
- Handle platform-specific quirks

### 4. Environment Variables
- Add to `.env.example`
- Document in README
- Add to Railway

## Testing

1. Manual API testing first:
```bash
curl -H "Authorization: Bearer $API_KEY" https://api.example.com/markets
```

2. Create test fixtures
3. Add integration tests
4. Test error handling

## Documentation

Update `docs/APIS.md` with:
- Base URL
- Authentication method
- Rate limits
- Key endpoints
- Example responses
