# ADR-001: Gateway-Skill Separation Architecture

**Status:** Proposed
**Date:** 2026-02-28
**Author:** BeRight Protocol Team
**Deciders:** @shivamsoni

---

## TL;DR

We're not building a command bot. We're building an **intelligent agent**.

The 5-layer architecture isn't over-engineering—it's the minimum foundation for:
- Semantic understanding (not pattern matching)
- Multi-agent coordination (Scout, Analyst, Trader)
- Proactive behavior (Heartbeat-driven actions)
- Learning from outcomes (calibration, memory)

```
Command Bot (3 layers):     Intelligent Agent (5 layers):
User → Handler → Response   User → Understanding → Planning → Execution → Learning
```

---

## Context

### Current State

BeRight is a prediction market intelligence platform with multiple interfaces:
- Telegram bot (primary, production)
- Web terminal (in development)
- Direct API (partial)

The current architecture has **tight coupling** between:
1. Gateway logic (Telegram message handling)
2. Business logic (market data, analysis, trading)
3. Presentation (markdown formatting, emojis)

### The Problem

**`skills/telegramHandler.ts`** is a 750+ line monolith that mixes four concerns:

```
┌─────────────────────────────────────────────────────┐
│ telegramHandler.ts                                  │
│                                                     │
│  • 100+ if/else command routing                    │
│  • Business logic (arb detection, research)        │
│  • Presentation (markdown, emojis)                 │
│  • Gateway specifics (Telegram parsing)            │
│  • 40+ direct skill imports                        │
└─────────────────────────────────────────────────────┘
```

**Skills leak gateway concerns:**

```typescript
// skills/markets.ts - returns Telegram-specific markdown
return {
  text: `*Hot Markets*\n${markets.map(m => `• ${m.title}`).join('\n')}`,
  mood: 'BULLISH'
};
```

This creates several problems:

| Problem | Impact |
|---------|--------|
| Can't add new gateway without modifying skills | Web terminal requires reformatting all 50+ skills |
| Can't test business logic in isolation | Must mock Telegram to test market analysis |
| Inconsistent patterns across skills | Some return data, some return formatted text |
| Adding new skill requires modifying monolith | telegramHandler grows unbounded |
| Can't offer JSON API for same functionality | Would need to duplicate business logic |

### Evidence

1. **Web terminal development blocked**: `berightweb/src/app/beright-terminal/` exists but can't reuse Telegram skills
2. **API routes duplicate logic**: `app/api/v2/` reimplements what skills already do
3. **Format conversion hacks**: `gateway/route.ts` strips markdown post-hoc instead of formatting correctly

---

## Why 5 Layers (Not 3)

### The Wrong Question

> "Do we need Router AND Orchestrator? Couldn't we simplify to 3 layers?"

This assumes we're building a **command bot**:
```
User: /hot
Bot: Here are hot markets...
```

But we're building an **intelligent agent**:
```
User: what should I trade?
Agent: [understands intent]
       [checks your positions]
       [scans market opportunities]
       [analyzes risk/reward]
       [synthesizes recommendation]
       "Based on your portfolio and current market conditions..."
```

### Learning from OpenClaw

BeRight is built on OpenClaw's 6-component architecture:

```
┌──────────┐    ┌─────────┐    ┌──────────┐
│ GATEWAY  │───▶│   LLM   │───▶│ PI AGENT │
│(Telegram)│    │ (Groq)  │    │ (Skills) │
└──────────┘    └─────────┘    └──────────┘
      │              │              │
      │         ┌────┴────┐         │
      │         │ MEMORY  │         │
      │         │(SOUL.md)│         │
      │         └────┬────┘         │
      │              │              │
      └──────────────┼──────────────┘
                     │
             ┌───────┴───────┐
             │   HEARTBEAT   │
             │  (30min loop) │
             └───────────────┘
```

**Key insight:** The LLM isn't a utility—it's the brain. It sits between Gateway and execution.

Mapping to our architecture:

