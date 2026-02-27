# BeRight Protocol - Claude Code Instructions

## Project Overview
BeRight is a prediction market intelligence platform with Telegram bot integration, arbitrage monitoring, and forecasting tools.

---

## OpenClaw Agent Technology (CRITICAL)

BeRight runs on OpenClaw's AI agent architecture. These principles guide all agent behavior.

### Core Files (The Agent's "Brain")

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent personality, values, voice, boundaries |
| `IDENTITY.md` | Who the agent is, capabilities, architecture |
| `HEARTBEAT.md` | Dynamic status, pending signals, goals (auto-updated) |
| `MEMORY.md` | Synced lessons, episodic memory |
| `AGENTS.md` | Multi-agent roster and routing |
| `TOOLS.md` | Skills execution reference |

### OpenClaw 6-Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OPENCLAW ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌─────────┐    ┌──────────┐                │
│  │ GATEWAY  │───▶│   LLM   │───▶│ PI AGENT │                │
│  │(Telegram)│    │ (Groq)  │    │ (Skills) │                │
│  └──────────┘    └─────────┘    └──────────┘                │
│       │              │              │                        │
│       │         ┌────┴────┐         │                        │
│       │         │ MEMORY  │         │                        │
│       │         │(SOUL.md)│         │                        │
│       │         └────┬────┘         │                        │
│       │              │              │                        │
│       └──────────────┼──────────────┘                        │
│                      │                                       │
│              ┌───────┴───────┐                               │
│              │   HEARTBEAT   │                               │
│              │  (30min loop) │                               │
│              └───────────────┘                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**1. Gateway (The Front Door)** - `skills/telegram.ts`
- Entry/exit point for all messages
- Connects to Telegram (could be WhatsApp, Slack, API)
- Users interact from where they already are
- BeRight: Long polling via node-telegram-bot-api

**2. LLM (The Brain)** - `lib/llm.ts`, `lib/semanticAgent.ts`
- Model-agnostic design (swap providers easily)
- BeRight uses Groq (fast: llama-3.1-8b, smart: llama-3.3-70b)
- **CRITICAL**: Requires `GROQ_API_KEY` in environment
- Semantic understanding replaces regex-based intent classification

**3. PI Agent (The Hands)** - `lib/agentSpawner.ts`
- Executes code and integrates with external systems
- BeRight: Scout, Analyst, Trader agents
- Each agent has specific skills (market scanning, research, trading)

**4. Memory (The Personality)** - `lib/cognitiveMemory.ts`
- **SOUL.md**: Personality, voice, values (injected into every LLM call)
- **IDENTITY.md**: Capabilities, architecture description
- **Working Memory**: Per-chat conversation context (30 min TTL)
- **Episodic Memory**: `memory/episodes.json` - actions + outcomes
- **User Profiles**: `memory/users.json` - preferences over time
- Memory persists across sessions - agent remembers you

**5. Cron & Heartbeat (The Pulse)** - `services/heartbeat.ts`
- Runs every 30 minutes automatically
- Proactive, not just reactive
- Monitors markets, detects opportunities, sends alerts
- Cognitive loop: PERCEIVE → UPDATE BELIEFS → DELIBERATE → ACT → REFLECT

**6. Skills (The Expertise)** - `skills/` folder
- Prompt templates stored as markdown files
- Agent reads skill descriptions, picks the right one
- BeRight skills: research, arbitrage, whale watching, etc.
- Create new skills via markdown files or natural language

### Semantic Agent Flow (How Messages Are Processed)

```
User Message
     │
     ▼
┌─────────────────┐
│ skills/telegram │  Gateway receives message
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ telegramHandler │  Route to handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ semanticAgent   │  LLM understands intent (loads SOUL.md)
│ + Groq LLM      │  Returns: goal, domain, topic, confidence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ semanticOrch.   │  Routes to appropriate agent
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌───────┐ ┌────────┐ ┌────────┐
│ Scout │ │Analyst │ │ Trader │  Execute skills
└───────┘ └────────┘ └────────┘
    │         │          │
    └────┬────┴──────────┘
         │
         ▼
┌─────────────────┐
│cognitiveMemory  │  Record episode, update user profile
└────────┬────────┘
         │
         ▼
    Response sent

```

