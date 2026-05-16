---
paths: beright-ts/app/api/**/*.ts
---
# API Route Rules

## Required
- Validate POST/PUT with Zod schemas
- Return: `{ success: boolean, data?: T, error?: string }`
- Response time: <500ms for data fetches

## Status Codes
200 OK | 400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error

## Security
- Validate wallet addresses before use
- Sanitize input, rate limit sensitive endpoints
- Never expose stack traces in production
