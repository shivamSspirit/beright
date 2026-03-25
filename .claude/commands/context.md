---
name: context
description: Check and optimize context window usage
---

Analyze current context usage and suggest optimizations.

## Steps

1. **Check Current Usage**
   Run `/context` to see token breakdown

2. **Analyze**
   - If >50%: Consider compacting non-essential history
   - If >70%: Strongly recommend `/compact` with focus area
   - If >85%: Suggest `/clear` or new session

3. **Recommend Action**
   Based on current work:
   - `/compact Focus on [current feature]`
   - `/clear` for unrelated next task
   - `claude --resume "new-session"` for fresh context

## Quick Reference
| Usage | Action |
|-------|--------|
| <50% | Continue working |
| 50-70% | Consider compacting |
| 70-85% | Compact now |
| >85% | New session recommended |

## Context-Saving Tips
- Use subagents for research (separate context)
- `/clear` between unrelated tasks
- Reference docs via @path instead of reading into context
- Move large skills to docs/ for on-demand loading
