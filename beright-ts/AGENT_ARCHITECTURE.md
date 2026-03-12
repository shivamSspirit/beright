# BeRight Agent Architecture

## The Vision

**BeRight = Bloomberg Terminal for prediction markets**

Like a trading floor with specialized desks, we have specialized agents:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                   │
│                     (Understands → Routes → Synthesizes)                │
│                                                                          │
│   "What agent should handle this? Scout for quick scan, Analyst for     │
│    deep research, Trader for execution."                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│      SCOUT       │    │     ANALYST      │    │     TRADER       │
│  Speed + Breadth │    │      Depth       │    │    Execution     │
│                  │    │                  │    │                  │
│ "What's happening│    │ "What's the true │    │ "Execute this    │
│  across all 5    │    │  probability?    │    │  trade with      │
│  platforms NOW?" │    │  Why? Evidence?" │    │  best pricing"   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Agent Philosophy

### The Human Replacement Model

Each agent replaces a **specific human role**:

| Agent | Human Equivalent | Work Style |
|-------|-----------------|------------|
| **Scout** | Junior analyst scanning Bloomberg terminals | Fast, surface-level, across all sources |
| **Analyst** | Senior research analyst | Deep, methodical, one topic at a time |
| **Trader** | Execution desk | Precise, risk-aware, action-oriented |
| **Orchestrator** | Trading floor manager | Routes work, synthesizes results |

### The Cognitive Specialization

| Agent | Cognitive Mode | LLM Model | Temperature |
|-------|---------------|-----------|-------------|
| **Scout** | Pattern recognition | Claude Sonnet | 0.2 (fast, consistent) |
| **Analyst** | Deep reasoning | Claude Opus | 0.4 (thoughtful) |
| **Trader** | Risk calculation | Claude Sonnet | 0.1 (precise) |
| **Orchestrator** | Intent understanding | Claude Sonnet | 0.3 (balanced) |

---

## Tool Categorization

### SCOUT: Speed + Breadth (5 Tools)

Scout answers: **"What's happening NOW across ALL platforms?"**

```typescript
// Scout's tools - all about quick, broad scans
const SCOUT_TOOLS = [
  {
    name: 'scan_hot_markets',
    purpose: 'What markets have the most action right now?',
    dataScope: 'All 5 platforms, sorted by volume',
    responseTime: '<2 seconds',
  },
  {
    name: 'scan_arbitrage',
    purpose: 'Quick arb detection - where are the spreads?',
    dataScope: 'Cross-platform price comparison',
    responseTime: '<3 seconds',
  },
  {
    name: 'scan_volume_spikes',
    purpose: 'What just moved? Sudden activity.',
    dataScope: 'All platforms, 24h change detection',
    responseTime: '<2 seconds',
  },
  {
    name: 'scan_headlines',
    purpose: 'What news could move markets?',
    dataScope: 'News aggregation, quick summary',
    responseTime: '<2 seconds',
  },
  {
    name: 'scan_whales',
    purpose: 'Any big trades in the last hour?',
    dataScope: 'Large position tracking',
    responseTime: '<3 seconds',
  },
];
```

**User triggers Scout with:**
- "What's hot?"
- "Any arbs?"
- "What's moving?"
- "Quick market scan"
- "What should I look at?"

---

### ANALYST: Depth (6 Tools)

Analyst answers: **"What's the TRUE probability? Show me the evidence."**

```typescript
// Analyst's tools - all about deep, rigorous analysis
const ANALYST_TOOLS = [
  {
    name: 'research_market',
    purpose: 'Deep dive on ONE specific market',
    methodology: 'Gather all available data, news, history',
    responseTime: '5-15 seconds',
  },
  {
    name: 'estimate_probability',
    purpose: 'Superforecaster methodology probability estimate',
    methodology: 'Outside view (base rates) → Inside view (factors) → Synthesis',
    responseTime: '10-20 seconds',
  },
  {
    name: 'gather_evidence',
    purpose: 'What factors support YES vs NO?',
    methodology: 'Bullish/bearish factor analysis with evidence weights',
    responseTime: '5-10 seconds',
  },
  {
    name: 'find_base_rate',
    purpose: 'Historical frequency analysis',
    methodology: 'Reference class forecasting',
    responseTime: '3-5 seconds',
  },
  {
    name: 'compare_prices',
    purpose: 'Same market across platforms - where\'s the edge?',
    methodology: 'Detailed price comparison with spread analysis',
    responseTime: '3-5 seconds',
  },
  {
    name: 'check_calibration',
    purpose: 'How accurate have we been on similar predictions?',
    methodology: 'Historical Brier score, over/under-confidence patterns',
    responseTime: '2-3 seconds',
  },
];
```