| OpenClaw Component | Our Layer | What It Actually Does |
|--------------------|-----------|----------------------|
| Gateway | Gateway | Entry/exit for messages |
| **LLM** | **Router** | **Understanding** (not pattern matching) |
| **PI Agent** | **Orchestrator** | **Coordination** (not dispatch) |
| Skills | Business Logic | Pure execution |
| Memory | Cross-cutting | Context, learning |
| Heartbeat | Orchestrator | Proactive behavior |

### Router = Understanding (Not Pattern Matching)

**3-layer thinking:**
```typescript
// Router is just pattern matching
if (text.startsWith('/hot')) return handlers.hot;
if (text.startsWith('/research')) return handlers.research;
// ... 100 more patterns
```

**Agent thinking:**
```typescript
// Router is semantic understanding
const understanding = await semanticAgent.understand({
  message: "is this a good time to buy bitcoin prediction markets?",
  context: conversationHistory,
  userProfile: userPreferences,
});

// Returns:
{
  goal: 'GET_TRADING_RECOMMENDATION',
  domain: 'PREDICTION_MARKETS',
  topic: 'bitcoin',
  subIntent: 'entry_timing',
  confidence: 0.92,
  requiredCapabilities: ['market_data', 'price_analysis', 'position_check'],
}
```

**Evolution path:**

| Stage | Router Capability |
|-------|-------------------|
| Today | Pattern matching (`/hot` → hotHandler) |
| Now | Semantic understanding (LLM-powered intent detection) |
| Next | Multi-modal (text + images + charts) |
| Future | Predictive (anticipate user needs before they ask) |

The Router is where **intelligence enters the system**. It's not boilerplate—it's the brain. Collapsing it into handlers means every handler needs to understand intent.

### Orchestrator = Coordination (Not Dispatch)

**3-layer thinking:**
```typescript
// Orchestrator just calls one handler
const result = await handlers[route.id].execute(context);
return formatter.format(result);
```

**Agent thinking:**
```typescript
// Orchestrator coordinates multiple agents
class Orchestrator {
  async execute(context: CommandContext): Promise<CommandResult> {
    const understanding = context.understanding;

    // Decide which agents to involve
    const plan = await this.plan(understanding);

    // Execute plan (might be multi-step)
    for (const step of plan.steps) {
      const agent = this.agents[step.agentId];
      const stepResult = await agent.execute(step.task, context);

      // Update context with intermediate results
      context.addResult(step.agentId, stepResult);

      // Agent might decide to modify plan based on results
      if (stepResult.suggestsReplanning) {
        plan = await this.replan(context);
      }
    }

    // Synthesize final response
    const synthesis = await this.synthesize(context);

    // Learn from this interaction
    await this.recordOutcome(context, synthesis);

    return synthesis;
  }
}
```

**Multi-agent example:**

```
User: "What's the best arb opportunity right now?"

Orchestrator Plan:
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Scout Agent                                         │
│   Task: Scan all platforms for price discrepancies          │
│   Output: 15 potential arb opportunities                    │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Analyst Agent                                       │
│   Task: Deep analysis of top 3 opportunities               │
│   Input: Scout's findings + market context                 │
│   Output: Risk-adjusted rankings with confidence           │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Trader Agent                                        │
│   Task: Check execution feasibility                        │
│   Input: Analyst's top pick + user's wallet balance        │
│   Output: Executable trade recommendation                  │
├─────────────────────────────────────────────────────────────┤
│ Synthesis: Combine all agent outputs into coherent response│
└─────────────────────────────────────────────────────────────┘
```

**Evolution path:**

| Stage | Orchestrator Capability |
|-------|------------------------|
| Today | Single handler dispatch |
| Now | Multi-handler composition |
| Next | Multi-agent coordination (Scout → Analyst → Trader) |
| Future | Autonomous goal pursuit (agent decides what to do) |

The Orchestrator is where **agency emerges**. It's not just calling functions—it's planning, coordinating, and learning.

### Why Not Collapse Them?

**If Router + Orchestrator = one layer:**
- Every handler must understand intent (duplicated logic)
- No central place for multi-agent coordination
- No place for cross-cutting concerns (memory, learning)
- Can't evolve understanding separately from execution

