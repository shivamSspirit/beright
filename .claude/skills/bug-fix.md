# Skill: Bug Fix

Systematic approach to fixing bugs in BeRight.

## When to Use
- Reported bugs from users
- Errors in logs
- Failed tests
- Unexpected behavior

## Phase 1: Reproduce

### 1. Get Details
- Exact steps to reproduce
- Expected vs actual behavior
- Environment (local/prod)
- User context (if applicable)

### 2. Reproduce Locally
```bash
# Start local server
npm run dev

# Reproduce the issue
# Document exact steps
```

### 3. Check Logs
```bash
# Local logs
# Check terminal output

# Production logs
railway logs | grep -i error
```

## Phase 2: Isolate

### 1. Identify Layer
- API route issue?
- Agent logic issue?
- Data Fabric issue?
- Frontend issue?
- External API issue?

### 2. Trace the Request
Follow the data flow:
1. Request received
2. Routing/validation
3. Business logic
4. External calls
5. Response

### 3. Find Root Cause
```bash
# Search for related code
grep -r "functionName" beright-ts/

# Check recent changes
git log --oneline -20
git diff HEAD~5 -- path/to/file.ts
```

## Phase 3: Fix

### 1. Minimal Change
- Fix only what's broken
- Don't refactor during bug fixes
- Don't add features

### 2. Add Logging (if hard to find)
Add logging to prevent future debugging difficulty.

### 3. Verify Fix
- Reproduce original issue - should be fixed
- Check no regression in related areas
- Run type check

## Phase 4: Commit

```bash
git commit -m "fix: [brief description]

Root cause: [what was wrong]
Solution: [what was changed]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Phase 5: Learn

If bug was hard to find or likely to recur:
- Add to `docs/lessons.md`
- Consider adding tests
- Consider adding monitoring
