# ADR-002: Telegram as Pure Gateway

> Historical note: this ADR is superseded by [OPENCLAW_TARGET_ARCHITECTURE.md](./OPENCLAW_TARGET_ARCHITECTURE.md). BeRight no longer owns Telegram polling or webhook ingress inside `beright-ts`; OpenClaw Gateway is the runtime source of truth.

## Status
**ACCEPTED** - 2026-02-28

## Context

The current `telegramHandler.ts` is a 3,850+ line monolith with 40+ handlers that violates OpenClaw architecture by mixing:
- **Routing** (60+ command prefix checks)
- **Business Logic** (spread calculations, scoring, filtering)
- **Presentation** (emoji selection, markdown formatting)

This makes it impossible to:
1. Add new gateways (API, Discord, WhatsApp) without duplicating logic
2. Test business logic in isolation
3. Change presentation without touching business logic
4. Understand what the system does

## Decision

**Telegram is JUST a gateway.** It receives messages, passes them to the orchestrator, and sends formatted responses back. Zero business logic.

### New Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Telegram   │  │    API      │  │   Discord   │  (future)        │
│  │  Gateway    │  │   Gateway   │  │   Gateway   │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          ▼                                           │
├─────────────────────────────────────────────────────────────────────┤
│                         ROUTER LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Unified Router                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │    │
│  │  │   Pattern    │  │   Semantic   │  │   Fallback   │        │    │
│  │  │   Router     │──▶│   Router    │──▶│   Router    │        │    │
│  │  │  (commands)  │  │  (LLM-based) │  │  (default)   │        │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼ RouteMatch                                │
├─────────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATOR LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Orchestrator                               │    │
│  │  - Builds CommandContext                                      │    │
│  │  - Resolves handler from route                                │    │
│  │  - Executes handler                                           │    │
│  │  - Returns CommandResult (structured data)                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼ CommandResult                             │
├─────────────────────────────────────────────────────────────────────┤
│                       HANDLER LAYER                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│  │ hotMarkets │ │  research  │ │   trade    │ │  portfolio │  ...   │
│  │  Handler   │ │  Handler   │ │  Handler   │ │  Handler   │        │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │
│         │              │              │              │               │
│         └──────────────┼──────────────┼──────────────┘               │
│                        ▼                                             │
├─────────────────────────────────────────────────────────────────────┤
│                        SKILLS LAYER                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│  │  markets   │ │  research  │ │   kalshi   │ │   dflow    │  ...   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼ CommandResult
┌─────────────────────────────────────────────────────────────────────┐
│                      FORMATTER LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Telegram   │  │    JSON     │  │  Discord    │  (matches        │
│  │  Formatter  │  │  Formatter  │  │  Formatter  │   gateway)       │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### What Each Layer Does

| Layer | Responsibility | Does NOT Do |
|-------|----------------|-------------|
| **Gateway** | Receive input, send output | Routing, business logic, formatting |
| **Router** | Determine intent, extract params | Execute anything |
| **Orchestrator** | Wire handler to route, manage context | Business logic |
| **Handler** | Call skills, return structured data | Format output, know about gateway |
| **Skills** | Core business logic, API calls | Know about presentation |
| **Formatter** | Transform data for specific gateway | Business logic |

### Telegram Gateway Contract

```typescript
// skills/telegram.ts - The ONLY Telegram-specific code

export async function handleTelegramMessage(message: TelegramMessage): Promise<void> {
  // 1. Receive
  const text = message.text?.trim();
  if (!text) return;

  // 2. Route
  const routeMatch = await router.match(text);

  // 3. Build context
  const context: CommandContext = {
    message: normalizeMessage(message),
    route: routeMatch.route,
    params: routeMatch.params,
    user: await getUser(message.from.id),
    gateway: 'telegram',
  };

  // 4. Execute
  const result = await orchestrator.execute(context);

  // 5. Format for Telegram
  const formatted = telegramFormatter.format(result, context);

  // 6. Send
  await sendMessage(message.chat.id, formatted.text, formatted.options);
}
```

That's it. No 40 handlers. No business logic. No formatting decisions.

### Migration Strategy

**No gradual migration. No feature flags. No fallback.**

The old telegramHandler.ts is technical debt. We:
1. Create the new architecture in `lib/`
2. Move handlers one by one to `lib/orchestrator/handlers/`
3. Delete the old code when each handler is migrated
4. The new telegramHandler.ts is ~50 lines, not 3,850

### Handler Migration Priority

Based on usage and complexity:

**Phase 1: Core Discovery**
- `/hot` → `hotMarketsHandler`
- `/research` → `researchHandler`
- `/brief` → `briefHandler`

**Phase 2: Trading**
- `/dflow` commands → `dflowHandler`
- `/kalshi` commands → `kalshiHandler`
- `/trade` → `tradeHandler`

**Phase 3: User Profile**
- `/me` → `profileHandler`
- `/portfolio` → `portfolioHandler`
- `/positions` → `positionsHandler`

**Phase 4: Automation**
- `/alert` → `alertHandler`
- `/autobet` → `autobetHandler`
- Context-aware queries → `contextHandler`

**Phase 5: Everything Else**
- Remaining 30+ handlers

## Consequences

### Positive
- **Gateway-agnostic**: Same handlers work for Telegram, API, Discord
- **Testable**: Each handler can be unit tested without Telegram
- **Maintainable**: 50-line gateway vs 3,850-line monolith
- **Extensible**: Add new gateways without touching business logic
- **Clear boundaries**: Each layer has one job

### Negative
- **Upfront work**: Must migrate 40+ handlers
- **Learning curve**: Team must understand new architecture
- **Temporary complexity**: During migration, two systems exist

### Risks Mitigated
- **No fallback needed**: Each handler is self-contained
- **Incremental value**: Each migrated handler immediately works across gateways
- **Reversible**: If a handler has issues, fix the handler, not the architecture

## References
- ADR-001: Gateway-Skill Separation (foundation types)
- OpenClaw Architecture (CLAUDE.md)
- Current telegramHandler.ts analysis (40+ handlers, 3,850+ lines)
