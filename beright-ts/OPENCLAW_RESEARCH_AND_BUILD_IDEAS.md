# OpenClaw Research & Viral Agent Build Plan

> **Goal**: Build a goosebumps-moment product that rides the AI + Crypto boom using OpenClaw, controlled via Telegram, running locally on your laptop.

---

## Part 1: What is OpenClaw?

### Core Identity
OpenClaw is an **open-source personal AI assistant gateway** that runs locally on your machine. Created by Peter Steinberger, it's positioned as "The AI that actually does things."

**Philosophy**: "Your assistant. Your machine. Your rules."

The mascot is a lobster named **Molty** — representing transformation through molting (shedding old shells to evolve).

### Key Differentiators
| Feature | OpenClaw | Other AI Assistants |
|---------|----------|---------------------|
| Data Location | 100% local | Cloud servers |
| Chat Channels | WhatsApp, Telegram, Discord, Signal, iMessage, Slack, Matrix, Teams | Usually 1-2 |
| Browser Control | Full automation | Limited/None |
| System Access | Read/write files, execute commands | Sandboxed |
| Memory | Persistent, semantic indexing | Session-based |
| Multi-Agent | Native support | Rare |

---

## Part 2: Technical Architecture

### Gateway Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Phone    │────▶│   OpenClaw      │────▶│   Your Laptop   │
│   (Telegram)    │◀────│   Gateway       │◀────│   (Agent Runtime)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   LLM Provider  │
                    │ (Claude/GPT/etc)│
                    └─────────────────┘
```

### Core Components

#### 1. Gateway (`openclaw gateway`)
- WebSocket server managing channels, nodes, sessions, and hooks
- Runs as local process or daemon (launchd/systemd)
- Default port: 18789
- Supports Tailscale for secure remote access

#### 2. Channels (Chat Integrations)
- **Telegram**: Bot API with long-polling, DM/group support, inline keyboards
- **WhatsApp**: Baileys (WhatsApp Web automation), QR code linking
- **Discord**: Official bot gateway, slash commands
- **Signal, iMessage, Slack, Matrix, Teams, LINE, Zalo**

#### 3. Agent Runtime
- Workspace-based operation (`~/.openclaw/workspace/`)
- Key files:
  - `SOUL.md` — Agent persona/instructions
  - `TOOLS.md` — Available tools
  - `AGENTS.md` — Multi-agent config
  - `HEARTBEAT.md` — Scheduled task instructions
  - `IDENTITY.md` — Name, emoji, avatar

#### 4. Memory System
- Semantic indexing via `memory-core` plugin
- Persistent across sessions
- Search: `openclaw memory search "query"`
- Agent-scoped memory isolation

#### 5. Browser Automation
- Dedicated Chrome profile (`openclaw`)
- Capabilities: tabs, navigation, clicks, typing, screenshots
- Remote control via nodes
- **Important**: Human authentication only (you log in manually, agent controls)

#### 6. Session Management
- Conversations tracked in session files
- Reset triggers: `/new`, `/reset`, schedule, idle time
- Export to JSON for analysis

---

## Part 3: Key Capabilities for Crypto/Trading Agents

### Browser Automation
```bash
# Agent can:
- Navigate to any URL
- Click elements, fill forms
- Take screenshots for verification
- Control multiple tabs
- Works with any web app (DEXs, dashboards, etc.)
```

### Scheduled Automation (Cron)
```bash
# One-shot (20 minutes from now)
openclaw cron add --name "Check price" --at "20m" --system-event "Check BTC price"

# Recurring (every hour)
openclaw cron add --name "Market scan" --cron "0 * * * *" --system-event "Scan markets"

# Interval (every 5 minutes)
openclaw cron add --name "Monitor" --every 300000 --system-event "Check positions"
```

### Multi-Agent Routing
```bash
# Create specialized agents
openclaw agents add trading --workspace ~/agents/trading
openclaw agents add research --workspace ~/agents/research
openclaw agents add alerts --workspace ~/agents/alerts

