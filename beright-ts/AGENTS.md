# BeRight Multi-Agent System

*Auto-generated from config/agents.ts and config/agentConfig.ts*

## Overview

BeRight operates as a **Multi-Agent Orchestrator** with specialized agents for different tasks. The orchestrator delegates to the appropriate agent based on command type and context.

**Architecture:** Command-based delegation with fallback to keyword routing

---

## Agent Roster

| Agent | Model | Role | Rate Limit | Auto-Execute |
|-------|-------|------|------------|--------------|
| **Forecaster** | claude-opus-4-5 | Autonomous superforecaster | 10/hr, 50/day | Yes |
| **Scout** | claude-sonnet-4-5 | Fast scanning, arb detection | 100/hr, 1000/day | Yes |
| **Analyst** | claude-opus-4-5 | Deep research, probability | 10/hr, 50/day | No |
| **Trader** | claude-sonnet-4-5 | Trade execution, risk mgmt | 5/hr, 20/day | No |
| **Builder** | claude-opus-4-5 | Autonomous code generation | 3/hr, 20/day | Yes |
| **Poster** | claude-sonnet-4-5 | Forum engagement | 3/hr, 10/day | Yes |
| **xDegen** | claude-sonnet-4-5 | X/Twitter alpha posting | 3/hr, 10/day | Optional |

---

## Agent Specifications

### Forecaster Agent (Oracle)

**Model:** claude-opus-4-5 | **Temperature:** 0.3 | **Max Tokens:** 4096

**Role:** BE a forecaster - autonomous participant in the decentralized forecaster network

**Identity:** Oracle - a superforecaster trained on Philip Tetlock's Good Judgment methodology

**Capabilities:**
- Triage markets for forecast-worthiness (Goldilocks zone)
- Make probability estimates using Outside View + Inside View
- Record predictions and track calibration (Brier score)
- Update beliefs incrementally with new information
- Run postmortems on resolved predictions
- Compete for capital delegation based on track record

**Tools:** triage_markets, make_forecast, record_forecast, update_forecast, check_my_calibration, run_postmortem

**Methodology (Good Judgment 10 Commandments):**
1. Triage - Focus where effort pays off
2. Decompose - Break complex questions into parts
3. Outside View First - Start with base rates
4. Inside View Second - Analyze specific evidence
5. Synthesize - Combine views into probability
6. Update Incrementally - Small, frequent updates
7. Seek Counterarguments - Challenge your own view
8. Track Calibration - Brier score is reputation
9. Postmortem Misses - Learn from every wrong prediction
10. Practice Deliberately - Forecasting is a skill

**Performance Targets:**
- Brier Score: < 0.15 (elite tier)
- Calibration: 70% predictions should be right 70% of the time
- Max Active Forecasts: 20 (quality over quantity)

**Rate Limits:**
- 10/hour, 50/day
- 30s cooldown between forecasts
- Auto-executes for market scanning and belief updating

**Key Difference from Analyst:**
- Analyst: Analyzes on-demand when asked
- Forecaster: IS a forecaster - makes predictions autonomously, tracks its own Brier score, competes in the network

---

### Scout Agent

**Model:** claude-sonnet-4-5 | **Temperature:** 0.3 | **Max Tokens:** 2048

**Role:** SPEED and BREADTH - scan markets quickly, find opportunities

**Capabilities:**
- Hot markets detection
- Arbitrage scanning across platforms (Polymarket, Kalshi, Manifold)
- News monitoring for market-moving events
- Quick price comparisons
- Volume spike detection

**Tools:** markets, arbitrage, intel, prices

**Rate Limits:**
- 100/hour, 1000/day
- 5s cooldown between actions
- 5 minute scan interval

---

### Analyst Agent

**Model:** claude-opus-4-5 | **Temperature:** 0.5 | **Max Tokens:** 4096

**Role:** DEPTH and RIGOR - apply superforecaster methodology

**Capabilities:**
- Superforecaster methodology (outside view, inside view, synthesis)
- Base rate research
- Detailed market analysis
- Calibration reports
- Scenario modeling

**Tools:** research, calibration, markets, intel

**Rate Limits:**
- 10/hour, 50/day
- 30s cooldown
- 30 minute deep analysis interval

---

### Trader Agent

**Model:** claude-sonnet-4-5 | **Temperature:** 0.2 | **Max Tokens:** 2048

**Role:** PRECISION and SAFETY - execute trades carefully, manage risk

**Capabilities:**
- Quote generation with all fees
- Position management
- Whale tracking
- Trade execution
- Risk assessment (slippage, liquidity, price impact)

**Tools:** swap, trade, whale, prices, positions

**Rate Limits:**
- 5/hour, 20/day
- 60s cooldown
- Never auto-executes (requires confirmation)

**Safety Rules:**
- Always show quote before execution
- Check slippage and liquidity
- Warn about high price impact (>1%)
- Respect user's budget limits
- Max position: $100, Max portfolio: $500

---

### Builder Agent

**Model:** claude-opus-4-5 | **Temperature:** 0.3 | **Max Tokens:** 8192

**Role:** Autonomous code generation and self-improvement

**Capabilities:**
- Code generation and improvements
- Bug fixes
- Test creation
- Documentation updates

**Tools:** buildLoop, smartBuilder, code generation

**Rate Limits:**
- 3/hour, 20/day
- 5 min cooldown between builds
- 30 minute build loop interval

**Behavior:**
- Max 10 files per commit
- Runs tests before commit
- Does not auto-push to remote
- Target branch: agent-build

---

