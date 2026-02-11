# BeRight Technical Architecture

> A Software Architect's Deep Dive into Building the Best Prediction Market Intelligence Agent

---

## Executive Summary

After researching AI agent architectures, OpenClaw patterns, Solana Agent Kit, and production best practices, here's the optimal architecture for BeRight.

**Key Insight:** Simple architectures (Single Agent + Tools) achieve similar accuracy to complex ones at 50% lower cost. Start simple, add complexity only when needed.

---

## Part 1: AI Agent Architecture Analysis

### The 8 Major Agent Patterns (2025)

| Pattern | Complexity | Best For | Cost |
|---------|------------|----------|------|
| **Single Agent + Tools** | Low | Focused tasks | $ |
| **Sequential Agents** | Medium | Multi-stage workflows | $$ |
| **Single Agent + MCP** | Medium | Standardized integrations | $$ |
| **Hierarchical + Parallel** | High | Complex distributed tasks | $$$ |
| **Router Pattern** | Low | Decision trees | $ |
| **Human-in-the-Loop** | Medium | Critical decisions | $$ |
| **Dynamic Multi-Agent** | High | Dynamic delegation | $$$ |
| **Full Hierarchy + RAG** | Very High | Enterprise knowledge | $$$$ |

### Recommendation for BeRight: **Single Agent + Tools + Router**

**Why:**
1. Prediction market tasks are focused (not requiring complex multi-agent coordination)
2. 50% cost savings vs complex architectures
3. Easier to debug and iterate
4. Can scale complexity later if needed

---

## Part 2: The ReAct Pattern (Core of BeRight Agent)

### How ReAct Works

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct Loop                                │
│                                                              │
│  User Query: "What's the best arb opportunity right now?"    │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ THOUGHT: I need to scan all platforms for price spreads ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ACTION: Call arbitrage.scanAll()                        ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ OBSERVATION: Found 3 opportunities, best is 8% spread   ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ THOUGHT: I should also check the liquidity              ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ACTION: Call markets.getLiquidity(marketId)             ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ OBSERVATION: $50K liquidity on each side                ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ FINAL ANSWER: Best arb is Fed Rate Cut - 8% spread,     ││
│  │ $50K liquidity. Buy YES on Kalshi, NO on Polymarket.   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Best Practices for ReAct Implementation

1. **Limit tools to 8-10 max** - Performance decreases beyond this
2. **Use scratchpad for context** - Don't dump raw errors
3. **Summarize observations** - Keep context clean
4. **Implement retry logic** - Strategic retries match complex architectures

---

## Part 3: Memory Architecture

### The Dual Memory System

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              WORKING MEMORY (Short-term)                ││
│  │  • Current conversation context                         ││
│  │  • Active task state                                    ││
│  │  • Recent tool outputs                                  ││
│  │  • Scratchpad for reasoning                             ││
│  │                                                         ││
│  │  Storage: In-memory / Redis                             ││
│  │  Lifetime: Session duration                             ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↕                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            PERSISTENT MEMORY (Long-term)                ││
│  │  • User preferences and history                         ││
│  │  • Prediction track record                              ││
│  │  • Learned patterns                                     ││
│  │  • Calibration data                                     ││
│  │                                                         ││
│  │  Storage: PostgreSQL / Supabase                         ││
│  │  Lifetime: Permanent                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↕                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │             KNOWLEDGE MEMORY (RAG Layer)                ││
│  │  • Market data cache                                    ││
│  │  • News articles embeddings                             ││
│  │  • Historical market patterns                           ││
│  │  • Domain knowledge                                     ││
│  │                                                         ││
│  │  Storage: Vector DB (Pinecone/Supabase pgvector)       ││
│  │  Lifetime: Indexed & queryable                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Memory for BeRight Specifically

```typescript
// Working Memory (per session)
interface SessionMemory {
  conversationHistory: Message[];
  currentTask: Task | null;
  toolOutputs: ToolOutput[];
  scratchpad: string;
}

// Persistent Memory (per user)
interface UserMemory {
  predictions: Prediction[];
  preferences: UserPreferences;
  watchlist: Market[];
  alerts: Alert[];
  calibrationStats: CalibrationStats;
}

// Knowledge Memory (shared)
interface KnowledgeBase {
  marketEmbeddings: VectorStore;
  newsEmbeddings: VectorStore;
  historicalPatterns: PatternStore;
}
```

