# Skill: Write Spec

Write a specification before implementing any non-trivial feature.

## When to Use
- Any feature requiring 3+ steps
- Architectural decisions
- New integrations
- Changes to risky modules (onchain, execution)

## Spec Template

```markdown
# Feature: [Name]

## Summary
One paragraph describing what this feature does.

## Behavior
- What happens when user does X
- What happens when Y fails
- Edge cases

## Technical Approach
- Which files will be modified
- New dependencies (if any)
- Data flow

## Out of Scope
- What this feature does NOT do
- Future enhancements to consider later

## Testing
- How to verify it works
- Edge cases to test

## Risks
- What could go wrong
- Mitigation strategies
```

## Process
1. Write spec in a code block
2. Review with user
3. Get explicit approval
4. Then implement
