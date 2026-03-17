# /typecheck

Run TypeScript type checking and report results.

## Steps

1. Run type check:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npx tsc --noEmit
   ```

2. If errors found:
   - List each error with file:line reference
   - Group errors by file
   - Suggest fixes for common issues

3. If clean:
   - Report "No type errors found"
   - Show files checked count

## Output Format

```
TypeCheck Results
─────────────────
Status: PASS/FAIL
Files: X checked
Errors: Y found

[If errors:]
src/file.ts:123 - Error message
  → Suggested fix

src/other.ts:45 - Error message
  → Suggested fix
```