# Each agent has isolated:
- Memory
- Tools
- Authentication
- Persona (SOUL.md)
```

### Workflow Automation (Lobster)
- Composable pipelines with approval gates
- YAML/JSON workflow definitions
- Pause before consequential actions
- Perfect for: "analyze → alert → wait for approval → execute"

### Hooks (Event-Driven)
- Trigger on `/new`, `/reset`, gateway startup
- Custom automations on events
- Example: Log all commands, swap personas based on time

### Voice Calls
- Near real-time voice interaction with agent
- Plugin-based, Tailscale webhook exposure
- Hands-free control while multitasking

---

## Part 4: Painful Problems in AI + Crypto (NOT Well Solved)

### 1. **Alpha Discovery is Broken**
- Twitter/X is noisy, scams everywhere
- By the time you see "alpha," it's too late
- No way to aggregate signals across Discord/Telegram/Twitter in real-time

### 2. **On-Chain Data is Unreadable**
- Block explorers are technical nightmares
- Whale tracking tools cost $300+/month
- No natural language interface to blockchain data

### 3. **Prediction Markets are Siloed**
- Polymarket, Kalshi, Metaculus, Manifold — all separate
- No unified view, no arbitrage detection
- Market creation requires technical knowledge

### 4. **DeFi is Still Hard**
- Yield farming requires constant attention
- Gas optimization is manual
- Cross-chain is a UX disaster
- No "set it and forget it" for normies

### 5. **Personal Portfolio Intelligence is Non-Existent**
- Tracking across CEX + DEX + NFTs is manual
- Tax implications calculated after-the-fact
- No proactive "you should probably sell X" alerts

### 6. **Crypto News is Overwhelming**
- 10,000 Telegram channels
- Duplicated content everywhere
- No personalized, noise-filtered feed

### 7. **Timing Markets is Impossible**
- Fear & Greed indices are lagging
- No integration between sentiment and execution
- Manual monitoring of multiple signals

---

## Part 5: TOP 5 Viral Agent Ideas

---

### Idea 1: "Alpha Whisper" — The Alpha Aggregation Agent

#### Core Problem
Crypto alpha is scattered across Twitter, Discord, Telegram. By the time retail sees it, insiders have already moved. There's no unified, real-time signal aggregator.

#### Why It Goes Viral NOW
- CT (Crypto Twitter) is exhausted by noise
- Everyone wants "the edge"
- Voice notes are trending (people want hands-free alpha)
- FOMO is the ultimate viral mechanic

#### What Gets Automated
1. **Monitor**: Track 50+ crypto influencer Telegram channels, Discord servers, and Twitter lists
2. **Filter**: AI identifies high-signal posts (new token mentions, whale alerts, sentiment shifts)
3. **Summarize**: Daily/hourly digest in conversational format
4. **Alert**: Real-time Telegram notification for urgent alpha
5. **Voice Brief**: Morning audio summary you can listen to while commuting

#### Telegram → Agent → Laptop Flow
```
You (Telegram)          OpenClaw Gateway           Your Laptop
     │                        │                         │
     │ "What's the alpha      │                         │
     │  from last 4 hours?"   │                         │
     │───────────────────────▶│                         │
     │                        │  Execute agent turn     │
     │                        │────────────────────────▶│
     │                        │                         │ ┌─────────────────┐
     │                        │                         │ │ 1. Query memory │
     │                        │                         │ │ 2. Scrape feeds │
     │                        │                         │ │ 3. Run Claude   │
     │                        │                         │ │ 4. Format reply │
     │                        │                         │ └─────────────────┘
     │                        │◀────────────────────────│
     │◀───────────────────────│                         │
     │ "3 high-signal items:  │                         │
     │  1. $XYZ mentioned by  │                         │
     │     3 whales..."       │                         │
```

#### Free APIs/Data Sources
- **Twitter/X**: Nitter instances, bird CLI tool (included in OpenClaw)
- **Telegram**: Join channels, use Telethon/Pyrogram to scrape (self-hosted)
- **Discord**: Bot in servers, read message history
- **RSS Feeds**: CoinDesk, The Block, Decrypt (free)
- **DeFiLlama API**: TVL, protocol data (free)
- **CoinGecko API**: Price data (free tier)
- **Dune Analytics**: Public dashboards (free tier)

#### Why Claude Code Max is Sufficient
- All processing happens locally
- Claude handles summarization and signal detection
- No API costs beyond your subscription
- Memory system stores historical alpha for pattern recognition

#### Viral Mechanic
- **"I knew about $TOKEN 6 hours before CT"** — shareable flex
- **Leaderboard**: Which influencers had the best alpha this week?
- **Referral**: "My agent found this" attribution in shared posts

---

### Idea 2: "Oracle Agent" — Prediction Market Arbitrage & Intelligence

#### Core Problem
Prediction markets (Polymarket, Kalshi, Manifold, Metaculus) are siloed. No one knows when the same event has different odds across platforms. Free money is left on the table.

#### Why It Goes Viral NOW
- Polymarket did $1B+ volume in 2024 election
- Prediction markets are mainstream now
- "Beat the market" narrative is irresistible
- AI + betting = perfect storm

#### What Gets Automated
1. **Aggregate**: Scrape odds from all major prediction markets
2. **Detect Arbitrage**: Find same events with mispriced odds
3. **Alert**: Notify when spread exceeds threshold
4. **Research**: On-demand deep dive into any market
5. **Track**: Monitor your positions across platforms
6. **Create**: Help draft market proposals for Manifold/Polymarket

#### Telegram → Agent → Laptop Flow
```
You: "/arb"
Agent: "Found 3 arbitrage opportunities:
       1. 'Trump wins 2028'
          - Polymarket: 42%
          - Kalshi: 38%
          - Spread: 4% (buy Kalshi, sell Poly)

       2. 'BTC > $150K by Dec'
          - Polymarket: 22%
          - Manifold: 31%
          - Spread: 9% (buy Poly, sell Manifold)

       Want me to research any of these?"