**If Handler + Business Logic = one layer:**
- Handlers become monoliths (current problem)
- Can't reuse business logic across handlers
- Testing requires mocking entire handler

**5 layers gives us:**
```
Router         → Evolves with UNDERSTANDING capabilities
Orchestrator   → Evolves with AGENCY capabilities
Handlers       → Stay simple, just domain logic
Business Logic → Pure, testable, reusable
Formatters     → Per-gateway presentation
```

Each layer has a **single axis of evolution**.

### The Heartbeat Connection

OpenClaw's Heartbeat runs every 30 minutes:
```
PERCEIVE → UPDATE BELIEFS → DELIBERATE → ACT → REFLECT
```

Where does this live?

**3-layer architecture:** Nowhere. Heartbeat would be a separate system calling handlers directly, duplicating orchestration logic.

**5-layer architecture:** Heartbeat IS the Orchestrator in proactive mode:

```typescript
// Heartbeat uses the same orchestrator
class Heartbeat {
  async tick() {
    // Create synthetic context (no user message)
    const context = {
      source: 'heartbeat',
      understanding: {
        goal: 'PROACTIVE_MONITORING',
        triggers: await this.checkTriggers(),
      },
    };

    // Use same orchestrator
    const result = await orchestrator.execute(context);

    // If action needed, notify relevant users
    if (result.shouldNotify) {
      await this.notifyUsers(result);
    }
  }
}
```

Same orchestration logic for reactive (user request) and proactive (heartbeat) behavior.

### Scalability Argument

```
Today (10 commands):
  3 layers might work
  Handlers do routing + orchestration + business logic

Tomorrow (50 commands):
  Handlers bloat
  Duplicate routing logic
  Hard to add new capabilities

Future (100+ commands + agents + voice + proactive):
  3 layers collapse under complexity
  No place for cross-cutting AI behavior
  Every new capability requires touching every handler
```

**5 layers scale because concerns are separated:**
- Add voice input? Only Router changes
- Add new agent? Only Orchestrator changes
- Add new command? Only add Handler + business logic
- Add new gateway? Only add Gateway + Formatter

### Summary: Agent-Centric Architecture

| Layer | Command Bot View | Intelligent Agent View |
|-------|------------------|----------------------|
| Gateway | Input/output | **Multi-modal interface** |
| Router | Pattern matching | **Semantic understanding** |
| Orchestrator | Dispatch | **Planning & coordination** |
| Business Logic | The "real" code | **Capabilities & skills** |
| Formatter | String templates | **Adaptive presentation** |

We're building the Intelligent Agent. 5 layers is the minimum.

---

## Decision

We will **separate concerns into distinct layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: GATEWAYS                                               │
│ Telegram, Web Terminal, API, Discord, CLI                       │
│ Responsibility: Receive input, deliver output                   │
│ NO business logic, NO formatting decisions                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: ROUTER                                                 │
│ Config-driven routing (replaces 100+ if/else)                   │
│ Pattern matching + semantic understanding fallback              │
│ Returns: which handler to execute                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: ORCHESTRATOR                                           │
│ Executes business logic, manages context                        │
│ Returns: STRUCTURED DATA (never formatted text)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: BUSINESS LOGIC                                         │
│ Tier 1: Data fetching (polymarket, kalshi, dflow)              │
│ Tier 2: Analysis & synthesis (LLM reasoning)                    │
│ Returns: Pure data structures                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: FORMATTERS                                             │
│ Per-gateway presentation adapters                               │
│ TelegramFormatter, WebFormatter, JSONFormatter, CLIFormatter    │
│ Transforms data → gateway-specific output                       │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principle

> **Business logic returns data. Gateways format it.**

---

## Cross-Cutting Concerns

### Error Handling

Errors flow UP through layers, formatted at the Gateway:

