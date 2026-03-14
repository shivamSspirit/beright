# BeRight Protocol

## Purpose (WHY)

AI-powered prediction market intelligence. Users get alpha without manual research.

**Core principle**: AI replaces work, not just assists. Deliver actionable insights, not data dumps.

**10x Test**: Does this make users 10x more effective? Can they get value passively?

---

## Repo Map (WHAT)

```
beright-ts/
├── agents/           # Scout, Analyst, Trader, xDegen, Orchestrator
├── lib/
│   ├── dataFabric/   # Unified market data (all platforms)
│   ├── orchestrator/ # 40 command handlers
│   ├── execution/    # Trade routing, Jito, Jupiter
│   ├── onchain/      # Solana Brier score commits (RISKY)
│   └── kalshi/       # Kalshi API client
├── services/         # 7 remaining: risk, execution, routing
├── skills/           # Legacy Telegram skills
└── app/api/          # Next.js API routes (/v2/agent, /v2/markets)

.claude/
├── skills/           # Reusable workflows (spec, review, release)
└── settings.local.json

docs/
├── ARCHITECTURE.md   # V2 agent system details
└── APIS.md           # Prediction market API reference
```

---

## Rules (HOW)

### Always
- **Spec-first**: Write spec before code for any non-trivial feature
- **Two-tier**: Tier 1 (fetch, calculate) first, Tier 2 (LLM) only when reasoning needed
- **Commit often**: Working milestone = commit. Format: `feat:`, `fix:`, `refactor:`

### Never
- Commit secrets (.env, credentials, API keys)
- Touch `lib/onchain/` without explicit approval (real money)
- Touch `lib/execution/` without explicit approval (real trades)
- Add features beyond what's asked (no over-engineering)
- Batch multiple features in one commit

### Code Style
- TypeScript strict mode
- Prefer editing existing files over creating new ones
- No emojis unless explicitly requested
- Error messages: actionable, not generic

---

## Workflows

### Start Session
```bash
git status                    # Check branch state
cat CURRENT_TASK.md          # If exists, resume context
npm run dev                   # Start local server
```

### Common Commands
```bash
npm run dev                   # Next.js dev server
npm run telegram              # Telegram bot local
npx tsc --noEmit             # Type check
npm test                      # Run tests
```

### Making Changes
```
1. Enter plan mode for 3+ step tasks
2. Use subagents for research (keeps main context clean)
3. Verify changes work before marking done
4. Update CURRENT_TASK.md with progress
5. Commit with clear message
```

### After Corrections
If Claude makes a mistake, update `docs/lessons.md` with the pattern to prevent recurrence.

---

## Agent Routing (Quick Reference)

| Intent | Agent | Response Time |
|--------|-------|---------------|
| Quick scan, arb, trends | Scout | <2s |
| Deep research, probability | Analyst | 5-15s |
| Execute, risk, sizing | Trader | 2-3s |
| Social content, posts | xDegen | 2-5s |

---

## Off-Limits (Require Explicit Approval)

| Directory | Risk | Why |
|-----------|------|-----|
| `lib/onchain/` | HIGH | Real SOL transactions, Brier commits |
| `lib/execution/` | HIGH | Real trade execution |
| `services/riskManager.ts` | MEDIUM | Position sizing, exposure limits |
| `lib/kalshi/` | MEDIUM | Real money platform |

---

## Quick Links

- **Architecture**: `docs/ARCHITECTURE.md`
- **API Reference**: `docs/APIS.md`
- **Skills**: `.claude/skills/`
- **Current Task**: `CURRENT_TASK.md`