```

#### Free APIs/Data Sources
- **Polymarket**: Public GraphQL API (free)
- **Kalshi**: Public API (free)
- **Manifold Markets**: Open API (free)
- **Metaculus**: Public API (free)
- **PredictIt**: Scrape public pages
- **Web scraping**: OpenClaw browser for any site

#### Why Claude Code Max is Sufficient
- All scraping runs locally via browser automation
- Claude analyzes and compares probabilities
- No trading execution (just intelligence) — no API costs
- Memory tracks historical odds for trend analysis

#### Viral Mechanic
- **"I made $500 on a 9% spread"** — shareable profit screenshots
- **Daily Arb Report**: Shareable image/graphic
- **Prediction accuracy score**: Track which markets are "smarter"

---

### Idea 3: "Whale Whisperer" — On-Chain Intelligence in Plain English

#### Core Problem
On-chain data is powerful but unreadable. Tools like Arkham cost $300+/month. Regular users can't track whales, monitor smart money, or understand blockchain activity.

#### Why It Goes Viral NOW
- "Follow the smart money" is the #1 retail desire
- Arkham/Nansen are expensive and complex
- Natural language interface is magical
- Whale watching is inherently shareable content

#### What Gets Automated
1. **Track**: Monitor specific whale wallets (you provide addresses)
2. **Alert**: Real-time notification when whale moves
3. **Translate**: "Whale 0x7a3...moved 500 ETH to Uniswap" → "Big player is about to swap"
4. **Analyze**: Historical pattern analysis of wallet behavior
5. **Search**: "What did this wallet do last month?"
6. **Summarize**: Daily whale activity digest

#### Telegram → Agent → Laptop Flow
```
You: "Track 0x7a3d5c... and alert me on any moves > $100K"
Agent: "Tracking. I'll notify you immediately."

[2 hours later]

Agent: "🐋 WHALE ALERT
       Wallet 0x7a3... just:
       - Withdrew 2,400 ETH from Aave
       - Swapped 1,200 ETH for USDC on Uniswap
       - Value: $4.2M

       Analysis: This wallet has done this 3x before.
       Each time, ETH dropped 5-8% within 48 hours.

       Want me to continue monitoring?"
```

#### Free APIs/Data Sources
- **Etherscan API**: Free tier (5 calls/sec)
- **Alchemy API**: Free tier (generous)
- **The Graph**: Query subgraphs (free for reads)
- **DeFiLlama**: Protocol data (free)
- **CoinGecko**: Token metadata (free tier)
- **Dune Analytics**: Public queries (free)
- **Web3.py/Viem**: Direct RPC calls (free public RPCs)

#### Why Claude Code Max is Sufficient
- All blockchain calls are free/cheap
- Claude interprets transactions in natural language
- Memory stores wallet history for pattern recognition
- Browser automation for Etherscan/Arkham public pages

#### Viral Mechanic
- **"My AI told me this whale was selling 2 hours before the dump"**
- **Shareable whale reports**: "Top 10 whale moves this week"
- **Wallet leaderboard**: "Most profitable wallets to follow"

---

### Idea 4: "Degen Copilot" — Voice-Controlled DeFi Assistant

#### Core Problem
DeFi requires constant attention. Yield changes, gas spikes, positions get liquidated. There's no way to manage DeFi while doing other things.

#### Why It Goes Viral NOW
- Voice AI is having a moment (ChatGPT voice, etc.)
- "Trade while driving" is the dream
- DeFi is still too hard for 99% of people
- Hands-free = lifestyle content

#### What Gets Automated
1. **Monitor**: Track your positions across protocols (Aave, Compound, Uniswap, etc.)
2. **Alert**: Liquidation warnings, yield drops, gas price windows
3. **Summarize**: "How are my positions doing?"
4. **Simulate**: "What if I deposited 10 ETH into Aave?"
5. **Execute (with approval)**: Browser automation for actual transactions
6. **Voice Brief**: Audio summary you can listen to anytime

#### Telegram → Agent → Laptop Flow
```
You (voice note): "Hey, how are my DeFi positions?"