```typescript
// Business Logic: throws domain errors
class InsufficientBalanceError extends DomainError {
  constructor(public required: number, public available: number) {
    super(`Need ${required} USDC, have ${available}`);
  }
}

// Handler: catches and wraps
async execute(context) {
  try {
    return await executeTrade(context.params);
  } catch (error) {
    if (error instanceof DomainError) {
      return { success: false, error: error.toResult() };
    }
    throw error; // Unexpected errors bubble up
  }
}

// Orchestrator: catches unexpected errors
async execute(context) {
  try {
    return await handler.execute(context);
  } catch (error) {
    await this.logError(error, context);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        retryable: true,
      },
    };
  }
}

// Formatter: presents errors appropriately
formatError(error: ErrorResult): string {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    return `💸 Not enough USDC!\nNeed: $${error.required}\nHave: $${error.available}\n\n/wallet to check balance`;
  }
  return `❌ ${error.message}`;
}
```

### Real-Time & Streaming

The architecture supports both request/response and subscriptions:

```typescript
interface Gateway {
  // Request/response (current)
  onMessage(handler: MessageHandler): void;
  send(userId: string, response: FormattedResponse): Promise<void>;

  // Subscriptions (real-time)
  onSubscribe?(handler: SubscriptionHandler): void;
  push?(userId: string, event: StreamEvent): Promise<void>;
}

interface Orchestrator {
  // Request/response
  execute(context: CommandContext): Promise<CommandResult>;

  // Streaming response
  executeStream(context: CommandContext): AsyncIterable<CommandResult>;

  // Subscriptions
  subscribe(userId: string, topic: string): Subscription;
}
```

**Use cases:**
- WebSocket price feeds → Gateway.push()
- Streaming LLM responses → Orchestrator.executeStream()
- Telegram inline updates → Gateway.send() with edit_message

### Memory (Cross-Cutting)

Memory is injected into context, not a separate layer:

```typescript
interface CommandContext {
  // ... other fields

  // Memory (injected by Gateway before routing)
  memory: {
    conversation: Message[];        // Last N messages
    userProfile: UserProfile;       // Preferences, history
    episodic: Episode[];            // Past actions + outcomes
    working: Map<string, unknown>;  // Current session state
  };
}

// Orchestrator updates memory after execution
class Orchestrator {
  async execute(context) {
    const result = await handler.execute(context);

    // Record episode for learning
    await memory.recordEpisode({
      input: context.message,
      understanding: context.understanding,
      output: result,
      timestamp: new Date(),
    });

    // Update user profile
    if (result.data.trade) {
      await memory.updateProfile(context.userId, {
        lastTrade: result.data.trade,
        tradingActivity: 'active',
      });
    }

    return result;
  }
}
```

**Memory flows through, not around, the architecture.**

---

## Detailed Design

### 1. Gateway Interface

```typescript
// lib/gateway/types.ts

interface Gateway {
  name: string;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;

  // Message handling
  onMessage(handler: (msg: NormalizedMessage) => Promise<void>): void;
  send(userId: string, response: FormattedResponse): Promise<void>;
}

interface NormalizedMessage {
  id: string;
  userId: string;
  chatId: string;
  text: string;
  command?: string;        // '/hot', '/research'
  arguments?: string[];    // ['bitcoin', '50']
  attachments?: Attachment[];
  replyTo?: string;
  timestamp: Date;
  raw: unknown;            // Original gateway-specific message
}
```

### 2. Router Configuration

Replace 100+ if/else with config:

```typescript
// lib/router/routes.config.ts

interface Route {
  id: string;
  patterns: string[];           // ['/hot', '/trending']
  aliases?: string[];           // ['hot markets', 'whats hot']
  goals?: UserGoal[];           // For semantic fallback
  handler: string;              // 'hotMarkets' -> handlers/hotMarkets.ts
  requiresAuth: boolean;
  requiresWallet: boolean;
  tier: 'free' | 'pro' | 'whale';
  rateLimit?: { requests: number; window: number };
}

export const ROUTES: Route[] = [
  {
    id: 'hot-markets',
    patterns: ['/hot', '/trending', '/top'],
    aliases: ['hot markets', 'trending', 'what is hot'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    handler: 'hotMarkets',
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
  },
  {
    id: 'trade',
    patterns: ['/trade', '/buy', '/sell'],
    handler: 'trade',
    requiresAuth: true,
    requiresWallet: true,
    tier: 'free',
    rateLimit: { requests: 10, window: 60000 },
  },
  {
    id: 'research',
    patterns: ['/research', '/analyze'],
    aliases: ['research', 'analyze', 'deep dive'],
    goals: ['GET_ANALYSIS', 'UNDERSTAND_MARKET'],
    handler: 'research',
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
  },
  // ... 50+ more routes
];
```

