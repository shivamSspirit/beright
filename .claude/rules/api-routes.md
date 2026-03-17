---
paths: beright-ts/app/api/**/*.ts
---
# API Route Development Rules

## Input Validation
- All POST/PUT endpoints MUST validate input with Zod schemas
- Define schemas in the route file or import from `lib/schemas/`
- Return 400 with specific error messages for validation failures

## Response Standards
- Always return JSON with consistent structure: `{ success: boolean, data?: T, error?: string }`
- Use appropriate HTTP status codes:
  - 200: Success
  - 201: Created
  - 400: Bad request / validation error
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not found
  - 429: Rate limited
  - 500: Server error

## Error Handling
- Catch all errors and return structured responses
- Never expose stack traces in production
- Log errors with context (userId, endpoint, params)

## Performance
- V2 endpoints should respond in <500ms for data fetches
- Use caching where appropriate (Data Fabric has 30s TTL)
- Consider pagination for list endpoints

## Security
- Validate wallet addresses with regex before use
- Sanitize all user input
- Rate limit sensitive endpoints