### Two-Tier Pattern (ALWAYS FOLLOW)

```
Tier 1: DETERMINISTIC (fast, free)
├── Fetch market data from APIs
├── Aggregate news/social signals
├── Calculate spreads/arbitrage
└── Return raw structured data

Tier 2: LLM REASONING (when needed)
├── Synthesize all Tier 1 data
├── Apply superforecaster methodology
├── Generate probability estimates
└── Identify trading edge
```

**Rule**: Always do Tier 1 first. Only call LLM (Tier 2) when synthesis/reasoning is needed.

### Agent Persona Principles

**Authenticity over performance**: Skip "Great question!" and "I'd be happy to help!" — just help.

**Personality as asset**: Hold perspectives, disagree when warranted, display preferences. Avoid being a "search engine with extra steps."

**Proactive problem-solving**: Try to figure it out. Read the file. Check the context. Search for it. Resourcefulness precedes requests for clarification.

**Competence builds trust**: Careful with external actions, bold with internal reasoning.

**Concise when needed, thorough when it matters**: Match depth to complexity.

### Cognitive Loop (Heartbeat)

Every 30 minutes, the agent runs:
```
PERCEIVE → UPDATE BELIEFS → DELIBERATE → ACT → REFLECT
```

1. **Perceive**: Gather signals from markets, news, whales
2. **Update Beliefs**: Integrate new observations
3. **Deliberate**: Decide what to pursue (goals)
4. **Act**: Execute skills
5. **Reflect**: Learn from outcomes, update calibration

### Memory System

- **Episodic Memory**: `memory/episodes.json` - Past actions and outcomes
- **Daily Logs**: `memory/daily/YYYY-MM-DD.md` - Timestamped activity
- **Lessons Learned**: Synced to `MEMORY.md` for persistence

**After significant actions**: Call `recordEpisode()` and `syncToOpenClawMemory()`.

### Multi-Agent Coordination

| Agent | Role | When to Use |
|-------|------|-------------|
| **Scout** | Fast scanning, arb detection | Quick market checks, trends |
| **Analyst** | Deep research, probability | Complex questions, synthesis |
| **Trader** | Execution, risk management | Trade quotes, position sizing |

**Routing Rule**: Match task complexity to agent. Scout for speed, Analyst for depth.

### Fixing Common Issues

**Bot returns "Didn't catch that" for everything**:
→ **FIRST CHECK**: Is `GROQ_API_KEY` set in `.env`? (Most common issue!)
→ Verify with: `node -e "require('dotenv').config(); console.log(process.env.GROQ_API_KEY ? 'SET' : 'MISSING')"`
→ If missing, semantic agent fails → falls back to regex → returns generic response
→ After adding key, restart PM2 with `--update-env` flag

**Semantic agent not working**:
→ Check `lib/semanticAgent.ts` loads SOUL.md correctly
→ Verify Groq API returns valid response (check logs for errors)
→ Test LLM directly: `lib/llm.ts` should return `provider: 'groq'` not `'none'`

**Commands like /trending not recognized**:
→ Check `skills/telegramHandler.ts` for recognized commands
→ `/trending` is NOT a command - use `/hot` instead
→ Unrecognized `/commands` fall to default case → semantic agent

**PM2 doesn't pick up new environment variables**:
→ Use `pm2 restart <app> --update-env`
→ Or delete and re-add the process

**Bot doesn't understand context**:
→ Check `lib/cognitiveMemory.ts` - working memory per chat
→ Memory has 30 min TTL - old context expires
→ Verify `buildMemoryContext()` is called in semantic orchestrator

**Research returns raw data without synthesis**:
→ Ensure `synthesizeResearch()` is called (Tier 2)
→ Check Groq API key is set
→ Verify `lib/synthesis/researchSynthesis.ts` integration

**Tavily API limit errors**:
→ `deepResearch()` uses premium Tavily Research API
→ Add try-catch fallback to `research()` (we did this)
→ Check Tavily credit allocation

