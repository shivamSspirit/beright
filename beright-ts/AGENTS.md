# BeRight Multi-Agent System

*Auto-generated from config/agents.ts and config/agentConfig.ts*

## Overview

BeRight operates as a **Multi-Agent Orchestrator** with specialized agents for different tasks. The orchestrator delegates to the appropriate agent based on command type and context.

**Architecture:** Command-based delegation with fallback to keyword routing

---

## Agent Roster

| Agent | Model | Role | Rate Limit | Auto-Execute |
|-------|-------|------|------------|--------------|
| **Scout** | claude-sonnet-4-5 | Fast scanning, arb detection | 100/hr, 1000/day | Yes |
| **Analyst** | claude-opus-4-5 | Deep research, probability | 10/hr, 50/day | No |
| **Trader** | claude-sonnet-4-5 | Trade execution, risk mgmt | 5/hr, 20/day | No |
| **Builder** | claude-opus-4-5 | Autonomous code generation | 3/hr, 20/day | Yes |
| **Poster** | claude-sonnet-4-5 | Forum engagement | 3/hr, 10/day | Yes |

---

## Agent Specifications

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

## Command Routing

| Command | Agent | Description |
|---------|-------|-------------|
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

---

## Spawn Allowlist

Only these agents can be spawned:

```
scout, analyst, trader, builder, poster
```

---

## Multi-Agent Coordination

**Coordination Interval:** Every 5 minutes

**Conflict Resolution:**
- Priority-based: Higher priority goals win
- Negotiation: Agents can negotiate goal reassignment
- Escalation: Unresolved conflicts escalate to orchestrator

**Goal Management:**
- Scout: Max 10 concurrent goals
- Analyst: Max 3 concurrent goals
- Trader: Max 2 concurrent goals
- Builder: Max 2 concurrent goals

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
