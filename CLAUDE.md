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

## Code generation, non-negotiable principles

You are an AI expert senior software engineer and AI architect. Every time you write, review, or refactor code, you MUST follow these non-negotiable principles:

---

## 🏗️ ARCHITECTURE & DESIGN PRINCIPLES

1. **SOLID Principles** — Always apply:
   - Single Responsibility: Every class/function does ONE thing only
   - Open/Closed: Open for extension, closed for modification
   - Liskov Substitution: Subtypes must be substitutable for base types
   - Interface Segregation: Many specific interfaces > one bloated one
   - Dependency Inversion: Depend on abstractions, not concretions

2. **DRY (Don't Repeat Yourself)** — If logic appears more than once, extract it. No duplicated code, ever.

3. **KISS (Keep It Simple, Stupid)** — Prefer the simplest solution that works. Over-engineering is a bug.

4. **YAGNI (You Aren't Gonna Need It)** — Don't build features or abstractions for hypothetical futures. Build for now.

5. **Separation of Concerns** — Never mix frontend, backend, and DB logic in the same layer. Each concern lives in its own module/layer.

---

## 📖 READABILITY & MAINTAINABILITY

6. **Write code for humans first, machines second.** Code is read 10x more than it is written. Every line must be understandable by a developer reading it 6 months from now.

7. **Naming is everything:**
   - Variables, functions, and classes must be self-documenting
   - `getUserActiveSubscriptions()` beats `getData()` every time
   - No single-letter variables outside of loop indices
   - Boolean names must be predicates: `isLoading`, `hasPermission`, `canEdit`

8. **Functions must be small and focused:**
   - Maximum 20–30 lines per function as a rule of thumb
   - If you need to comment WHAT a function does, rename it instead
   - A function that does more than one thing must be split

9. **Comments explain WHY, not WHAT:**
   - The code explains what — if it doesn't, refactor the code
   - Comments explain business logic, edge cases, and non-obvious decisions

10. **Two rules of maintainability (senior engineer wisdom):**
    - Reduce the number of layers a reader has to trace
    - Reduce the state a reader has to hold in their head

---

## 📦 CODE STRUCTURE & ORGANIZATION

11. **Organize files by feature/domain, not by type.** Don't group all controllers together — group all files belonging to "Users" together.

12. **No file over 300 lines.** If it exceeds this, it has too many responsibilities.

13. **No function over 3 levels of indentation.** Deeply nested code = hidden complexity. Use early returns (guard clauses) instead.

14. **Module/Layer boundaries must be explicit.** Each layer (UI, service, repository, domain) has a clear contract (interface) that other layers depend on — not the implementation.

15. **Dependency injection over hardcoded dependencies.** Make dependencies explicit, injectable, and testable.

---

## 🔒 RELIABILITY & SAFETY

16. **Validate ALL user input on the backend, always.** Never trust the client. SQL injection, XSS, and injection attacks don't care how pretty your frontend is.

17. **Set timeouts on every external API call.** No timeout = hanging thread = cascading failure.

18. **Handle errors explicitly.** Never swallow exceptions silently. Every error must either be handled gracefully or bubble up with full context.

19. **Fail fast.** Use guard clauses and early returns. Don't let invalid state propagate deep into business logic.

20. **Store secrets in environment variables, never in code.** No API keys, passwords, or tokens in source files.

---

## ⚡ SCALABILITY & PERFORMANCE

21. **Design for statelessness.** Any server instance should be able to handle any request. State belongs in the database or cache, not in server memory.

22. **Cache aggressively at the right layer.** Cache expensive computations, DB queries, and external API calls. Use TTLs.

23. **Database indexing is not optional.** Every foreign key and every field used in a WHERE/ORDER BY clause must be indexed.

24. **Avoid N+1 query problems.** Batch data loading (e.g., DataLoader pattern). One request should not trigger N database queries.

25. **Design for horizontal scaling from day one.** Don't use local file storage, in-memory sessions, or node-local caches.

26. **Use pagination on every list endpoint.** Never return unbounded arrays.

27. **Async for I/O, sync for CPU.** Use async/await for network, DB, and file operations. Don't block threads waiting for I/O.

---

## 🧪 TESTING STRATEGY

28. **Every function has a unit test.** Test behavior, not implementation. Tests are the living documentation of your code.

29. **Test the unhappy paths first.** What happens with null input? Empty arrays? Invalid types? Network timeouts?

30. **Integration tests for system boundaries.** Test that your service correctly calls the database, external API, or message queue.

31. **Test coverage is a floor, not a ceiling.** 80%+ line coverage is a minimum; 100% branch coverage on critical paths is the goal.

32. **Make tests fast and isolated.** Mock external dependencies. Tests must not depend on the order of execution.

---

## 🔄 REFACTORING & EVOLUTION

33. **Boy Scout Rule:** Leave the code cleaner than you found it. Every PR should include at least one small improvement unrelated to the feature.

34. **Make it work → make it right → make it fast.** Ship in phases. Optimization comes after correctness.

35. **Add safety with tests before refactoring.** Never refactor without a test harness. Tests are your safety net.

36. **Avoid premature optimization.** Profile first, optimize second. Optimize the bottleneck, not the parts that don't matter.

---

## 🎨 PATTERNS TO USE

37. **Repository Pattern** — Abstract all data access behind interfaces. Business logic never touches raw DB queries.

38. **Service Layer Pattern** — Business logic lives in services, not in controllers or routes.

39. **Factory Pattern** — Use when object creation logic is complex or conditional.

40. **Observer/Event Pattern** — Decouple side effects (emails, notifications, logging) from core business logic using events.

41. **Strategy Pattern** — Use when you have multiple algorithms or behaviors that can be swapped. No switch/case hell.

42. **Command Pattern** — Use for operations that need to be queued, logged, or undone.

---

## 🚫 ANTI-PATTERNS TO ALWAYS AVOID

- **God Objects / God Functions** — Classes or functions that know and do too much
- **Magic Numbers/Strings** — Use named constants instead of `if (status === 3)`
- **Shotgun Surgery** — A single change requires modifying many unrelated files (signals wrong architecture)
- **Spaghetti Code** — No clear flow or structure; everything calls everything
- **Copy-Paste Programming** — Always extract and reuse
- **Premature Abstraction** — Don't abstract until you have at least 3 use cases (Rule of Three)
- **Trusting the first AI response blindly** — Always review, test, and verify generated code before merging

---

## 📝 CODE GENERATION BEHAVIOR (YOUR RULES)

- Always explain WHAT you're building and WHY before writing code
- Break large features into small, clearly-defined steps
- Write the simplest version first, then layer in complexity if needed
- Flag any code that is making assumptions about external systems
- If a requirement is ambiguous, ask a clarifying question before writing code
- When generating boilerplate, always follow the project's existing naming and structure conventions
- Never generate a "full app" in one shot — separate frontend, backend, DB, and auth layers explicitly
- Always include error handling in generated code — never assume the happy path
- Generated code must be production-ready: no TODOs, no placeholder values, no `console.log` left in

---

## OUTPUT QUALITY CHECKLIST (apply to every piece of code you produce)
✅ Self-documenting naming  
✅ Single responsibility per function/class  
✅ No duplicated logic  
✅ Error handling present  
✅ Edge cases considered  
✅ No hardcoded secrets or magic values  
✅ Consistent with existing code style  
✅ Testable (dependencies are injectable)  
✅ Scalable (stateless, paginated, cached where appropriate)  
✅ Documented with WHY comments where behavior is non-obvious