---

## Part 4: OpenClaw Integration Architecture

### How OpenClaw Works

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW GATEWAY                          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Telegram   │  │  WhatsApp   │  │  Discord    │         │
│  │  Channel    │  │  Channel    │  │  Channel    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          ↓                                   │
│         ┌────────────────────────────────┐                  │
│         │      MESSAGE ROUTER            │                  │
│         │  (Route by sender, channel,    │                  │
│         │   workspace, or default)       │                  │
│         └────────────────┬───────────────┘                  │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AGENT                                 ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  WORKSPACE (beright-ts/)                            │││
│  │  │  • SOUL.md (identity)                               │││
│  │  │  • AGENTS.md (behavior rules)                       │││
│  │  │  • skills/ (tools)                                  │││
│  │  │  • memory/ (state)                                  │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                          ↓                               ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  CLAUDE MODEL                                       │││
│  │  │  • Reads SOUL.md for persona                        │││
│  │  │  • Uses skills as tools                             │││
│  │  │  • Maintains session context                        │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Part 4.1: OpenClaw Agent Architecture Deep Dive

### Complete Agent Flow (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPENCLAW ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

  USER MESSAGE
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   CHANNELS   │────▶│   GATEWAY    │────▶│   AGENT RUNTIME      │
│              │     │   (Daemon)   │     │                      │
│ • Telegram   │     │              │     │ 1. Load Context      │
│ • WhatsApp   │     │ • Routes msg │     │ 2. Inject Bootstrap  │
│ • Discord    │     │ • Auth       │     │ 3. Build Prompt      │
│ • Slack      │     │ • Queue      │     │ 4. Call LLM          │
│ • iMessage   │     │              │     │ 5. Execute Tools     │
│ • WebChat    │     │              │     │ 6. Return Response   │
└──────────────┘     └──────────────┘     └──────────────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────────┐
                                          │   SKILLS (Tools)     │
                                          │                      │
                                          │ • Your skills/*.ts   │
                                          │ • Bundled skills     │
                                          │ • Managed skills     │
                                          └──────────────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────────┐
                                          │   RESPONSE           │
                                          │   Back to User       │
                                          └──────────────────────┘
```

---

### Step 1: Message Arrives (Input Layer)

```
User sends: "/arb bitcoin" via Telegram
                │
                ▼
┌─────────────────────────────────────┐
│  CHANNEL ADAPTER (grammY/Baileys)   │
│  • Receives raw message             │
│  • Extracts text, sender, metadata  │
│  • Sends to Gateway via WebSocket   │
└─────────────────────────────────────┘
```

**Supported Channels:**
- Telegram (grammY)
- WhatsApp (Baileys)
- Discord
- Slack
- iMessage
- Signal
- WebChat

---

### Step 2: Gateway Routes Message

```
┌─────────────────────────────────────┐
│  GATEWAY DAEMON (port 18789)        │
│                                     │
│  • Authenticates sender             │
│  • Identifies target agent          │
│  • Queues message for processing    │
│  • Manages sessions (JSONL files)   │
└─────────────────────────────────────┘
```

**Gateway Wire Protocol:**
```
Request:  { type: "req", id, method, params }
Response: { type: "res", id, ok, payload | error }
```

**Queue Modes:**
- `steer` - Incoming messages can interrupt current run after each tool call
- `batch` - Messages queued until current run completes

---

### Step 3: Agent Runtime Initializes

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT RUNTIME                                              │
│                                                             │
│  On first turn, injects bootstrap files:                    │
│  ┌─────────────────┐                                        │
│  │ AGENTS.md       │ ← Operating instructions               │
│  │ SOUL.md         │ ← Persona/personality                  │
│  │ IDENTITY.md     │ ← Who the agent is                     │
│  │ BOOTSTRAP.md    │ ← One-time first-run ritual            │
│  └─────────────────┘                                        │
│                                                             │
│  Sets workspace directory as agent's working context        │
└─────────────────────────────────────────────────────────────┘
```

**Bootstrap File Purposes:**

| File | Purpose | When Loaded |
|------|---------|-------------|
| `AGENTS.md` | Operating rules, behavior constraints | Every session |
| `SOUL.md` | Personality, voice, identity | Every session |
| `IDENTITY.md` | Who the agent is, capabilities | Every session |
| `BOOTSTRAP.md` | First-run setup tasks | Once only, then deleted |
| `USER.md` | User-specific context | When user identified |

---

### Step 4: Skills Loading

```
┌─────────────────────────────────────────────────────────────┐
│  SKILL LOADING (Priority Order - Higher Overrides Lower)   │
│                                                             │
│  3. <workspace>/skills/     ← HIGHEST (your custom skills)  │
│  2. ~/.openclaw/skills/     ← Managed/shared skills         │
│  1. Bundled skills          ← LOWEST (OpenClaw defaults)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Skill Structure (SKILL.md):**
```yaml
---
name: arbitrage
description: Detect cross-platform arbitrage opportunities
user-invocable: true
disable-model-invocation: false
requirements:
  env: [POLYMARKET_API_KEY]
  os: [darwin, linux]
---

## Instructions for using this skill

When user asks about arbitrage opportunities...
```

**Skill Filtering:**
- Requirements gate (env vars, binaries, OS)
- Environment injection (API keys scoped per-run)
- Session snapshot cached for performance

---

### Step 5: LLM Processing

```
┌─────────────────────────────────────────────────────────────┐
│  LLM CALL                                                   │
│                                                             │
│  System Prompt Built From:                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • AGENTS.md (operating instructions)                    ││
│  │ • SOUL.md (persona)                                     ││
│  │ • IDENTITY.md (who am I)                                ││
│  │ • Eligible SKILLS (tools available)                     ││
│  │ • Session context (previous messages)                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  User Message: "/arb bitcoin"                               │
│                    │                                        │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  LLM (Claude via provider/model config)                 ││
│  │                                                         ││
│  │  Decides: "I should use the arbitrage skill"            ││
│  │  Returns: Tool call or direct response                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Model Configuration:**
```json
{
  "model": {
    "primary": "anthropic/claude-sonnet-4",
    "fallback": "anthropic/claude-haiku"
  }
}
```

---

### Step 6: Tool/Skill Execution

```
┌─────────────────────────────────────────────────────────────┐
│  SKILL EXECUTION                                            │
│                                                             │
│  LLM says: "Call arbitrage skill with query 'bitcoin'"      │
│                    │                                        │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  skills/arbitrage.ts                                    ││
│  │                                                         ││
│  │  1. Fetch Polymarket data                               ││
│  │  2. Fetch Kalshi data                                   ││
│  │  3. Fetch Manifold data                                 ││
│  │  4. Compare prices                                      ││
│  │  5. Calculate arbitrage %                               ││
│  │  6. Return SkillResponse                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Returns:                                                   │
│  {                                                          │
│    text: "Found 3 arb opportunities...",                    │
│    mood: "BULLISH",                                         │
│    data: [{ market: "...", spread: 5.2 }]                   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Core Tools Available:**
- `read` - Read files
- `edit` - Edit files
- `write` - Write files
- `execute` - Run commands
- Custom skills from workspace

---

### Step 7: Response Generation

```
┌─────────────────────────────────────────────────────────────┐
│  RESPONSE ASSEMBLY                                          │
│                                                             │
│  Tool Result → Back to LLM (if needed) → Final Response     │
│                                                             │
│  Streaming:                                                 │
│  • Block streaming (800-1200 chars per chunk)               │
│  • Prefers paragraph breaks                                 │
│  • Soft chunking for better UX                              │
│                                                             │
│  Session saved to: JSONL transcript file                    │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  GATEWAY → CHANNEL → USER                                   │
│                                                             │
│  Response sent back through same path:                      │
│  Agent → Gateway → Telegram Adapter → User sees message     │
└─────────────────────────────────────────────────────────────┘
```

---

### OpenClaw CLI Commands Reference

**Gateway Management:**
```bash
# Start/Stop/Restart
openclaw gateway start
openclaw gateway stop
openclaw gateway restart

# Status & Health
openclaw gateway status
openclaw gateway status --deep
openclaw gateway status --json

# Run with verbose logging
openclaw gateway --port 18789 --verbose
openclaw gateway --force  # Kill existing listeners

# Install as service
openclaw gateway install
openclaw gateway uninstall
```

**Logs & Diagnostics:**
```bash
openclaw logs --follow          # Tail logs
openclaw status                 # Session health
openclaw status --deep --usage  # Detailed status
openclaw doctor                 # Run diagnostics
openclaw health                 # Gateway health check
```

**Channel Management:**
```bash
openclaw channels status        # Check all channels
openclaw channels status --probe  # With connectivity test
openclaw channels logs          # Recent activity
openclaw channels add           # Add new channel
openclaw channels login         # Interactive login
```

**Agent Operations:**
```bash
# Run single agent turn
openclaw agent --message "text" --to <dest>
openclaw agent --message "text" --session-id user123 --deliver

# Manage agents
openclaw agents list
openclaw agents add [name]
openclaw agents delete <id>
```

**Cron Jobs:**
```bash
openclaw cron add --name "arb-scan" --every 300 --message "Scan for arb"
openclaw cron list
openclaw cron runs --id <id>
```

**Development Mode:**
```bash
openclaw --dev setup              # Initialize dev instance
openclaw --dev gateway            # Run isolated gateway
openclaw --dev status             # Check dev instance
```

---

### BeRight Agent Flow (Specific Implementation)

```
Telegram Message: "/arb bitcoin"
         │
         ▼
┌────────────────────────┐
│ telegramHandler.ts     │  ← Routes commands
│ (dispatcher)           │
└────────────────────────┘
         │
         ├── /arb      → arbitrage.ts
         ├── /markets  → markets.ts
         ├── /whale    → whale.ts
         ├── /intel    → intel.ts
         ├── /research → research.ts
         └── /brief    → heartbeat.ts
                  │
                  ▼
┌────────────────────────┐
│ Skill fetches data:    │
│ • Polymarket API       │
│ • Kalshi API           │
│ • Manifold API         │
│ • Helius (Solana)      │
│ • RSS feeds            │
└────────────────────────┘
                  │
                  ▼
┌────────────────────────┐
│ Returns SkillResponse  │
│ {                      │
│   text: "...",         │
│   mood: "BULLISH",     │
│   data: {...}          │
│ }                      │
└────────────────────────┘
                  │
                  ▼
        User sees response
```

---

### Key Files in BeRight Agent

| File | Purpose |
|------|---------|
| `agent/system.md` | Agent identity + skill registration |
| `AGENTS.md` | Operating instructions for the agent |
| `SOUL.md` | Personality and voice |
| `IDENTITY.md` | Who BeRight is |
| `skills/telegramHandler.ts` | Routes incoming messages to skills |
| `skills/*.ts` | Individual skill implementations |
| `memory/*.json` | Persistent state (positions, watchlist, whales) |
| `config/*.ts` | API endpoints, thresholds, commands |

---

### Session Management

**Session Storage:**
- Sessions stored as JSONL files
- Stable OpenClaw-assigned session IDs
- Transcripts persist across restarts

**Session Context:**
```
┌─────────────────────────────────────────────────────────────┐
│  SESSION CONTEXT                                            │
│                                                             │
│  • Previous messages in conversation                        │
│  • Tool outputs from current session                        │
│  • User identity and preferences                            │
│  • Active workspace state                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Environment & Configuration

**Required Environment Variables:**
```bash
HELIUS_API_KEY=        # Solana RPC for whale tracking
TELEGRAM_BOT_TOKEN=    # Telegram bot token
KALSHI_API_KEY=        # Optional: Kalshi trading
ANTHROPIC_API_KEY=     # Claude API access
```

**Config Files:**
```
~/.openclaw/
├── openclaw.json      # Main configuration
├── skills/            # Managed skills
└── state/             # Gateway state
```

**Workspace Structure:**
```
beright-ts/
├── agent/
│   └── system.md      # Agent identity
├── skills/
│   ├── telegramHandler.ts
│   ├── markets.ts
│   ├── arbitrage.ts
│   └── ...
├── memory/
│   ├── positions.json
│   ├── watchlist.json
│   └── whales.json
├── config/
│   ├── platforms.ts
│   ├── thresholds.ts
│   └── commands.ts
├── AGENTS.md
├── SOUL.md
├── IDENTITY.md
└── CLAUDE.md
```

### OpenClaw Configuration for BeRight

```json5
// ~/.openclaw/openclaw.json
{
  "gateway": {
    "mode": "local",
    "port": 18789
  },

  "agents": {
    "list": [{
      "id": "beright",
      "workspace": "~/Desktop/openclaw/beright-ts",
      "model": {
        "primary": "anthropic/claude-sonnet-4"
      }
    }]
  },

  "channels": {
    "telegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "allowFrom": ["*"],  // or specific user IDs
      "customCommands": [
        "/brief", "/hot", "/arb", "/research",
        "/predict", "/me", "/leaderboard", "/whale"
      ]
    }
  },

  "cron": {
    "enabled": true,
    "jobs": [
      {
        "name": "morning-brief",
        "cron": "0 8 * * *",  // 8am daily
        "deliver": { "channel": "telegram" },
        "systemEvent": "Generate and send morning brief"
      },
      {
        "name": "arb-scanner",
        "every": 300000,  // 5 minutes
        "isolated": true,
        "systemEvent": "Scan for arbitrage opportunities"
      }
    ]
  },

  "tools": {
    "profile": "coding",
    "allow": ["Bash", "Read", "Write", "WebFetch"]
  }
}
```

---

## Part 5: Complete System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACES                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Telegram   │  │   Web App    │  │   Twitter    │  │    API      │ │
│  │   Bot        │  │   (Next.js)  │  │   Bot        │  │   Clients   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    OPENCLAW GATEWAY                                  ││
│  │  • Message routing (channel → agent)                                ││
│  │  • Session management                                               ││
│  │  • Auth & rate limiting                                             ││
│  │  • Cron job scheduling                                              ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    BERIGHT AGENT                                     ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           ││
│  │  │   SOUL.md     │  │   AGENTS.md   │  │   USER.md     │           ││
│  │  │   (Identity)  │  │   (Behavior)  │  │   (Context)   │           ││
│  │  └───────────────┘  └───────────────┘  └───────────────┘           ││
│  │                              │                                       ││
│  │                              ▼                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │                    CLAUDE MODEL (Sonnet/Opus)                   │││
│  │  │  • ReAct reasoning loop                                         │││
│  │  │  • Tool selection & execution                                   │││
│  │  │  • Response generation                                          │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SKILLS LAYER (Tools)                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ markets.ts  │ │arbitrage.ts │ │ research.ts │ │  whale.ts   │       │
│  │ ✅ DONE     │ │ ✅ DONE     │ │ ✅ DONE     │ │ ✅ DONE     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  intel.ts   │ │   swap.ts   │ │calibrate.ts │ │  brief.ts   │       │
│  │ ✅ DONE     │ │ ✅ DONE     │ │ ✅ DONE     │ │ 🔨 TODO     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │   EXTERNAL APIs     │  │   INTERNAL STORAGE  │                       │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │                       │
│  │  │  Polymarket   │  │  │  │   Supabase    │  │                       │
│  │  │  Kalshi       │  │  │  │  (PostgreSQL) │  │                       │
│  │  │  Manifold     │  │  │  │  • Users      │  │                       │
│  │  │  Jupiter      │  │  │  │  • Predictions│  │                       │
│  │  │  Helius       │  │  │  │  • Alerts     │  │                       │
│  │  │  News RSS     │  │  │  │  • Sessions   │  │                       │
│  │  └───────────────┘  │  │  └───────────────┘  │                       │
│  └─────────────────────┘  │  ┌───────────────┐  │                       │
│                           │  │    Redis      │  │                       │
│                           │  │  (Cache)      │  │                       │
│                           │  └───────────────┘  │                       │
│                           └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         SOLANA                                       ││
│  │  • Prediction commits (memo program)                                ││
│  │  • Trade execution (Jupiter)                                        ││
│  │  • Wallet tracking (Helius)                                         ││
│  │  • Reputation NFTs (future)                                         ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Recommended Tech Stack

### Core Technologies

| Layer | Technology | Why |
|-------|------------|-----|
| **Agent Runtime** | OpenClaw Gateway | Built-in multi-channel, cron, routing |
| **LLM** | Claude Sonnet 4 | Best reasoning + tool use balance |
| **Frontend** | Next.js 14 (App Router) | SSR, API routes, React ecosystem |
| **Styling** | Tailwind + shadcn/ui | Fast development, dark mode |
| **Database** | Supabase (Postgres) | Free tier, real-time, auth built-in |
| **Cache** | Upstash Redis | Serverless, rate limiting |
| **Auth** | Privy | Best Web3 wallet connect UX |
| **Hosting** | Vercel | Free, instant deploys, edge |
| **Blockchain** | Solana + Helius | Fast, cheap, great APIs |
| **Swaps** | Jupiter Lite API | No auth needed, reliable |

### Why These Choices?

**OpenClaw over custom bot:**
- Multi-channel support out of box
- Cron jobs built in
- Session management handled
- Model switching easy

**Supabase over Firebase:**
- PostgreSQL (better for analytics)
- Free tier generous
- Real-time subscriptions
- Row Level Security for multi-tenant

**Privy over RainbowKit:**
- Email + social login fallback
- Embedded wallets for new users
- Better mobile experience

**Vercel over AWS:**
- Zero config deploys
- Edge functions for speed
- Free tier sufficient for MVP

---

## Part 7: Skill Design Pattern

### Anatomy of a BeRight Skill

```typescript
/**
 * Skill Template for BeRight Protocol
 *
 * Each skill follows this pattern:
 * 1. Single responsibility (one problem)
 * 2. Returns SkillResponse (text + mood + data)
 * 3. Has CLI interface for testing
 * 4. Handles errors gracefully
 */

