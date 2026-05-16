# /pr

Create a pull request for current changes.

## Pre-PR Checks

1. Check git status:
   ```bash
   git status
   git diff --stat
   ```

2. Run typecheck:
   ```bash
   npm run typecheck
   ```

3. Run build:
   ```bash
   npm run build
   ```

## Create PR

1. Determine base branch (usually main)

2. Analyze all commits since divergence:
   ```bash
   git log main..HEAD --oneline
   git diff main...HEAD
   ```

3. Generate PR title and description

4. Create PR:
   ```bash
   gh pr create --title "..." --body "..."
   ```

## PR Template

```markdown
## Summary
- Bullet point summary of changes

## Changes
- List of files changed with descriptions

## Test plan
- [ ] Typecheck passes
- [ ] Build succeeds
- [ ] Manual testing done
- [ ] API endpoints verified

---
Generated with Claude Code
```

## Output

Return the PR URL when complete.