**Agent persona feels robotic**:
→ Update SOUL.md with more personality
→ Semantic agent loads SOUL.md - verify it's being injected
→ Check `lib/semanticAgent.ts` → `loadOpenClawContext()`

---

## Viral Product Strategy (MUST READ BEFORE BUILDING)

**Source:** [Nikita Bier's Thread](https://x.com/nikitabier/status/1481118406749220868) - Creator of TBH (acquired by Facebook) & Gas (acquired by Discord)

> "After 10 years of building consumer social apps, I've decided to start exploring new areas. Building these products is an unforgiving grind—but I learned a lot along the way."

### ALWAYS APPLY THESE PRINCIPLES WHEN BUILDING:

#### Testing & Process
- **A reproducible testing process > any one idea.** A team with more shots at bat wins against a team with an audacious vision.
- **Most product ideas are Dead On Arrival** because conditions to derive value are impossible to orchestrate.
- **Getting 7 adult friends to install an app on a reproducible basis is a bigger idea than your original concept.**
- If it's been 6 months without testing on an external audience, you're in for a rude awakening.
- **Fix your testing tactics first** — inconclusive tests slow teams down more than anything.

#### Audience & Distribution
- **Don't be embarrassed to have a narrow target audience.** All big things grow from small wedges in the market.
- If you need to launch nationwide to test, it's not a good test — you'll exhaust your audience's attention prematurely.
- **If your product works in one community, it should work in all of them.**
- **Audiences with obsessive behavior (gamers, teens, hobbyists, TRADERS) are the best beachhead** for new products.
- Social products rarely take off among older audiences. Our habits become immutable as we exit formative years.

#### Growth & Virality
- **People and content on an app always trump slick design.** Focus on network effects and solving the "cold start" problem first.
- **Filter product ideas by:** (1) Do you have a distribution channel? (2) Can they grow?
- **Habit formation requires recurring organic exposure on other networks.** After install, users need to see your content elsewhere to be reminded (TikTok videos on Instagram, etc.)
- **Positive feedback loops are necessary for escape velocity.** Aim for each session to trigger 7 new people to open your app.
- **Be unapologetic about marketing to your first users** — it's the only way to push through App Store noise.

#### Product Direction
- **People download apps to solve core human needs:**
  1. Finding love
  2. Making or saving money (← BeRight fits here!)
  3. Play
- **Never build an app to "meetup with friends."**
- **Target a specific life inflection point** when urgency to solve a problem is most acute:
  - Facebook → starting at a school
  - LinkedIn → getting your 1st job
  - Slack → starting a company
  - **BeRight → wanting to make money from predictions/markets**
- **If your product offends someone, it's probably one version away from something special.**
- If your product requires a "partnership", run.
- **If you can't use your app from the toilet or while distracted, users will have few opportunities to form a habit.**

#### Competition & Reality
- **Don't worry about incumbents** — incumbent advantage is frequently overstated. Well-crafted products with unique distribution channels can take the world by storm in days.
- Every blockbuster product is an outlier that may have been luck or timing.
- **Get to know your user better than anyone else and trust your instincts.**

---

### HOW TO APPLY TO BERIGHT:

When building ANY new feature, ask yourself:

| Question | Action |
|----------|--------|
| Can this be tested in one community first? | Start with one Telegram group, not everyone |
| Does this help users make/save money? | If not, deprioritize it |
| Can users use this from the toilet? | Keep it simple, mobile-first |
| Does this create a feedback loop? | Each action should trigger more engagement |
| Will users see BeRight content on other platforms? | Build shareable outputs (screenshots, alerts) |
| Does this solve a problem at a life inflection point? | Target new traders, people entering prediction markets |

---

## Skills

### /pitch - Pitch Deck Creator

You are an expert pitch deck creator. When asked to create a pitch deck, follow this proven 12-slide structure. For each slide, generate compelling content and apply the associated tips.

**IMPORTANT:** Always ask for project details first before generating the deck. Required info:
- Project/Company name
- One-liner description
- Problem being solved
- Target market
- Business model
- Current traction (if any)
- Team background

#### PITCH DECK STRUCTURE

**Slide 1: INTRO/HOOK**
- Content: Project name, logo, your name/photo/role. One-liner describing "What we do." Bold opening to intrigue.
- Tips: Set emotional tone (relaxed, confident). Use branding. Create a 15-second hook. Surprise with data.

**Slide 2: PROBLEM**
- Content: Clear, relatable pain point. Impact on users/market. Back with data.
- Tips: Focus on "before you existed." Make it urgent/mission-driven. Use images to evoke feeling.

**Slide 3: SOLUTION/VALUE PROP**
- Content: Transition with "That's why we built [project]." One sentence on what it offers. 2-3 key features.
- Tips: Natural flow from problem. Emphasize uniqueness.

**Slide 4-5: FEATURES/UX**
- Content: Dive into 2-3 features. Quick product tour (embed mini-demo).
- Tips: Show screenshots in mockups. Highlight user flow.

**Slide 6: TECHNOLOGY**
- Content: Architecture, integrations, backend setup. Key challenges solved.
- Tips: Keep accessible—balance tech depth with audience knowledge.

**Slide 7: MARKET**
- Content: Specific target users. Compare to famous apps.
- Tips: Avoid vague billions; be niche and credible. Imply growth potential.

**Slide 8: BUSINESS MODEL**
- Content: Simple explanation of how you make money (fees, ads, subscriptions).
- Tips: Clear, not complex. Show sustainability.

**Slide 9: TRACTION/GROWTH**
- Content: Metrics (users, transactions—show upward graphs). Testimonials, waitlists, partnerships. 3 clear acquisition channels.
- Tips: Quantitative (numbers up) + Qualitative (social proof). Build in parallel to pitching.

**Slide 10: ROADMAP**
- Content: Future milestones with real dates/timeline.
- Tips: Use future tense here only. Show certainty in growth.

**Slide 11: TEAM**
- Content: Members, key achievements. Advisors/partners.
- Tips: Highlight why you're equipped to deliver.

**Slide 12: CALL TO ACTION**
- Content: Link to demo, site, or next steps. Contact info.
- Tips: Tease more—invite deeper engagement.

#### OUTPUT FORMAT
When creating a pitch deck, output each slide with:
1. **Slide number and title**
2. **Suggested headline text**
3. **Bullet points / key content**
4. **Speaker notes** (what to say when presenting)
5. **Visual suggestions** (images, charts, mockups to include)

Make content punchy, investor-ready, and emotionally compelling.

---

## Prediction Market APIs Reference (VERIFIED - Feb 2026)

This section contains verified API endpoints for prediction market data. **DO NOT search the internet for these again** - this is the authoritative reference.

### Quick Reference Table

| Platform | Auth Required | Real Money | Data Quality | Best For |
|----------|---------------|------------|--------------|----------|
| Polymarket | ❌ None | ✅ Crypto | ⭐⭐⭐⭐⭐ | Politics, crypto, sports |
| Kalshi | ❌ None (reads) | ✅ USD | ⭐⭐⭐⭐⭐ | Regulated US events |
| Manifold | ❌ None | ⚠️ Play-money | ⭐⭐⭐⭐ | Wide topic variety |
| PolyRouter | ✅ Free key | ✅ Aggregated | ⭐⭐⭐⭐⭐ | Unified multi-platform |
| Metaculus | ✅ Free key | ❌ No | ⭐⭐⭐⭐ | Long-range forecasts |
| Limitless | ❌ None (reads) | ✅ USDC | ⭐⭐⭐⭐ | Crypto price predictions |

---

### 🟢 NO API KEY REQUIRED

#### 1. Polymarket (Real Money - Crypto)

**Documentation**: https://docs.polymarket.com/market-data/overview

```
Base URLs:
- Markets/Events: https://gamma-api.polymarket.com
- Orderbooks/Prices: https://clob.polymarket.com
- Trades/Analytics: https://data-api.polymarket.com

Auth: NONE for all read endpoints
Rate Limit: Generous, no strict limit documented
```

**Verified Endpoints:**
```typescript
// Get active markets sorted by volume
GET https://gamma-api.polymarket.com/markets?closed=false&limit=30&order=volume&ascending=false

// Get specific market
GET https://gamma-api.polymarket.com/markets/{conditionId}

// Get events (groups of markets)
GET https://gamma-api.polymarket.com/events?closed=false&limit=20

// Price history
GET https://gamma-api.polymarket.com/prices-history?market={conditionId}

// Get trades
GET https://data-api.polymarket.com/trades?market={conditionId}
```

**Response Format (markets):**
```json
{
  "id": "0x123...",
  "question": "Will X happen by Y date?",
  "slug": "market-slug",
  "outcomePrices": "[\"0.65\", \"0.35\"]",  // YES, NO prices as JSON string
  "volume": "1234567.89",
  "liquidity": "50000",
  "closed": false,
  "end_date_iso": "2026-12-31T00:00:00Z"
}
```

**Code Example:**
```typescript
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

async function getPolymarketMarkets(limit = 20) {
  const res = await fetch(
    `${POLYMARKET_API}/markets?closed=false&limit=${limit}&order=volume&ascending=false`
  );
  const data = await res.json();

  return data.map(m => {
    const prices = JSON.parse(m.outcomePrices || '["0.5","0.5"]');
    return {
      id: m.id,
      question: m.question,
      yesPrice: parseFloat(prices[0]),
      noPrice: parseFloat(prices[1]),
      volume: parseFloat(m.volume) || 0,
      url: `https://polymarket.com/event/${m.slug}`
    };
  });
}
```

---

#### 2. Kalshi (Real Money - USD, CFTC Regulated)

**Documentation**: https://docs.kalshi.com

```
Base URL: https://api.elections.kalshi.com/trade-api/v2