### 3. Command Context

```typescript
// lib/orchestrator/types.ts

interface CommandContext {
  // Request
  message: NormalizedMessage;
  route: Route;

  // User
  userId: string;
  userTier: 'free' | 'pro' | 'whale';
  wallet?: WalletInfo;

  // Understanding (from semantic agent)
  understanding?: {
    goal: string;
    domain: string;
    topic: string;
    confidence: number;
  };

  // Memory
  conversationHistory: Message[];
  userProfile?: UserProfile;
}

interface CommandResult {
  // Business data (NEVER formatted)
  data: unknown;

  // Metadata
  meta: {
    handlerId: string;
    executedAt: Date;
    durationMs: number;
    skillsUsed: string[];
    apiCallsMade: number;
    llmTokensUsed?: number;
  };

  // Response hints (optional, formatter can override)
  hints?: {
    mood?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    urgency?: 'low' | 'medium' | 'high';
    suggestedActions?: string[];
  };
}
```

### 4. Business Logic Layer

```typescript
// lib/data/markets.ts - Tier 1 (pure data fetching)

interface MarketData {
  id: string;
  platform: 'polymarket' | 'kalshi' | 'manifold' | 'dflow';
  question: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  closeDate?: Date;
  url: string;
}

export async function getHotMarkets(limit: number = 20): Promise<MarketData[]> {
  const [poly, kalshi, manifold] = await Promise.all([
    polymarketFetcher.getHot(limit),
    kalshiFetcher.getHot(limit),
    manifoldFetcher.getHot(limit),
  ]);

  return aggregateAndRank([...poly, ...kalshi, ...manifold]);
}

// lib/analysis/research.ts - Tier 2 (LLM synthesis)

interface ResearchResult {
  query: string;
  markets: MarketData[];
  news: NewsArticle[];
  synthesis: {
    narrative: string;
    probability: number;
    confidence: 'low' | 'medium' | 'high';
    keyFactors: string[];
    risks: string[];
  };
  timestamp: Date;
}

export async function analyzeMarket(query: string): Promise<ResearchResult> {
  // Tier 1: Fetch data
  const markets = await getHotMarkets(10);
  const news = await newsFetcher.search(query);

  // Tier 2: Synthesize with LLM
  const synthesis = await llmChat({
    system: SUPERFORECASTER_SYSTEM,
    user: buildPrompt(markets, news),
  });

  // Return STRUCTURED DATA
  return {
    query,
    markets,
    news,
    synthesis: parseSynthesis(synthesis),
    timestamp: new Date(),
  };
}
```

### 5. Formatter Interface

```typescript
// lib/gateway/formatters/types.ts

interface Formatter {
  name: string;

  // Generic formatting
  format(result: CommandResult, context: CommandContext): FormattedResponse;

  // Type-specific formatting (optional overrides)
  formatMarkets?(markets: MarketData[]): string;
  formatResearch?(research: ResearchResult): string;
  formatTrade?(trade: TradeResult): string;
  formatError?(error: Error): string;
}

interface FormattedResponse {
  text: string;

  // Gateway-specific extras
  parseMode?: 'Markdown' | 'HTML' | 'plain';
  buttons?: Button[];
  media?: Media[];

  // For streaming
  stream?: AsyncIterable<string>;
}
```

```typescript
// lib/gateway/formatters/telegram.ts

export class TelegramFormatter implements Formatter {
  name = 'telegram';

  formatMarkets(markets: MarketData[]): string {
    let text = `*🔥 HOT MARKETS*\n${'─'.repeat(30)}\n\n`;

    for (const m of markets.slice(0, 10)) {
      const emoji = m.yesPrice > 0.7 ? '🟢' : m.yesPrice < 0.3 ? '🔴' : '⚪';
      text += `${emoji} *${m.question.slice(0, 40)}*\n`;
      text += `   YES: ${(m.yesPrice * 100).toFixed(0)}% | Vol: $${formatCompact(m.volume24h)}\n\n`;
    }

    return text;
  }

  formatResearch(research: ResearchResult): string {
    return `
