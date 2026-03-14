# Lessons Learned

> After any correction, add the pattern here to prevent recurrence.

## Format
```
## [Date] - [Category]
**Mistake**: What went wrong
**Fix**: How to avoid it
```

---

## 2026-03-14 - Architecture

**Mistake**: Had dead V1 code (src/, old services) cluttering the codebase
**Fix**: Periodically audit for unused imports. Delete code that has zero references.

---

## 2026-03-14 - Documentation

**Mistake**: CLAUDE.md was too long and mixed concerns (architecture, APIs, workflows)
**Fix**: Keep CLAUDE.md short (~2.5K tokens). Move details to:
- `docs/ARCHITECTURE.md` for system design
- `docs/APIS.md` for API reference
- `.claude/skills/` for reusable workflows
- Local `CLAUDE.md` in risky directories

---

<!-- Add new lessons above this line -->