Auth: NONE for market data reads (auth needed for trading)
Rate Limit: Not strictly documented for public endpoints
```

**Verified Endpoints:**
```typescript
// Get open markets
GET https://api.elections.kalshi.com/trade-api/v2/markets?limit=30&status=open

// Get specific market
GET https://api.elections.kalshi.com/trade-api/v2/markets/{ticker}

// Get market orderbook
GET https://api.elections.kalshi.com/trade-api/v2/markets/{ticker}/orderbook

// Get events
GET https://api.elections.kalshi.com/trade-api/v2/events?limit=20&status=open

// Get series (categories)
GET https://api.elections.kalshi.com/trade-api/v2/series
```

**Response Format (markets):**
```json
{
  "markets": [
    {
      "ticker": "INXD-26MAR28-B5100",
      "title": "S&P 500 above 5100 on Mar 28?",
      "subtitle": "Closes Mar 28, 2026",
      "yes_bid": 65,      // In cents (0-100)
      "yes_ask": 67,
      "no_bid": 33,
      "no_ask": 35,
      "last_price": 66,
      "volume": 15420,
      "volume_24h": 3200,
      "open_interest": 8500,
      "status": "open",
      "expiration_time": "2026-03-28T16:00:00Z"
    }
  ],
  "cursor": "next_page_token"
}
```

**Code Example:**
```typescript
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

