# /test-apis

Test all API endpoints to verify they're working.

## Local Server Check

First verify dev server is running:
```bash
curl -s http://localhost:3001/api/health || echo "Server not running"
```

If not running, inform user to start with `npm run dev`.

## API Tests

### Health Endpoints
```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/v2/health
```

### Market Endpoints
```bash
curl -s "http://localhost:3001/api/v2/markets?q=bitcoin&limit=3"
curl -s http://localhost:3001/api/v2/markets/trending
curl -s http://localhost:3001/api/markets/hot
```

### Portfolio Endpoints
```bash
curl -s http://localhost:3001/api/v2/portfolio
curl -s http://localhost:3001/api/v2/risk
```

### Agent Endpoint
```bash
curl -s -X POST http://localhost:3001/api/v2/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "userId": "test"}'
```

## Output Format

```
API Test Results
────────────────
Endpoint                    Status  Time
/api/health                 200     45ms
/api/v2/health              200     32ms
/api/v2/markets             200     156ms
/api/v2/markets/trending    200     89ms
/api/v2/portfolio           200     67ms
/api/v2/risk                200     54ms
/api/v2/agent               200     234ms

Summary: 7/7 endpoints healthy
```
