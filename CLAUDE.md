# BeRight Protocol

AI prediction market intelligence. TypeScript strict mode. OpenClaw-compatible architecture.

## Commands
```bash
npm run dev          # Next.js dev server
npx tsc --noEmit     # Type check
npm test             # Run tests
```

## Critical Rules
1. Spec-first for 3+ step features
2. Use subagents for research (keeps context clean)
3. /clear between unrelated tasks
4. /compact at 70% capacity with focus area
5. New session per major component

## Off-Limits (Require Approval)
- `lib/onchain/` - Real SOL transactions
- `lib/execution/` - Real trade execution
- `lib/kalshi/` - Real money platform

## Code Style
- TypeScript strict, no `any` without justification
- Prefer editing existing files over creating new
- Actionable error messages, not generic

## Architecture

**OpenClaw-Compatible Structure:**
```
beright-ts/
├── skills/*/SKILL.md    # Skill documentation (LLM reads)
├── lib/plugins/         # Plugin registry system
├── lib/*/plugin.json    # Plugin manifests
├── AGENTS.md           # Agent roster
├── SOUL.md             # Agent personality
├── TOOLS.md            # Tool configuration
└── IDENTITY.md         # System identity
```

**References:**
- @docs/ARCHITECTURE.md - V2 agent system
- @docs/APIS.md - Prediction market APIs
- @.claude/QUICK_REFERENCE.md - Commands & shortcuts

## Agent Routing
| Intent | Agent | Model |
|--------|-------|-------|
| Quick scan, arb | scout | haiku |
| Deep research | analyst | sonnet |
| Code exploration | researcher | haiku |
| Trade execution | trader | sonnet |
| Social content | xdegen | haiku |

## Plugin System
```typescript
import { registry } from './lib/plugins';
registry.getDataSources();      // All market data providers
registry.getToolsForAgent('x'); // Tools for specific agent
```

## Session Management
- Use /rename for meaningful session names
- Create HANDOFF.md before ending long sessions
- Resume with: `claude --resume "session-name"`