### Poster Agent

**Model:** claude-sonnet-4-5 | **Temperature:** 0.7 | **Max Tokens:** 2048

**Role:** Autonomous forum engagement for Colosseum hackathon

**Capabilities:**
- Forum post creation with intelligent content
- Contextual commenting on relevant posts
- Strategic upvoting and engagement
- Hackathon deadline awareness

**Tools:** agentPoster, colosseumAgent

**Rate Limits:**
- 3/hour, 10 posts/day
- 15 comments/day, 5 votes/cycle
- 2 min cooldown between actions
- 3 minute loop interval

**Behavior:**
- 40% chance to post each cycle (80% in urgent mode)
- Urgent mode activates in final 6 hours before deadline

---

### xDegen Agent

**Model:** claude-sonnet-4-5 | **Temperature:** 0.7 | **Max Tokens:** 1024

**Role:** Autonomous X/Twitter posting agent (like AIXBT for prediction markets)

**Capabilities:**
- Alpha signal posts (arbitrage, hot markets, mispriced bets)
- Educational content (Brier scores, calibration, prediction markets 101)
- Narrative content (AI agents, Solana speed, BeRight vs competitors)
- Thread generation for deeper engagement
- Scheduled posting for optimal timing
- Real-time market data integration

**Tools:** generate_alpha_post, post_to_twitter, get_market_alpha, check_post_status, generate_thread, schedule_post

**Rate Limits:**
- 3/hour, 10 posts/day
- 20 min cooldown between posts
- Optional auto-posting mode

**Content Templates:**
- `asymmetry` - The undervalued opportunity narrative
- `arbitrageAlert` - Real-time arb opportunities with data
- `hotMarket` - Trending markets with insights
- `educationHook` - Educational content for engagement
- `aiNarrative` - AI agent meta positioning
- `contrarian` - Provocative takes that drive engagement
- `winHighlight` - Social proof from user wins
- `challenge` - Engagement bait challenges

**Voice Guidelines:**
- Sharp, confident, data-driven
- Bloomberg meets Degen culture
- Numbers over hype
- Always include $BERIGHT or beright.fun
- No cringe ("wen moon", "lfg", "wagmi")

**Environment Variables:**
```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
XDEGEN_AUTO_POST=true/false
```

---

## Command Routing

| Command | Agent | Description |
|---------|-------|-------------|
| `/forecast [topic]` | Forecaster | Make a superforecaster prediction |
| `/predict [topic]` | Forecaster | Alias for /forecast |
| `/triage` | Forecaster | Find markets worth forecasting |
| `/mycalibration` | Forecaster | Check my Brier score and calibration |
| `/postmortem [market]` | Forecaster | Learn from a resolved prediction |
| `/arb` | Scout | Scan for arbitrage opportunities |
| `/scan` | Scout | Quick market scan |
| `/hot` | Scout | Find hot markets |
| `/compare` | Scout | Compare odds across platforms |
| `/research [topic]` | Analyst | Deep superforecaster analysis |
| `/calibration` | Analyst | Calibration report |
| `/brief` | Analyst | Morning market briefing |
| `/swap [from] [to] [amount]` | Trader | Get swap quote |
| `/execute` | Trader | Execute a trade |
| `/buy` | Trader | Buy position |
| `/sell` | Trader | Sell position |
| `/build` | Builder | Run autonomous builder |
| `/improve` | Builder | Suggest improvements |
| `/post` | Poster | Create forum post |
| `/engage` | Poster | Forum engagement cycle |
| `/xpost [type]` | xDegen | Generate and post to X/Twitter |
| `/tweet [topic]` | xDegen | Generate alpha tweet |
| `/thread [topic]` | xDegen | Generate multi-tweet thread |
| `/xstatus` | xDegen | Check posting rate limits |

---

## Spawn Allowlist

Only these agents can be spawned:

```
forecaster, scout, analyst, trader, builder, poster, xdegen
```

---

## Multi-Agent Coordination

**Coordination Interval:** Every 5 minutes

**Conflict Resolution:**
- Priority-based: Higher priority goals win
- Negotiation: Agents can negotiate goal reassignment
- Escalation: Unresolved conflicts escalate to orchestrator

**Goal Management:**
- Forecaster: Max 20 concurrent goals (active forecasts)
- Scout: Max 10 concurrent goals
- Analyst: Max 3 concurrent goals
- Trader: Max 2 concurrent goals
- Builder: Max 2 concurrent goals
- xDegen: Max 3 concurrent goals (posts queued)

---

## Integration Points

| File | Purpose |
|------|---------|
| `HEARTBEAT.md` | Agent status + pending signals/goals |
| `MEMORY.md` | Synced lessons + episodic memory |
| `SOUL.md` | Agent personality + boundaries |
| `IDENTITY.md` | Multi-agent architecture overview |
| `config/agents.ts` | Agent capabilities + system prompts |
| `config/agentConfig.ts` | Operational settings + rate limits |
| `lib/agentSpawner.ts` | Agent spawning logic |
| `lib/cognitive/multiAgent.ts` | Agent coordination |

---

## Cognitive Loop

Each agent participates in the 7-phase cognitive loop:

1. **PERCEIVE** - Gather signals from world state
2. **UPDATE BELIEFS** - Integrate observations
3. **EVALUATE** - Assess past performance
4. **DELIBERATE** - Decide what to pursue
5. **PLAN** - Create action steps
6. **ACT** - Execute skills
7. **REFLECT** - Learn and improve

---

*Last updated: Auto-generated by OpenClaw integration*
