# Skill: PR Review

Code review workflow for pull requests.

## When to Use
- Reviewing PRs before merge
- Self-review before creating PR
- Code quality assessment

## Review Checklist

### Security
- [ ] No secrets in code (API keys, passwords)
- [ ] No SQL injection vulnerabilities
- [ ] Input validation at boundaries
- [ ] No XSS in frontend code
- [ ] Proper error handling (no stack traces exposed)

### Code Quality
- [ ] TypeScript strict mode compliant
- [ ] No `any` types without justification
- [ ] Functions are focused (single responsibility)
- [ ] No dead code or commented-out code
- [ ] Meaningful names for variables/functions

### Architecture
- [ ] Changes are in the right layer
- [ ] No circular dependencies
- [ ] Follows existing codebase patterns
- [ ] No over-engineering

### Risk Assessment
- [ ] Does it touch `lib/onchain/`? (HIGH RISK)
- [ ] Does it touch `lib/execution/`? (HIGH RISK)
- [ ] Does it change agent behavior?
- [ ] Does it affect production data?

### Testing
- [ ] Happy path tested
- [ ] Error cases handled
- [ ] Edge cases considered

## Review Format

```markdown
## Summary
What this PR does in 1-2 sentences.

## Files Changed
- `path/to/file.ts` - What changed

## Good
- Specific things done well
- Code patterns to highlight

## Concerns
- Issues that should be fixed before merge
- Security or performance issues

## Suggestions
- Optional improvements (non-blocking)
- Refactoring ideas for later

## Risk Level
LOW / MEDIUM / HIGH

## Verdict
APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
```

## Commands

```bash
# View PR changes
gh pr view [number]
gh pr diff [number]

# Check CI status
gh pr checks [number]

# Approve
gh pr review [number] --approve

# Request changes
gh pr review [number] --request-changes
```