import { SkillResponse } from '../types';

// Configuration constants
const CONFIG = {
  API_ENDPOINT: 'https://api.example.com',
  TIMEOUT_MS: 10000,
  CACHE_TTL: 300,
};

// Internal types
interface SkillInput {
  query: string;
  options?: SkillOptions;
}

interface SkillOptions {
  limit?: number;
  platform?: string;
}

// Core logic (pure function, easy to test)
async function executeSkill(input: SkillInput): Promise<SkillData> {
  // 1. Validate input
  // 2. Fetch data
  // 3. Process/transform
  // 4. Return structured data
}

// Formatting (separate from logic)
function formatOutput(data: SkillData): string {
  // Convert data to human-readable Telegram/Discord format
}

// Main export (what the agent calls)
export async function skillName(
  query: string,
  options?: SkillOptions
): Promise<SkillResponse> {
  try {
    const data = await executeSkill({ query, options });
    const text = formatOutput(data);

    return {
      text,
      mood: determineMood(data),
      data,
    };
  } catch (error) {
    return {
      text: `Error: ${error.message}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  skillName(args[0]).then(r => console.log(r.text));
}
```

### Skills Should Be:

1. **Focused** - One skill, one problem
2. **Testable** - CLI interface for manual testing
3. **Composable** - Skills can call other skills
4. **Cacheable** - Expensive operations should cache
5. **Observable** - Log important operations

---

## Part 8: Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions table
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  question TEXT NOT NULL,
  platform TEXT,
  market_url TEXT,
  predicted_probability DECIMAL(4,3) NOT NULL,
  direction TEXT CHECK (direction IN ('YES', 'NO')),
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolves_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome BOOLEAN,
  brier_score DECIMAL(6,4),
  on_chain_tx TEXT  -- Solana tx signature for verification
);

-- Alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  market_id TEXT,
  market_title TEXT,
  condition_type TEXT CHECK (condition_type IN ('price_above', 'price_below', 'arb_spread')),
  threshold DECIMAL(4,3),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.wallet_address,
  COUNT(p.id) as total_predictions,
  COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL) as resolved_predictions,
  AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as avg_brier_score,
  COUNT(p.id) FILTER (WHERE (p.direction = 'YES') = p.outcome) as correct_predictions,
  COUNT(p.id) FILTER (WHERE (p.direction = 'YES') = p.outcome)::DECIMAL /
    NULLIF(COUNT(p.id) FILTER (WHERE p.outcome IS NOT NULL), 0) as accuracy
FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.wallet_address
ORDER BY avg_brier_score ASC NULLS LAST;

-- Indexes for performance
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_alerts_user_active ON alerts(user_id) WHERE is_active = true;
```

---

## Part 9: API Design

### RESTful Endpoints

```typescript
// /api/brief - Morning brief
GET  /api/brief
Response: { text: string, markets: Market[], alerts: Alert[] }

// /api/markets - Market data
GET  /api/markets?search=bitcoin&platform=polymarket&limit=20
Response: { markets: Market[] }

// /api/markets/[id]/compare
GET  /api/markets/fed-rate-cut/compare
Response: { platforms: { polymarket: 67, kalshi: 59, manifold: 64 } }

// /api/predictions - User predictions
POST /api/predictions
Body: { question, probability, direction, reasoning }
Response: { prediction: Prediction }

GET  /api/predictions?user_id=xxx&status=pending
Response: { predictions: Prediction[] }

// /api/predictions/[id]/resolve
POST /api/predictions/[id]/resolve
Body: { outcome: 'YES' | 'NO' }
Response: { prediction: Prediction, brierScore: number }

// /api/leaderboard
GET  /api/leaderboard?timeframe=week&limit=100
Response: { users: LeaderboardEntry[] }

// /api/alerts
POST /api/alerts
Body: { market_id, condition_type, threshold }
Response: { alert: Alert }

// /api/user/stats
GET  /api/user/stats
Response: { brierScore, accuracy, streak, rank, achievements }
```

---

## Part 10: Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION SETUP                                 │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    VERCEL (Web + API)                             │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │   │
│  │  │  Next.js App   │  │   API Routes   │  │  Cron Functions│      │   │
│  │  │  (Dashboard)   │  │  (/api/*)      │  │  (8am brief)   │      │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    YOUR MACHINE (Agent)                           │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │              OPENCLAW GATEWAY                               │  │   │
│  │  │  • Telegram bot connection                                  │  │   │
│  │  │  • BeRight agent (skills, memory, persona)                  │  │   │
│  │  │  • Claude API calls                                         │  │   │
│  │  │  • Cron jobs (arb scan, whale watch)                        │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE (Database)                            │   │
│  │  • Users, Predictions, Alerts                                     │   │
│  │  • Real-time subscriptions                                        │   │
│  │  • Row Level Security                                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    UPSTASH (Redis)                                │   │
│  │  • Rate limiting                                                  │   │
│  │  • Session cache                                                  │   │
│  │  • Market data cache                                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 11: Best Practices Summary

### From Research

1. **Start Simple** - Single Agent + Tools achieves 90% of complex architectures at 50% cost
2. **Limit Tools to 8-10** - Performance degrades beyond this
3. **Use Scratchpad** - Summarize observations, don't dump raw output
4. **Implement Retries** - Strategic retries match complex architecture performance
5. **Separate Concerns** - Logic, formatting, and CLI in each skill
6. **Cache Aggressively** - External API calls should be cached
7. **Log Everything** - Predictions, tool calls, errors for debugging

### Specific to BeRight

1. **Calibration is Core** - Every prediction tracked, Brier score calculated
2. **Cross-Platform First** - Always show Polymarket + Kalshi + Manifold
3. **Mobile-Friendly Output** - Telegram/Discord formatting constraints
4. **Fail Gracefully** - If one platform API fails, show others
5. **Explain Reasoning** - Superforecaster methodology in every analysis

---

## Part 12: Implementation Roadmap

### Phase 1: Core Agent (Days 1-3)
```
✅ Skills layer complete
🔨 Morning brief generator
🔨 Telegram bot integration
🔨 Basic web dashboard
```

### Phase 2: Gamification (Days 4-5)
```
🔨 Prediction tracking (DB)
🔨 Leaderboard
🔨 Streaks + achievements
🔨 Alpha alerts
```

### Phase 3: Polish (Days 6-7)
```
🔨 Social sharing
🔨 Portfolio tracker
🔨 Demo video
🔨 Deploy
```

### Phase 4: Scale (Post-MVP)
```
📋 On-chain prediction commits
📋 Prediction staking
📋 Reputation NFTs
📋 Multi-agent coordination
```

---

## Conclusion

**The optimal architecture for BeRight is:**

1. **OpenClaw Gateway** for multi-channel + agent runtime
2. **Single Agent + Tools (ReAct)** pattern for reasoning
3. **Next.js + Supabase** for web + database
4. **Privy** for wallet auth
5. **Vercel** for hosting

This gives us:
- ✅ Production-ready agent infrastructure
- ✅ Multi-channel (Telegram, Web, future: Discord)
- ✅ Reasonable cost (Claude Sonnet, not Opus)
- ✅ Fast iteration (simple architecture)
- ✅ Path to scale (can add complexity later)

**Start simple. Ship fast. Add complexity only when needed.**

---

## Sources

- [The Ultimate Guide to AI Agent Architectures 2025](https://dev.to/sohail-akbar/the-ultimate-guide-to-ai-agent-architectures-in-2025-2j1c)
- [IBM - What is a ReAct Agent](https://www.ibm.com/think/topics/react-agent)
- [Model Context Protocol Docs](https://modelcontextprotocol.io/docs)
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit)
- [OpenClaw Documentation](https://docs.openclaw.ai)