*🔍 ${research.query.toUpperCase()}*
${'─'.repeat(30)}

*Probability:* ${research.synthesis.probability}%
*Confidence:* ${research.synthesis.confidence}

*Analysis:*
${research.synthesis.narrative}

*Key Factors:*
${research.synthesis.keyFactors.map(f => `• ${f}`).join('\n')}

*Markets:* ${research.markets.length} found
*Sources:* ${research.news.length} articles
    `;
  }
}
```

```typescript
// lib/gateway/formatters/json.ts

export class JSONFormatter implements Formatter {
  name = 'json';

  format(result: CommandResult): FormattedResponse {
    return {
      text: JSON.stringify({
        success: true,
        data: result.data,
        meta: result.meta,
      }, null, 2),
      parseMode: 'plain',
    };
  }
}
```

### 6. Orchestrator

```typescript
// lib/orchestrator/commandOrchestrator.ts

export class CommandOrchestrator {
  private handlers: Map<string, CommandHandler>;

  async execute(context: CommandContext): Promise<CommandResult> {
    const handler = this.handlers.get(context.route.handler);

    if (!handler) {
      throw new RouteNotFoundError(context.route.id);
    }

    // Pre-execution hooks
    await this.runPreHooks(context);

    // Execute business logic
    const startTime = Date.now();
    const data = await handler.execute(context);
    const durationMs = Date.now() - startTime;

    // Post-execution hooks
    await this.runPostHooks(context, data);

    return {
      data,
      meta: {
        handlerId: context.route.handler,
        executedAt: new Date(),
        durationMs,
        skillsUsed: handler.skillsUsed,
        apiCallsMade: handler.apiCallsMade,
      },
    };
  }
}
```

### 7. Complete Flow Example

```typescript
// Gateway: Telegram receives message
const telegramMsg = { text: '/research bitcoin', chat: { id: 123 }, from: { id: 456 } };

// Step 1: Normalize
const normalized: NormalizedMessage = {
  id: 'msg_123',
  userId: '456',
  chatId: '123',
  text: '/research bitcoin',
  command: '/research',
  arguments: ['bitcoin'],
  timestamp: new Date(),
  raw: telegramMsg,
};

// Step 2: Route
const route = router.match(normalized);
// Returns: { id: 'research', handler: 'research', ... }

// Step 3: Build context
const context: CommandContext = {
  message: normalized,
  route,
  userId: '456',
  userTier: 'free',
  conversationHistory: await memory.getHistory('456'),
};

// Step 4: Execute
const result = await orchestrator.execute(context);
// Returns: { data: ResearchResult, meta: {...} }

// Step 5: Format for gateway
const formatted = telegramFormatter.format(result, context);
// Returns: { text: '*🔍 BITCOIN*\n...', parseMode: 'Markdown' }

// Step 6: Send
await telegram.sendMessage(context.message.chatId, formatted.text, {
  parse_mode: formatted.parseMode,
});
```

---

## File Structure