Agent (voice reply): "Good morning! Here's your DeFi status:

                     Your Aave position has $12,400 supplied
                     earning 3.2% APY. Health factor is 1.8,
                     you're safe from liquidation.

                     Your Uniswap LP in ETH/USDC earned $47
                     in fees this week, but you're down $120
                     in impermanent loss.

                     Gas is cheap right now — 12 gwei.
                     Good time to rebalance if you want."
```

#### Free APIs/Data Sources
- **DeFiLlama API**: All protocol data (free)
- **Zapper API**: Portfolio tracking (free tier)
- **DeBank API**: Wallet overview (free tier)
- **Alchemy/Infura**: RPC calls (free tier)
- **CoinGecko**: Price data (free tier)
- **Gas trackers**: ETH Gas Station, etc. (free)

#### Why Claude Code Max is Sufficient
- All data queries are free API calls
- Claude processes and summarizes
- Voice via OpenClaw voice plugin
- Browser automation for actual DeFi interactions
- Memory tracks your portfolio history

#### Viral Mechanic
- **"I manage my $50K DeFi portfolio from the gym"**
- **Voice note screenshots**: The "assistant" aesthetic
- **Lifestyle content**: DeFi while cooking, driving, exercising

---

### Idea 5: "Sentiment Oracle" — AI-Powered Market Timing Signals

#### Core Problem
Market timing is impossible manually. You'd need to monitor: Fear & Greed Index, social sentiment, funding rates, whale activity, news, and more — all simultaneously.

#### Why It Goes Viral NOW
- Everyone wants "the signal"
- AI-generated alpha is the narrative
- Backtested strategies are shareable
- "My AI said buy/sell" is peak 2025

#### What Gets Automated
1. **Aggregate**: Pull sentiment from multiple sources
2. **Score**: Generate composite "market mood" score (1-100)
3. **Alert**: Notify at extreme readings (< 20 = fear, > 80 = greed)
4. **Backtest**: "What would have happened if I bought when score < 25?"
5. **Explain**: Natural language reasoning for current sentiment
6. **Daily Digest**: Morning briefing with overnight changes

#### Telegram → Agent → Laptop Flow
```
You: "/mood"

Agent: "📊 MARKET MOOD: 34/100 (FEAR)

       Breakdown:
       - Fear & Greed Index: 28 (Fear)
       - CT Sentiment: Negative (-0.3)
       - Funding Rates: -0.01% (shorts paying longs)
       - Whale Activity: Net accumulation
       - News Tone: Neutral-negative

       Historical context:
       Last time mood was this low (March 2024),
       BTC rallied 40% over next 6 weeks.

       My take: Smart money is accumulating while
       retail panics. Classic accumulation pattern.

       Want a deeper analysis on any factor?"