**User triggers Analyst with:**
- "What's your probability for X?"
- "Analyze the Trump election market"
- "Why is this market priced at 65%?"
- "Give me your research on Bitcoin ETF"
- "Should I bet YES or NO?"

---

### TRADER: Execution (6 Tools)

Trader answers: **"How do I execute this trade with best pricing and proper risk?"**

```typescript
// Trader's tools - all about execution and risk
const TRADER_TOOLS = [
  {
    name: 'get_positions',
    purpose: 'What do I currently hold across all platforms?',
    dataScope: 'Cross-platform portfolio view',
    responseTime: '<2 seconds',
  },
  {
    name: 'calculate_size',
    purpose: 'How much should I bet given my edge and risk tolerance?',
    methodology: 'Kelly criterion with configurable fraction',
    responseTime: '<1 second',
  },
  {
    name: 'find_best_price',
    purpose: 'Where can I get the best fill for this trade?',
    dataScope: 'All platforms with liquidity analysis',
    responseTime: '2-3 seconds',
  },
  {
    name: 'check_risk',
    purpose: 'What\'s my current exposure and correlation risk?',
    methodology: 'Position limits, drawdown analysis, correlation matrix',
    responseTime: '2-3 seconds',
  },
  {
    name: 'execute_trade',
    purpose: 'Place the order with smart routing',
    action: 'Actual execution via platform APIs',
    responseTime: '3-5 seconds',
  },
  {
    name: 'set_alert',
    purpose: 'Notify me when price/event triggers',
    action: 'Create persistent alert',
    responseTime: '<1 second',
  },
];
```

**User triggers Trader with:**
- "Buy $100 of YES on X"
- "What's my portfolio?"
- "How much should I bet on this?"
- "What's my risk exposure?"
- "Alert me when this hits 70%"

---

### ORCHESTRATOR: Router (Not a Tool User)

Orchestrator answers: **"Which agent should handle this?"**

```typescript
// Orchestrator doesn't have tools - it IS the router
// It uses the LLM to understand intent and route

interface OrchestratorDecision {
  intent: 'SCAN' | 'RESEARCH' | 'EXECUTE' | 'CONVERSE';
  agent: 'SCOUT' | 'ANALYST' | 'TRADER' | 'SELF';
  reasoning: string;
  handoff: {
    to: string;
    context: string;
  };
}

// Example routing logic:
// "What's hot?" → SCOUT (quick scan needed)
// "Analyze Trump market" → ANALYST (deep research needed)
// "Buy $50 YES on Bitcoin" → TRADER (execution needed)
// "Who are you?" → SELF (direct response, no agent)
```

---

## The Agentic Pattern (All Agents)