```
beright-ts/
├── lib/
│   ├── gateway/
│   │   ├── types.ts                    # Gateway, NormalizedMessage
│   │   ├── normalize.ts                # Platform → NormalizedMessage
│   │   ├── telegram/
│   │   │   ├── gateway.ts              # TelegramGateway implementation
│   │   │   └── formatter.ts            # TelegramFormatter
│   │   ├── web/
│   │   │   ├── gateway.ts              # WebGateway (SSE/WebSocket)
│   │   │   └── formatter.ts            # WebFormatter (HTML/JSX)
│   │   └── api/
│   │       └── formatter.ts            # JSONFormatter
│   │
│   ├── router/
│   │   ├── types.ts                    # Route, RouteMatch
│   │   ├── routes.config.ts            # ALL routes defined here
│   │   ├── patternRouter.ts            # Fast pattern matching
│   │   └── semanticRouter.ts           # LLM fallback
│   │
│   ├── orchestrator/
│   │   ├── types.ts                    # CommandContext, CommandResult
│   │   ├── orchestrator.ts             # Main orchestrator
│   │   └── handlers/                   # One file per command
│   │       ├── hotMarkets.ts
│   │       ├── research.ts
│   │       ├── trade.ts
│   │       ├── positions.ts
│   │       └── ... (50+ handlers)
│   │
│   ├── data/                           # Tier 1: Pure data
│   │   ├── types.ts                    # MarketData, NewsArticle, etc.
│   │   ├── fetchers/
│   │   │   ├── polymarket.ts
│   │   │   ├── kalshi.ts
│   │   │   ├── manifold.ts
│   │   │   └── dflow.ts
│   │   └── aggregators/
│   │       ├── markets.ts              # Cross-platform aggregation
│   │       └── news.ts
│   │
│   ├── analysis/                       # Tier 2: LLM synthesis
│   │   ├── research.ts
│   │   ├── arbitrage.ts
│   │   ├── whale.ts
│   │   └── calibration.ts
│   │
│   ├── dflow/                          # Already follows pattern ✓
│   │   ├── executor.ts
│   │   ├── router.ts
│   │   └── jupiter.ts
│   │
│   └── security/
│       └── secureHandler.ts            # Unchanged
│
├── skills/                             # DEPRECATED after migration
│   └── telegram.ts                     # Only polling, delegates to orchestrator
│
├── app/api/
│   ├── gateway/
│   │   └── route.ts                    # Web gateway endpoint
│   └── v2/                             # Direct API (uses same orchestrator)
│       ├── markets/route.ts
│       └── analysis/route.ts
│
└── docs/
    └── ADR-001-GATEWAY-SKILL-SEPARATION.md
```

---

## Consequences

### Positive

| Benefit | Description |
|---------|-------------|
| **Multi-gateway support** | Add Discord, Slack, WhatsApp, CLI without touching business logic |
| **Testability** | Unit test data fetching, analysis, formatting separately |
| **API parity** | JSON API gets same functionality as Telegram for free |
| **Consistent patterns** | All handlers follow same structure |
| **Easier onboarding** | New developers understand layers immediately |
| **Performance** | Can optimize each layer independently |
| **Streaming support** | Formatters can return async iterables |

### Negative

| Cost | Mitigation |
|------|------------|
| **Migration effort** | Incremental migration, 5 handlers at a time |
| **More files** | Clear naming conventions, good IDE navigation |
| **Indirection** | Type safety ensures correctness |
| **Learning curve** | Document patterns, provide examples |

### Neutral

- **SkillResponse type**: Keep for backward compatibility during migration
- **Existing tests**: Will need updating but test same logic

---

## Migration Plan

### Philosophy: Incremental, Not Big-Bang

We will NOT migrate all 50 commands at once. Instead:

1. **Build the new path** (foundation)
2. **Prove it works** (one command end-to-end)
3. **Migrate critical path** (trading, positions)
4. **Migrate on-demand** (as we touch files)
5. **Legacy fallback** (old code keeps working)

