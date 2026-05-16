# Skill: Code Review

Review code changes for quality, security, and consistency.

## Checklist

### Security
- [ ] No secrets in code (API keys, passwords)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Input validation at boundaries
- [ ] Proper error handling (no stack traces to users)

### Code Quality
- [ ] TypeScript strict mode compliant
- [ ] No `any` types without justification
- [ ] Functions are focused (single responsibility)
- [ ] No dead code or commented-out code
- [ ] Meaningful variable/function names

### Architecture
- [ ] Changes are in the right layer
- [ ] No circular dependencies
- [ ] Follows existing patterns in codebase
- [ ] No over-engineering

### Testing
- [ ] Happy path works
- [ ] Error cases handled
- [ ] Edge cases considered

## Review Format

```
## Summary
What the change does in 1-2 sentences.

## Good
- Specific things done well

## Concerns
- Issues that should be fixed before merge

## Suggestions
- Optional improvements (not blocking)

## Verdict
APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
```