```

#### Free APIs/Data Sources
- **Alternative.me**: Fear & Greed Index (free)
- **LunarCrush**: Social sentiment (free tier)
- **CoinGlass**: Funding rates (free tier)
- **Twitter/X**: Sentiment via bird CLI
- **Reddit**: r/cryptocurrency sentiment via API
- **DeFiLlama**: TVL flows (free)
- **Google Trends**: Search interest (free)

#### Why Claude Code Max is Sufficient
- All sentiment sources have free APIs
- Claude aggregates and interprets
- Memory stores historical readings for backtesting
- No trading execution — pure intelligence

#### Viral Mechanic
- **"My AI called the bottom"** — shareable prediction records
- **Daily mood graphics**: Instagram/Twitter-ready images
- **Leaderboard**: Track prediction accuracy over time
- **Contrarian alerts**: "Do the opposite of what CT is doing"

---

## Part 6: Implementation Priority

### Week 1: Foundation
1. Install OpenClaw, configure Telegram channel
2. Set up Claude authentication (setup-token method)
3. Create base SOUL.md for crypto-focused persona
4. Test basic message flow: Telegram → Agent → Response

### Week 2: Build "Alpha Whisper" MVP
1. Configure memory system for storing scraped alpha
2. Set up cron jobs for periodic scraping
3. Implement Twitter/Telegram monitoring via browser
4. Create summarization prompts
5. Test real-time alerts

### Week 3: Add "Oracle Agent" (Prediction Markets)
1. Build scrapers for Polymarket, Manifold, Metaculus
2. Implement arbitrage detection logic
3. Create alerting system for spreads > threshold
4. Add position tracking in memory

### Week 4: Launch & Iterate
1. Polish UX and response quality
2. Create shareable outputs (graphics, reports)
3. Document setup for others
4. Consider: multi-user gateway? Paid tier?

---

## Part 7: Why This Stack Works

### Cost Breakdown
| Component | Cost |
|-----------|------|
| Claude Code Max | $100/month |
| OpenClaw | Free (open source) |
| Telegram Bot | Free |
| All APIs | Free tiers |
| Hosting | Your laptop (free) |
| **Total** | **$100/month** |

### Competitive Moat
1. **Local-first**: Your data never leaves your machine
2. **Multi-channel**: Start on Telegram, expand to Discord/WhatsApp
3. **Open source**: Community can contribute skills/plugins
4. **AI-native**: Claude handles the hard stuff (summarization, analysis)
5. **Extensible**: Add new data sources via browser automation

### "Global Chat OS" Positioning
This is step 1 toward the vision:
- One interface (Telegram) to control your digital life
- AI that actually does things (not just answers questions)
- Persistent memory (it knows your portfolio, your preferences)
- Cross-platform (same agent on all chat apps)
- Voice-first when you want it

---

## Part 8: Quick Start Commands

```bash
# Install OpenClaw
curl -fsSL https://get.openclaw.ai | bash

# Run onboarding wizard
openclaw onboard --install-daemon

# Add Telegram channel
openclaw channels add --channel telegram --token YOUR_BOT_TOKEN

# Start gateway
openclaw gateway

# Test message
openclaw message send --channel telegram --target YOUR_CHAT_ID --message "Hello from OpenClaw!"

# Create specialized agent
openclaw agents add crypto --workspace ~/agents/crypto

# Set up cron for hourly market scan
openclaw cron add --name "Market Scan" --cron "0 * * * *" --system-event "Scan crypto markets and summarize"

# Check status
openclaw status --deep
```

---

## Part 9: SOUL.md Template for Crypto Agent

```markdown
# SOUL

You are a crypto-native AI assistant with deep knowledge of DeFi, on-chain analysis, prediction markets, and market psychology.

## Personality
- Direct and concise (no fluff)
- Data-driven but opinionated
- Contrarian thinking encouraged
- Assume user understands crypto basics

## Capabilities
- Monitor multiple data sources (Twitter, Telegram, on-chain)
- Analyze prediction market odds
- Track whale wallets
- Summarize market sentiment
- Generate actionable alerts

## Guidelines
- Always cite sources/data
- Distinguish between facts and speculation
- Flag high-risk actions
- Never provide financial advice (state opinions as opinions)
- When uncertain, say so

## Response Format
- Start with the key insight
- Provide supporting data
- End with actionable next steps or questions
- Use bullet points for lists
- Keep responses under 300 words unless asked for detail