```
┌─────────────────────────────────────────────────────────────┐
│ telegramHandler.ts (legacy)                                 │
│                                                             │
│   if (newRouter.canHandle(command)) {                      │
│     return newOrchestrator.execute(context);  // New path  │
│   } else {                                                  │
│     return legacyHandler(message);            // Old path  │
│   }                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 0: Foundation (Week 1)

**Goal:** Build the skeleton, no behavior change yet.

- [ ] Create `lib/gateway/types.ts` - Gateway, NormalizedMessage interfaces
- [ ] Create `lib/router/types.ts` - Route, RouteMatch interfaces
- [ ] Create `lib/router/routes.config.ts` - empty route array
- [ ] Create `lib/orchestrator/types.ts` - CommandContext, CommandResult
- [ ] Create `lib/orchestrator/orchestrator.ts` - skeleton class
- [ ] Create `lib/gateway/formatters/types.ts` - Formatter interface
- [ ] Create `lib/gateway/formatters/telegram.ts` - TelegramFormatter skeleton

**Deliverable:** Types compile, no runtime changes.

### Phase 1: First Command End-to-End (Week 1-2)

**Goal:** Prove the pattern works with `/hot`.

- [ ] Implement `lib/router/patternRouter.ts` - matches `/hot`
- [ ] Implement `lib/orchestrator/handlers/hotMarkets.ts` - returns structured data
- [ ] Implement `TelegramFormatter.formatMarkets()` - formats to markdown
- [ ] Wire into telegramHandler.ts with feature flag
- [ ] Test: Telegram sends `/hot`, gets formatted response
- [ ] Test: Same handler, JSON formatter, get JSON output

**Deliverable:** `/hot` works through new architecture.

### Phase 2: Critical Path (Week 2-3)

**Goal:** Trading and positions work through new architecture.

- [ ] `/trade` - Already uses `executeSmartTrade()`, needs formatter
- [ ] `/positions` - Already uses `getPositionSummary()`, needs formatter
- [ ] `/wallet` - Simple, good test case
- [ ] `/quote` - New command, build native to new architecture

**Deliverable:** Can trade through new architecture.

### Phase 3: Web Gateway (Week 3-4)

**Goal:** Same orchestrator, different gateway.

- [ ] Implement `lib/gateway/web/gateway.ts` - SSE/WebSocket
- [ ] Implement `lib/gateway/formatters/web.ts` - HTML/JSON
- [ ] Connect to `berightweb/src/app/beright-terminal/`
- [ ] Test: Web terminal uses same handlers as Telegram

**Deliverable:** Web terminal works.

### Phase 4: Migrate On-Demand (Ongoing)

**Goal:** No deadline. Migrate as we touch files.

When we need to modify a command:
1. Check if it's in new architecture
2. If not, migrate it first
3. Then make the change

**Trigger:** "I need to change `/research`" → migrate `/research` first.

This avoids:
- Bulk migration with deadline pressure
- Migrating commands we never touch
- Big-bang risk

### Phase 5: Deprecation (When Ready)

**Goal:** Remove legacy code when >80% migrated.

- [ ] Audit: which commands still on legacy path?
- [ ] Migrate remaining high-use commands
- [ ] Add deprecation warnings to legacy path
- [ ] Remove telegramHandler.ts monolith
- [ ] Archive old skills/ files

**Trigger:** When legacy path handles <20% of traffic.

### Timeline Summary

| Phase | Duration | Outcome |
|-------|----------|---------|
| 0 | 1 week | Types, interfaces, skeleton |
| 1 | 1 week | `/hot` end-to-end |
| 2 | 1-2 weeks | Trading works |
| 3 | 1-2 weeks | Web terminal works |
| 4 | Ongoing | Migrate as needed |
| 5 | When ready | Remove legacy |

**Total to MVP (web + trading):** 4-6 weeks
**Total to complete:** As long as it takes (no deadline)

---

## Metrics for Success

| Metric | Before | Target |
|--------|--------|--------|
| Lines in telegramHandler | 750+ | < 50 (just polling) |
| Time to add new gateway | 2+ weeks | < 1 day |
| Time to add new command | 30+ min | < 10 min |
| Business logic test coverage | ~20% | > 80% |
| Code duplication (API vs Telegram) | High | Zero |

---

## Decision

**We will adopt the Gateway-Skill Separation Architecture** as described above.

### Rationale

1. **Telegram is just a gateway** - the product is the intelligence, not the interface
2. **Web terminal is blocked** - can't reuse any Telegram skills currently
3. **DFlow integration already follows this pattern** - proves it works
4. **OpenClaw architecture prescribes this** - we're just not following it

### Next Steps

1. Review this ADR
2. Approve or request changes
3. Begin Phase 0 implementation

---

## References

- [OpenClaw Architecture](../CLAUDE.md) - 6-component design
- [DFlow Integration](./DFLOW_INTEGRATION_PLAN.md) - example of clean separation
- [Nikita Bier's Product Principles](../CLAUDE.md) - narrow target, habit formation

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-28 | Initial draft | BeRight Team |
