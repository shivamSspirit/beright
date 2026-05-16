# /build

Run the Next.js build and verify it succeeds.

## Steps

1. Run typecheck first:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npx tsc --noEmit
   ```

2. If typecheck passes, run build:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npm run build
   ```

3. Report results:
   - Build success: Show bundle sizes
   - Build failure: Show error details with fixes

## Output Format

```
Build Results
─────────────
TypeCheck: PASS
Build: PASS/FAIL

[If success:]
Bundle Sizes:
- First Load JS: XXkB
- Pages: X
- API Routes: Y

[If failure:]
Error in src/file.ts:123
  → Error message
  → Suggested fix
```