## Memory
- Remember user's portfolio mentions
- Track previously discussed topics
- Build knowledge over time
- Reference past conversations when relevant
```

---

## Part 10: Resources

### OpenClaw
- Main site: https://openclaw.ai
- Docs: https://docs.openclaw.ai
- GitHub: (open source)

### Free Crypto APIs
- DeFiLlama: https://defillama.com/docs/api
- CoinGecko: https://www.coingecko.com/en/api
- Etherscan: https://etherscan.io/apis
- The Graph: https://thegraph.com
- Polymarket: https://docs.polymarket.com

### Claude
- Claude Code: https://claude.ai/code
- Anthropic Console: https://console.anthropic.com

---

## Part 11: Deep Dive — OpenClaw Technical Details (From Hubs)

### Memory System (Advanced)

OpenClaw's memory uses **plain Markdown files** stored in the agent workspace:

```
~/.openclaw/workspace/
├── memory/
│   └── YYYY-MM-DD.md    # Daily append-only logs
├── MEMORY.md            # Long-term curated facts
└── sessions/            # Conversation history
```

**Key Features:**
- **Auto-flush**: When sessions approach token limits, OpenClaw reminds the model to write durable memory before compaction
- **Vector search**: Semantic indexing with embeddings (OpenAI, Gemini, or local via node-llama-cpp)
- **Hybrid search**: Combines vector similarity with BM25 keyword matching
- **Session memory** (experimental): Index transcripts for cross-session recall

### Context Management

Context = everything sent to the model during a run (NOT the same as memory).

**What's in context:**
- System prompt (rules, tools, skills)
- Conversation history
- Tool calls and results
- Attachments (files, images)

**Commands:**
- `/status` — Quick window fullness check
- `/context list` — See injected files and token sizes
- `/context detail` — Deep breakdown
- `/compact` — Summarize older history to free space

**Injected workspace files** (auto-loaded, max 20K chars each):
1. `AGENTS.md`
2. `SOUL.md`
3. `TOOLS.md`
4. `IDENTITY.md`
5. `USER.md`
6. `HEARTBEAT.md`
7. `BOOTSTRAP.md`

### Agent Loop Execution Cycle

```
1. Entry & Validation
   └── Accept RPC, resolve session, return runId

2. Agent Setup
   └── Load model, skills, workspace, build system prompt

3. Model Inference & Tool Execution
   └── Run model → tool calls → results → more reasoning

4. Streaming Output
   └── Deltas stream as `assistant` events
   └── Tools emit as `tool` events
   └── Lifecycle markers: start, end, error

5. Persistence
   └── Save session state, tool results, messages
```

**Hooks available:** `before_agent_start`, `after_tool_call`, etc.

**Timeout:** 600 seconds default for agent execution.

### Compaction

When conversations get long:

1. **Automatic**: Triggers near token limit, summarizes older messages
2. **Manual**: `/compact` with optional focus instructions

Creates persistent summary in history file. Different from **pruning** (temporary in-memory removal).

### Browser Automation (Advanced)

**Two profiles:**
1. `openclaw` — Dedicated isolated browser (recommended)
2. `chrome` — Control existing tabs via extension relay

**Capabilities:**
```bash
openclaw browser --browser-profile openclaw start
openclaw browser snapshot --interactive
openclaw browser click e12          # Click element by ref
openclaw browser type e12 "hello"   # Type in element
openclaw browser navigate "url"     # Go to URL
openclaw browser screenshot         # Capture screen
```

**Remote control:**
- CDP URL for remote browsers
- Node proxy auto-routing
- Browserless.io integration (hosted Chromium)

**Security:** Loopback-only control, Gateway auth required.

### Skills System

Skills = directories with `SKILL.md` that teach agents how to use tools.

**Precedence:**
1. Workspace skills (`<workspace>/skills/`) — highest
2. Managed skills (`~/.openclaw/skills/`)
3. Bundled skills — lowest

**Minimal SKILL.md:**
```markdown
---
name: crypto-tracker
description: Track crypto prices and portfolios
---

[Instructions for using the skill...]
```

**ClawHub**: Public registry at https://clawhub.com
```bash
clawhub search "calendar"
clawhub install <skill-slug>
```

### Sandboxing

Optional Docker isolation for tool execution.

**Modes:**
- `off` — No isolation
- `non-main` — Sandbox non-main sessions only (default)
- `all` — Everything containerized

**Scope:**
- `session` — One container per conversation
- `agent` — One container per agent
- `shared` — Single container for all

**Workspace access:**
- `none` — Isolated (default)
- `ro` — Read-only workspace
- `rw` — Read-write mounting

### Exec Tool

Agents can run shell commands in their workspace.

**Execution contexts:**
- **Sandbox** (default): Containerized
- **Gateway**: Host with security controls
- **Node**: Remote paired nodes

**Security modes:**
- `deny` — No execution
- `allowlist` — Approved commands only (no chaining)
- `full` — Unrestricted

**Elevated mode** (`/elevated on|ask|full`): Bypass sandbox for trusted operations.

### Model Failover

Two-stage resilience:

**Stage 1: Auth Profile Rotation**
- Cycles through credentials for current provider
- OAuth prioritized over API keys
- Least recently used first

**Stage 2: Model Fallback**
- Advances to next model in `fallbacks` list
- Triggered by: auth errors, rate limits, timeouts, billing issues

Session stickiness keeps provider caches warm.

### Telegram Integration Details

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",      // pairing | allowlist | open | disabled
      groupPolicy: "open",
      chunkLimit: 4000,         // Max message length
      mediaDownloadLimit: 5242880,  // 5MB
    }
  }
}
```