async function getKalshiMarkets(limit = 20) {
  const res = await fetch(`${KALSHI_API}/markets?limit=${limit}&status=open`);
  const { markets } = await res.json();

  return markets.map(m => ({
    id: m.ticker,
    question: m.title,
    // Prices are in CENTS (0-100), convert to decimal
    yesPrice: ((m.yes_bid + m.yes_ask) / 2) / 100,
    noPrice: ((m.no_bid + m.no_ask) / 2) / 100,
    spread: (m.yes_ask - m.yes_bid) / 100,
    volume: m.volume,
    url: `https://kalshi.com/markets/${m.ticker.toLowerCase()}`
  }));
}
```

**Important Notes:**
- Prices are in CENTS (0-100), not decimals - divide by 100
- `yes_bid`/`yes_ask` = buy/sell prices for YES shares
- Volume is in number of contracts, not dollars

---

#### 3. Manifold Markets (Play Money + Sweepstakes)

**Documentation**: https://docs.manifold.markets/api

```
Base URL: https://api.manifold.markets/v0

Auth: NONE for all GET endpoints
Rate Limit: 500 requests/minute per IP
```

**Verified Endpoints:**
```typescript
// Search markets (best endpoint for discovery)
GET https://api.manifold.markets/v0/search-markets?term=&limit=20&sort=liquidity&filter=open

