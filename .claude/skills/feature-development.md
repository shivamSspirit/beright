# Skill: Feature Development

End-to-end feature development workflow for BeRight.

## When to Use
- Building new features (3+ steps)
- Adding new agent capabilities
- Creating new API endpoints

## Phase 1: Specification

Use the `/spec` skill to write a spec first:

```markdown
# Feature: [Name]

## Summary
What this feature does in one paragraph.

## User Stories
- As a [user], I want to [action] so that [benefit]

## Behavior
- When user does X, then Y happens
- Edge cases and error states

## Technical Approach
- Files to modify
- New files needed
- Data flow

## Out of Scope
- What we're NOT building

## Risks
- What could go wrong
```

## Phase 2: Implementation

### 1. Create TODO List
Break down into atomic tasks.

### 2. Backend First (if API needed)
```
beright-ts/app/api/[endpoint]/route.ts
```

Follow API route rules:
- Input validation with Zod
- Proper error responses
- Logging

### 3. Agent Logic (if agent feature)
```
beright-ts/agents/[agent]/index.ts
```

Follow agent rules:
- Respect performance constraints
- Use appropriate tier (1 or 2)

### 4. Frontend (if UI needed)
```
beright-ts/app/[page]/page.tsx
```

### 5. Integration
- Wire up API calls
- Add to orchestrator routing

## Phase 3: Verification

1. Type check: `npm run typecheck`
2. Build: `npm run build`
3. Manual testing
4. API testing with curl

## Phase 4: Documentation

- Update CLAUDE.md if architectural change
- Add to docs/APIS.md if new endpoint
- Update lessons.md if learned something

## Phase 5: Commit

```bash
git add .
git commit -m "feat: [description]

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