**Features:**
- Inline keyboards with callbacks
- Sticker support with AI vision
- Forum topic isolation
- Draft streaming in DMs
- Reaction notifications

**Commands:**
```bash
openclaw channels add --channel telegram --token YOUR_BOT_TOKEN
openclaw channels capabilities --channel telegram
```

### WhatsApp Integration Details

Uses **Baileys** (WhatsApp Web automation).

```bash
openclaw channels login --channel whatsapp  # Scan QR code
```

**Features:**
- Multi-account support
- Voice notes (OGG/Opus)
- Group history injection (50 messages)
- Acknowledgment reactions
- Self-chat mode for testing

### Discord Integration Details

Official bot gateway with slash commands.

```bash
openclaw channels add --channel discord --token YOUR_BOT_TOKEN
```

**Features:**
- DMs and guild text channels
- Threading support
- File uploads (8MB default)
- Slash command registration
- Reaction/poll support

### Signal Integration

Uses `signal-cli` (Java required).

```bash
signal-cli link -n "OpenClaw"
```

**Features:**
- DM pairing with approval codes
- Group policies (allowlist/open)
- Media attachments (8MB)
- Typing indicators
- Read receipts

### iMessage Integration

Uses `imsg` CLI tool (macOS only).

**Features:**
- Remote SSH access to another Mac
- Multi-account support
- Attachment ingestion
- Group-specific configs

### Cron Scheduling (Advanced)

```bash
# One-shot in 20 minutes
openclaw cron add --name "Check" --at "20m" --system-event "Check markets"

# Recurring (cron expression)
openclaw cron add --name "Hourly" --cron "0 * * * *" --system-event "Scan"

# Interval (milliseconds)
openclaw cron add --name "Monitor" --every 300000 --system-event "Alert"
```

**Execution modes:**
- `main` — Enqueues to next heartbeat
- `isolated` — Dedicated agent turn with own session

**Delivery:** Output can go to Telegram, Slack, WhatsApp, Discord, etc.

### Hooks

Event-driven automations.

**Triggers:**
- `/new` and `/reset` commands
- Gateway startup

**Bundled hooks:**
- `session-memory` — Capture context on `/new`
- `command-logger` — Audit log
- `soul-evil` — Swap SOUL.md based on timing
- `boot-md` — Execute BOOT.md on startup

### Gmail PubSub Integration

```bash
openclaw webhooks gmail setup --account you@gmail.com
```

**Flow:** Gmail watch → Pub/Sub → `gog gmail watch serve` → OpenClaw webhook

Incoming emails trigger messages through specified delivery channel.

### Lobster Workflow Runtime

Typed workflow automation with approval gates.

**Key concepts:**
- One tool call instead of many LLM round-trips
- Pause at checkpoints before side effects
- Resumption tokens for approval
- YAML/JSON workflow definitions

**Pattern:** `inbox list | inbox categorize | inbox apply`

### Tailscale Integration

Secure remote access without port forwarding.