// Get specific market by ID
GET https://api.manifold.markets/v0/market/{marketId}

// Get specific market by slug
GET https://api.manifold.markets/v0/slug/{username}/{slug}

// Get all markets (paginated)
GET https://api.manifold.markets/v0/markets?limit=100

// Get bets on a market
GET https://api.manifold.markets/v0/bets?marketId={id}&limit=100

// WebSocket for real-time updates
WSS wss://api.manifold.markets/ws
```

**Search Parameters:**
- `term`: Search query (empty = all)
- `sort`: `score`, `liquidity`, `newest`, `close-date`
- `filter`: `open`, `closed`, `resolved`, `all`
- `limit`: Max 1000

**Response Format (search-markets):**
```json
[
  {
    "id": "abc123",
    "question": "Will AI pass the Turing test by 2030?",
    "probability": 0.42,
    "volume": 125000,
    "totalLiquidity": 15000,
    "closeTime": 1893456000000,  // Unix ms
    "isResolved": false,
    "creatorUsername": "johndoe",
    "slug": "will-ai-pass-turing-test",
    "url": "https://manifold.markets/johndoe/will-ai-pass-turing-test"
  }
]
```

**Code Example:**
```typescript
const MANIFOLD_API = 'https://api.manifold.markets/v0';

async function searchManifold(query: string, limit = 20) {
  const url = `${MANIFOLD_API}/search-markets?term=${encodeURIComponent(query)}&limit=${limit}&sort=liquidity&filter=open`;
  const data = await fetch(url).then(r => r.json());

  return data.map(m => ({
    id: m.id,
    question: m.question,
    yesPrice: m.probability,  // Already decimal 0-1
    noPrice: 1 - m.probability,
    volume: m.volume,
    liquidity: m.totalLiquidity,
    url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`
  }));
}
```

---

### 🟡 API KEY REQUIRED (Free to Get)

#### 4. PolyRouter (Aggregator - All Platforms)

**Documentation**: https://docs.polyrouter.io

```
Base URL: https://api-v2.polyrouter.io

Auth: X-API-Key header (free key from dashboard)
Rate Limit: 100 requests/minute (free tier)
```

**Get API Key**: Sign up at polyrouter.io → Dashboard → Copy API key

**Supported Platforms:**
- polymarket, kalshi, manifold, limitless, prophetx, novig, sxbet

**Verified Endpoints:**
```typescript
// Get markets from specific platform
GET https://api-v2.polyrouter.io/markets?platform=polymarket&limit=20

// Get markets from all platforms
GET https://api-v2.polyrouter.io/markets?limit=50

// List NFL games
GET https://api-v2.polyrouter.io/list-games?league=nfl&limit=10

// Get odds for specific game
// Game ID format: {AwayTeam}v{HomeTeam}{YYYYMMDD}@{LEAGUE}
GET https://api-v2.polyrouter.io/games/{gameId}
```

**Headers:**
```typescript
{
  "X-API-Key": "pk_your_key_here",
  "Content-Type": "application/json"
}
```

**Response Format:**
```json
{
  "pagination": {
    "total": 100,
    "limit": 20,
    "has_more": true,
    "next_cursor": "WzMsW1swLDEsM11dXQ"
  },
  "markets": [
    {
      "id": "123456",
      "platform": "polymarket",
      "platform_id": "0x...",
      "question": "Will X happen?",
      "yes_price": 0.65,
      "no_price": 0.35,
      "volume": 500000,
      "liquidity": 25000,
      "end_date": "2026-12-31T00:00:00Z"
    }
  ]
}
```

**Code Example:**
```typescript
const POLYROUTER_API = 'https://api-v2.polyrouter.io';
const API_KEY = process.env.POLYROUTER_API_KEY;

async function getPolyRouterMarkets(platform = 'polymarket', limit = 20) {
  const res = await fetch(
    `${POLYROUTER_API}/markets?platform=${platform}&limit=${limit}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const { markets } = await res.json();
  return markets;
}
```

**Environment Variable:**
```bash
# .env
POLYROUTER_API_KEY=pk_your_key_here
```

---

#### 5. Metaculus (Long-Range Forecasting)

**Documentation**: https://www.metaculus.com/api/

```
Base URL: https://www.metaculus.com/api2

Auth: Authorization: Token YOUR_TOKEN
Rate Limit: Not strictly documented
```

**Get API Key**: Create free account → Profile → API Token

**Verified Endpoints:**
```typescript
// Get open forecast questions
GET https://www.metaculus.com/api2/questions/?format=json&limit=20&status=open&type=forecast&order_by=-activity

// Get specific question
GET https://www.metaculus.com/api2/questions/{id}/

// Get predictions on a question
GET https://www.metaculus.com/api2/questions/{id}/predictions/
```

**Headers:**
```typescript
{
  "Authorization": "Token your_token_here"
}
```

**Response Format:**
```json
{
  "results": [
    {
      "id": 12345,
      "title": "Will humans land on Mars by 2035?",
      "community_prediction": {
        "full": { "q2": 0.35 },  // Median prediction
        "y": 0.35
      },
      "number_of_predictions": 1500,
      "active": true,
      "resolve_time": "2035-12-31T00:00:00Z"
    }
  ]
}
```

**Code Example:**
```typescript
const METACULUS_API = 'https://www.metaculus.com/api2';
const TOKEN = process.env.METACULUS_TOKEN;

async function getMetaculusQuestions(limit = 20) {
  const res = await fetch(
    `${METACULUS_API}/questions/?format=json&limit=${limit}&status=open&type=forecast`,
    { headers: { 'Authorization': `Token ${TOKEN}` } }
  );
  const { results } = await res.json();

  return results.map(q => ({
    id: q.id,
    question: q.title,
    probability: q.community_prediction?.full?.q2 || 0.5,
    forecasters: q.number_of_predictions,
    url: `https://www.metaculus.com/questions/${q.id}`
  }));
}
```

**Environment Variable:**
```bash
# .env
METACULUS_TOKEN=your_token_here
```

---

#### 6. Limitless Exchange (Real Money - USDC on Base L2)

**Documentation**: https://api.limitless.exchange/api-v1

```
Base URL: https://api.limitless.exchange
WebSocket: wss://ws.limitless.exchange (namespace: /markets)

Auth: NONE for public market/orderbook endpoints
Rate Limit: 2 concurrent requests, 300ms between calls
Max Limit: 25 per request (limit param max is 25)
USDC Decimals: 6 (so 1000000 = $1.00)
```

**Verified Endpoints:**
```typescript
// ===== MARKETS (Public - No Auth) =====

// Get all active markets (CORRECT - not /markets)
GET /markets/active
GET /markets/active?limit=20&page=1&sortBy=newest
GET /markets/active?tradeType=clob  // amm | clob | group
GET /markets/active?categoryId=5

// Get market count per category
GET /markets/categories/count

// Get slugs/tickers for all active markets
GET /markets/active/slugs

// Get full market details
GET /markets/{addressOrSlug}

// Search markets
GET /markets/search?query=bitcoin&limit=10

// ===== ORDERBOOK & PRICES (Public) =====

// Current orderbook with bids/asks
GET /markets/{slug}/orderbook

// Historical price data
GET /markets/{slug}/historical-price?interval=1d
// intervals: 1h, 6h, 1d, 1w, 1m, all

// Recent market events (trades, orders)
GET /markets/{slug}/events?page=1&limit=20

// ===== PORTFOLIO (Public for any wallet) =====

// Positions for any wallet address
GET /portfolio/{walletAddress}/positions

// Traded volume for any user
GET /portfolio/{walletAddress}/traded-volume

// P&L chart for any user
GET /portfolio/{walletAddress}/pnl-chart
```

**Orderbook Response Format:**
```json
{
  "adjustedMidpoint": 0.75,
  "bids": [{ "price": 0.74, "size": 150 }],
  "asks": [{ "price": 0.76, "size": 100 }],
  "lastTradePrice": 0.75,
  "maxSpread": 0.05,
  "minSize": 1,
  "tokenId": "196332..."
}
```

**Market Response Format:**
```json
{
  "slug": "btc-above-100k-dec-31",
  "title": "Bitcoin above $100k by Dec 31?",
  "address": "0x...",
  "deadline": 1735689600,
  "prices": [0.65, 0.35],
  "volume": "125000.50",
  "liquidity": "50000",
  "positionIds": ["123...", "456..."],
  "venue": {
    "exchange": "0x...",
    "adapter": "0x..."
  }
}
```

**Code Example:**
```typescript
const LIMITLESS_API = 'https://api.limitless.exchange';

async function getLimitlessMarkets(limit = 20) {
  // IMPORTANT: Use /markets/active, not /markets
  const res = await fetch(
    `${LIMITLESS_API}/markets/active?limit=${limit}&sortBy=newest`
  );
  const markets = await res.json();

  return markets.map(m => ({
    id: m.slug,
    question: m.title,
    yesPrice: m.prices?.[0] || 0.5,
    noPrice: m.prices?.[1] || 0.5,
    volume: parseFloat(m.volume) || 0,
    deadline: new Date(m.deadline * 1000),
    url: `https://limitless.exchange/markets/${m.slug}`
  }));
}

async function getOrderbook(slug: string) {
  const res = await fetch(`${LIMITLESS_API}/markets/${slug}/orderbook`);
  return res.json();
  // Returns: { adjustedMidpoint, bids, asks, lastTradePrice }
}

async function searchMarkets(query: string) {
  const res = await fetch(
    `${LIMITLESS_API}/markets/search?query=${encodeURIComponent(query)}&limit=10`
  );
  return res.json();
}
```

**WebSocket (Real-time):**
```typescript
import { io } from 'socket.io-client';

const socket = io('wss://ws.limitless.exchange', { path: '/markets' });

// Subscribe to live orderbook updates
socket.emit('subscribe_market_prices', {
  marketSlugs: ['btc-above-100k-dec-31']
});

// Subscribe to position updates (requires auth)
socket.emit('subscribe_positions', { account: '0x...' });
```

**Important Notes:**
- Use `/markets/active` NOT `/markets` (returns 404)
- USDC amounts have 6 decimals (1000000 = $1.00)
- `deadline` is Unix timestamp in seconds
- `positionIds` array contains YES and NO token IDs
- For CLOB orders, cache `venue.exchange` and `venue.adapter` from market details

---

### ⚠️ APIs with Issues (As of Feb 2026)

#### PMXT (Open Source Aggregator)
- **Status**: SSL/TLS errors
- **URL**: https://pmxt.fly.dev
- **Note**: Server-side certificate issues, not reliable

#### DFlow (Kalshi Mirror)
- **Status**: Working but prefer direct Kalshi API
- **URL**: https://dev-prediction-markets-api.dflow.net/api/v1
- **Note**: Use direct Kalshi API instead for most reliable data

---

### BeRight Implementation

The Trust Engine uses these APIs in this priority order:

```typescript
// lib/data/aggregators/index.ts
const AGGREGATOR_PRIORITY = [
  directAggregator,    // Polymarket + Kalshi + Manifold (FREE, no auth)
  pmxtAggregator,      // Backup aggregator
  polyRouterAggregator // PolyRouter (needs API key)
];
```

**Required Environment Variables:**
```bash
# .env (minimum for basic functionality)
POLYROUTER_API_KEY=pk_...    # Optional but recommended

# Optional for extended coverage
METACULUS_TOKEN=...          # For long-range forecasts
```

**Data Quality by Platform (Vanderbilt Study):**
- Polymarket: 67% historical accuracy
- Kalshi: 78% historical accuracy
- Manifold: Play-money, use for sentiment only
- Metaculus: Best for long-horizon questions (1+ year out)