Every agent follows the same true agentic pattern:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER INPUT (Natural Language)                                          │
│  "find me the hot market opportunity in the current prediction market"  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LLM UNDERSTANDS & DECIDES                                              │
│  {                                                                       │
│    "reasoning": "User wants trending markets with opportunity",         │
│    "tool_calls": [{ "name": "scan_hot_markets", "parameters": {} }]     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CODE EXECUTES TOOLS                                                     │
│  const result = await tool.execute(params);                              │
│  // Fetches real data from real APIs                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LLM SYNTHESIZES RESPONSE                                                │
│  "Here are the top opportunities I found:                                │
│   🟣 Trump 2028 @ 45% - Volume spiking 300%                             │
│   🔵 Fed Rate Cut @ 72% - News catalyst detected..."                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key principle**: LLM is the brain. Tools are the hands. The LLM decides what to do, not hardcoded logic.

---

## Message Flow

```
User: "What's the probability Trump wins in 2028?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR                                                            │
│  LLM thinks: "User wants probability estimate with reasoning.            │
│               This requires deep analysis, not quick scan.               │
│               Route to ANALYST."                                         │
│  → Handoff to Analyst with context: "Trump 2028 election"               │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ANALYST                                                                 │
│  LLM thinks: "Need probability estimate. I should:                       │
│               1. Find base rate (historical incumbent advantages)        │
│               2. Research current market prices                          │
│               3. Gather bullish/bearish evidence                         │
│               4. Estimate my probability"                                │
│                                                                          │
│  Tool calls:                                                             │
│    1. find_base_rate({ topic: "US presidential re-election" })          │
│    2. research_market({ query: "Trump 2028" })                          │
│    3. gather_evidence({ market: "Trump 2028 election" })                │
│    4. estimate_probability({ ... })                                      │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RESPONSE                                                                │
│                                                                          │
│  🎯 ANALYST: Trump 2028 Election                                        │
│  ────────────────────────────────                                        │
│  My Estimate: 52% (vs market 45%)                                        │
│  Edge: +7% (suggests YES is underpriced)                                 │
│                                                                          │
│  📊 Base Rate: Incumbents win 65% of re-elections historically          │
│                                                                          │
│  📈 Bullish Factors:                                                     │
│    - Economy strong (+8%)                                                │
│    - Approval ratings above 50% (+5%)                                    │
│                                                                          │
│  📉 Bearish Factors:                                                     │
│    - Age concerns (-6%)                                                  │
│    - Potential legal issues (-10%)                                       │
│                                                                          │
│  🎲 Confidence: 72% (moderate - 2 years out is uncertain)               │
│  📐 Calibration: My recent predictions in politics: 0.21 Brier score    │
│                                                                          │
│  ⏱️ 14:32:15 UTC | 8.2s | Claude Opus                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Refactoring Plan

### Phase 1: Define Tool Schemas (Day 1)

Create proper tool definitions for each agent:

```
beright-ts/
├── agents/
│   ├── scout/
│   │   ├── index.ts          # Agentic executor
│   │   ├── tools.ts          # Tool definitions
│   │   └── prompts.ts        # System prompt
│   ├── analyst/
│   │   ├── index.ts          # Agentic executor
│   │   ├── tools.ts          # Tool definitions
│   │   └── prompts.ts        # System prompt
│   ├── trader/
│   │   ├── index.ts          # Agentic executor
│   │   ├── tools.ts          # Tool definitions
│   │   └── prompts.ts        # System prompt
│   └── orchestrator/
│       ├── index.ts          # Router logic
│       └── prompts.ts        # Routing prompt
```

### Phase 2: Implement Agents (Day 2-3)

1. **Scout** ✅ (Already done with true agentic pattern)
2. **Analyst** - Convert existing lib/analyst to agentic pattern
3. **Trader** - New implementation with execution tools
4. **Orchestrator** - Refactor from procedural to routing

### Phase 3: Integration (Day 4)

1. Update Telegram handler to use Orchestrator
2. Update SemanticAgent to work with new routing
3. Test end-to-end flows

---

## Tool Assignment Summary

| Tool | Scout | Analyst | Trader |
|------|:-----:|:-------:|:------:|
| scan_hot_markets | ✅ | | |
| scan_arbitrage | ✅ | | |
| scan_volume_spikes | ✅ | | |
| scan_headlines | ✅ | | |
| scan_whales | ✅ | | |
| research_market | | ✅ | |
| estimate_probability | | ✅ | |
| gather_evidence | | ✅ | |
| find_base_rate | | ✅ | |
| compare_prices | | ✅ | |
| check_calibration | | ✅ | |
| get_positions | | | ✅ |
| calculate_size | | | ✅ |
| find_best_price | | | ✅ |
| check_risk | | | ✅ |
| execute_trade | | | ✅ |
| set_alert | | | ✅ |

---

## The Key Insight

**Before (Wrong)**:
- Tools randomly assigned to agents
- Keyword matching for routing
- Switch statements for tool selection

**After (Right)**:
- Tools categorized by cognitive purpose (Speed vs Depth vs Action)
- LLM understands natural language for routing
- LLM decides which tools to call based on understanding

**Each agent is a specialist**:
- Scout = Speed demon, knows a little about everything
- Analyst = Deep thinker, knows a lot about one thing
- Trader = Action taker, executes with precision
- Orchestrator = Manager, routes work to specialists

---

## Implementation Status

### Completed ✅

1. [x] **Scout Agent** (`agents/scout/index.ts`)
   - 7 tools: get_hot_markets, search_markets, find_arbitrage, compare_odds, get_news, get_tokenized_markets, track_whales
   - True agentic pattern: LLM decides → Code executes → LLM synthesizes
   - Response time: <2 seconds

2. [x] **Analyst Agent** (`agents/analyst/index.ts`)
   - 6 tools: research_market, estimate_probability, gather_evidence, find_base_rate, compare_prices, check_calibration
   - Superforecaster methodology (Tetlock)
   - Response time: 5-15 seconds

3. [x] **Trader Agent** (`agents/trader/index.ts`)
   - 6 tools: get_positions, calculate_size, find_best_price, check_risk, execute_trade, set_alert
   - Kelly criterion sizing, risk management
   - Response time: 2-3 seconds

4. [x] **Orchestrator** (`agents/orchestrator/index.ts`)
   - Pure router: understands intent → routes to specialist
   - No tools of its own
   - Routes to: Scout (SCAN), Analyst (RESEARCH), Trader (EXECUTE), Self (CONVERSE)

5. [x] **Unified Index** (`agents/index.ts`)
   - Exports all agents
   - `processMessage()` entry point
   - Agent role documentation

### Remaining Tasks

1. [ ] Update visualization pages for Analyst and Trader
2. [ ] Test with real natural language queries
3. [ ] Integrate with Telegram handler
4. [ ] Add agent metrics/monitoring