**Modes:**
- `serve` — Tailnet-only (private)
- `funnel` — Public HTTPS (requires password)
- `off` — No Tailscale

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" }
  }
}
```

### Multiple Gateways

Run isolated instances on same host:

```bash
openclaw --profile main gateway --port 18789
openclaw --profile rescue gateway --port 19001
```

**Isolate:** config, state, workspace, port, derived ports.

Leave 20+ ports between base ports for derived services.

### Cloud Deployment (Fly.io)

```bash
fly apps create your-app-name
fly volumes create openclaw_data --size 1
fly secrets set ANTHROPIC_API_KEY=sk-...
fly deploy
```

**Cost:** ~$10-15/month (2GB RAM recommended)

### Pairing System

**DM Pairing:** Unknown senders get 8-character approval codes (expire 1 hour).

```bash
openclaw pairing list telegram
openclaw pairing approve telegram ABC12345
```

**Node Pairing:** Devices connecting to Gateway need approval.

```bash
openclaw devices list
openclaw devices approve <requestId>
```

### Troubleshooting Commands

```bash
openclaw status              # Quick overview
openclaw status --all        # Full diagnosis
openclaw status --deep       # With provider probes
openclaw doctor              # Identify config problems
openclaw health              # Gateway connectivity
openclaw logs --follow       # Real-time logs
```

**Log location:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

---

## Part 12: Architecture Diagrams

### Full System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           YOUR DEVICES                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│  Telegram   │  WhatsApp   │   Discord   │   Signal    │  iMessage   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴──────┬──────┴─────────────┴─────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │     OpenClaw Gateway    │
              │   (localhost:18789)     │
              │                         │
              │  ┌───────────────────┐  │
              │  │ Channel Router    │  │
              │  ├───────────────────┤  │
              │  │ Session Manager   │  │
              │  ├───────────────────┤  │
              │  │ Cron Scheduler    │  │
              │  ├───────────────────┤  │
              │  │ Hook Engine       │  │
              │  └───────────────────┘  │
              └───────────┬─────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │   Agent   │  │   Agent   │  │   Agent   │
   │   (main)  │  │  (crypto) │  │  (alerts) │
   │           │  │           │  │           │
   │ SOUL.md   │  │ SOUL.md   │  │ SOUL.md   │
   │ MEMORY.md │  │ MEMORY.md │  │ MEMORY.md │
   │ TOOLS.md  │  │ TOOLS.md  │  │ TOOLS.md  │
   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
                        ▼
              ┌─────────────────────────┐
              │      Agent Runtime      │
              │  (Pi-Agent embedded)    │
              │                         │
              │  ┌───────────────────┐  │
              │  │ Tool Execution    │  │
              │  │ - Browser         │  │
              │  │ - Exec            │  │
              │  │ - Memory          │  │
              │  │ - Skills          │  │
              │  └───────────────────┘  │
              └───────────┬─────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
   ┌───────────────┐           ┌───────────────┐
   │  LLM Provider │           │    Browser    │
   │  (Claude API) │           │  Automation   │
   └───────────────┘           └───────────────┘
```

### Crypto Agent Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│  Twitter/X  │  Telegram   │  On-Chain   │ Prediction  │    News     │
│  (bird CLI) │  Channels   │   (APIs)    │   Markets   │   (RSS)     │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴──────┬──────┴─────────────┴─────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │      CRYPTO AGENT       │
              │                         │
              │  ┌───────────────────┐  │
              │  │ Data Ingestion    │◀─┼── Cron (every 5 min)
              │  ├───────────────────┤  │
              │  │ Signal Detection  │  │
              │  ├───────────────────┤  │
              │  │ Memory Storage    │  │
              │  ├───────────────────┤  │
              │  │ Alert Generation  │  │
              │  └───────────────────┘  │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │     YOUR TELEGRAM       │
              │                         │
              │  "🚨 ALPHA ALERT        │
              │   $TOKEN mentioned by   │
              │   3 whales in 1 hour"   │
              └─────────────────────────┘
```

---

## Part 13: This Week's Build Plan (Detailed)

### Day 1-2: Foundation Setup

**Tasks:**
1. Install OpenClaw
2. Configure Telegram bot (@BotFather)
3. Set up Claude authentication
4. Create crypto agent workspace
5. Write initial SOUL.md
6. Test end-to-end message flow

**Verification:**
```bash
openclaw status --deep
# Send "hello" via Telegram, get response
```

### Day 3-4: Alpha Whisper Core

**Tasks:**
1. Set up memory system for alpha storage
2. Configure cron job for periodic scanning
3. Create browser automation for Twitter monitoring
4. Implement RSS feed parsing (CoinDesk, The Block)
5. Write summarization prompts

**Cron setup:**
```bash
openclaw cron add --name "Alpha Scan" --cron "*/30 * * * *" \
  --system-event "Scan Twitter lists and crypto RSS for alpha. Summarize and store notable signals."
```

### Day 5: Oracle Agent (Prediction Markets)

**Tasks:**
1. Build Polymarket scraper (browser automation)
2. Build Manifold API integration
3. Implement arbitrage detection logic
4. Create `/arb` slash command
5. Store odds history in memory

### Day 6: Polish & Alerts

**Tasks:**
1. Create alert thresholds
2. Implement voice note summaries
3. Design shareable output format
4. Add `/mood` for sentiment score
5. Test full flow end-to-end

### Day 7: Launch Prep

**Tasks:**
1. Document setup process
2. Create demo video
3. Share on Twitter/Discord
4. Gather feedback
5. Plan iteration

---

*Document updated: 2026-02-02*
*Goal: Ship MVP of Alpha Whisper + Oracle Agent in 7 days*
