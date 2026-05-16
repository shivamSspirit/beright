---
name: handoff
description: Create session handoff document for continuity
---

Create HANDOFF.md with the current session state for seamless continuation.

## Steps
1. Summarize what was completed this session
2. List files modified (with brief description)
3. Document any blockers or decisions needed
4. Outline next steps clearly
5. Note any important context that shouldn't be lost

## Output Format
Write to HANDOFF.md:

```markdown
# Session Handoff - [DATE]

## Completed
- [ ] Task 1
- [ ] Task 2

## Files Modified
- `path/file.ts` - Brief description
- `path/other.ts` - Brief description

## Blockers/Decisions Needed
- Issue requiring decision

## Next Steps
1. Immediate next task
2. Following task

## Context
Important details for the next session to know.

## Resume Command
\`claude --resume "session-name"\`
```

## Notes
- Keep concise - bullet points over prose
- Include specific file paths
- Make next steps actionable
