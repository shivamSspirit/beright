# BeRight Protocol

### Stop Guessing. Start Proving.

**Version 1.0 | March 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prediction Markets](#2-prediction-markets)
3. [Market Size & Opportunity](#3-market-size--opportunity)
4. [Problem](#4-problem)
5. [Solution](#5-solution)
6. [Competitive Landscape](#6-competitive-landscape)
7. [BeRight](#7-beright)
8. [Business Model & GTM](#8-business-model--gtm)
9. [Team](#9-team)
10. [Conclusion](#10-conclusion)

---

## 1. Introduction

Prediction markets have emerged as one of the most powerful mechanisms for aggregating human knowledge about future events. When designed correctly, they consistently outperform polls, expert panels, and statistical models in forecasting everything from election outcomes to economic indicators.

Yet despite billions in monthly trading volume, prediction markets remain fragmented, inaccessible, and fundamentally broken for two key participants:

**For forecasters**: There is no way to build a verifiable track record. Skilled predictors cannot prove their ability, cannot attract capital, and cannot monetize their expertise beyond trading their own limited funds.

**For capital allocators**: There is no way to invest in forecasting skill. Investors who recognize the alpha in prediction markets but lack domain expertise have no mechanism to delegate capital to proven forecasters.

**BeRight solves both problems.**

We are building the intelligence and reputation layer for prediction markets—a platform where:

1. **Forecasters** make predictions through an intuitive swipe interface, receive AI fact-checks on their decisions, and build verifiable on-chain track records
2. **Capitalists** browse forecaster profiles, review verified performance metrics, and delegate capital to proven predictors
3. **Both** benefit from a multi-agent AI system that aggregates data, synthesizes research, and executes trades across every major prediction market

Our thesis: **Forecasting skill is an asset class.** BeRight creates the infrastructure to make it tradeable.

---

## 2. Prediction Markets

Prediction markets are platforms where participants trade event contracts—financial instruments that resolve to a fixed payout based on the outcome of a future event. In their simplest form, these are binary contracts (Yes/No), where the market price represents the collective implied probability of an outcome.

For example, if a "Yes" contract trades at $0.65, the market is pricing a ~65% probability that the event will occur.

Structurally, event contracts resemble binary options: they have a fixed payoff, a defined resolution condition, and a time horizon over which information is incorporated into price. What differentiates prediction markets is that the underlying is not a price process, but a *belief process*—probabilities that evolve as new information arrives.

Beyond speculation, prediction markets function as **live forecasting systems**. When liquidity is sufficient and market design is sound, prices aggregate dispersed information more effectively than polls or expert forecasts. Empirical research has repeatedly shown prediction markets to be highly calibrated, particularly in politically, economically, and socially complex domains where traditional forecasting struggles.

### Recent Evolution

For much of their history, prediction markets remained niche—constrained by limited distribution, regulatory uncertainty, and fragmented infrastructure. This changed materially between 2024 and 2025:

- Trading volumes expanded from tens of millions to billions of dollars per month
- User activity spiked during high-volatility news cycles
- Participation broadened beyond crypto-native users toward fintech and institutional audiences

This acceleration has been driven by two structural shifts:

**1. Improved Accessibility**

Better user interfaces, faster on-chain execution, wallet abstraction, and broader event coverage lowered friction for both retail and professional participants.

**2. Rising Demand for Alternative Signal Instruments**

Traders, funds, and information-driven users increasingly seek tools that express views on outcomes rather than proxy assets, especially during periods of political, macroeconomic, or regulatory uncertainty.

### Current Platform Landscape

| Platform | Primary Stack | Market Position |
|----------|---------------|-----------------|
| Kalshi | Regulated DCM (US) | 53% volume share, sports leader |
| Polymarket | Polygon | 47% volume share, transaction leader |
| Jupiter Prediction | Solana | Aggregates Poly+Kalshi, zero fees |
| Limitless | Base (Coinbase L2) | Fast-growing crypto-native |
| Manifold | Off-chain | Play-money experimentation |
| Metaculus | Off-chain | Long-range forecasting |

Two platforms—Kalshi and Polymarket—dominate in visibility and volume, but represent different design philosophies. Kalshi emphasizes regulatory compliance and institutional adoption, while Polymarket targets a crypto-native audience with faster iteration and on-chain composability.

### Structural Fragmentation

As the number of venues increases, the ecosystem becomes increasingly fragmented:

- Identical events are listed across multiple platforms with different pricing
- Liquidity is split across chains, custody models, and settlement mechanisms
- There is no unified view of the "global" market for an event
- Users cannot compare odds without opening multiple tabs and manually researching

This fragmentation creates opportunity for aggregation—but also creates a barrier to participation for anyone without the time or tools to navigate it.

---

## 3. Market Size & Opportunity

### Current State (March 2026)

Prediction markets have entered a period of sustained growth:

| Metric | Value | Context |
|--------|-------|---------|
| Weekly Volume | $5.89B | Week of March 2-8, 2026 |
| Monthly Volume | $17.9B | February 2026 |
| Growth Rate | 9x | From August 2025 to February 2026 |

**Category Breakdown:**

| Category | Weekly Volume | Share |
|----------|---------------|-------|
| Sports | $3.01B | 51% |
| Crypto | $982M | 17% |
| Politics | $574M | 10% |
| Other | $1.34B | 22% |

### Market Projections

From a ~$30B 2025 baseline, the prediction market sector is projected to grow significantly:

| Scenario | CAGR | 2030 Volume | 2035 Volume |
|----------|------|-------------|-------------|
| Conservative | 15% | $60B | $120B |
| **Base Case** | **30%** | **$160B** | **$820B** |
| Aggressive | 60%→30% | $800B | $3.0T |

The base case assumes sustained adoption, regulatory clarity, and integration with mainstream platforms—all trends currently underway.

### Expansion Beyond Crypto-Native Users

Mainstream adoption is accelerating:

- **Polymarket**: ~500K monthly active users during peak cycles
- **Robinhood**: Event contract integration exposing 1M+ users
- **Kalshi**: CFTC-regulated access through traditional brokerage

Conservative estimates place **1-3 million active non-crypto users globally** in early 2026, with significant growth expected as mobile-first UX and wallet abstraction improve.

### Key Catalyst: Jupiter Integration

In February 2026, Jupiter launched Prediction Markets on Solana:

- Aggregates Polymarket + Kalshi liquidity natively
- **Zero payout fees** (vs. 2% on native platforms)
- 400ms finality (vs. 2s on Polygon)
- Chainlink oracles for 5-15 minute crypto markets

This creates a unified execution layer on Solana—and BeRight is built to leverage it.

---

## 4. Problem

Despite rapid growth, prediction markets suffer from three fundamental problems that limit their potential.

### Problem 1: Research Fragmentation

**Users manually research across multiple platforms, opening dozens of tabs to make informed decisions.**

Today, a user who wants to trade on a prediction market must:

1. Open Polymarket, Kalshi, Manifold, and other platforms in separate tabs
2. Search for the same event across each venue
3. Compare prices, liquidity, and fee structures manually
4. Research the underlying question using external news sources
5. Make a decision without any systematic fact-checking
6. Place trades manually on each platform

This process takes **30+ minutes per trade** for a diligent user. Most users skip steps 2-5 and trade blind—leading to poor outcomes and churn.

**The result**: Users either invest excessive time in manual research, or they gamble without adequate information. Neither approach scales.

### Problem 2: Capital Cannot Flow to Skill

**Capitalists who want exposure to prediction market alpha do not need to become domain experts—but today, they have no alternative.**

Prediction markets contain skilled forecasters who consistently outperform. These individuals have developed genuine expertise through years of practice, calibration, and domain knowledge. Their predictions represent real alpha.

But there is no mechanism for capital to find this skill:

- **No verifiable track records**: Platforms track wins/losses internally but don't share. Users cannot prove their skill to others.
- **No portable reputation**: A forecaster's record on Polymarket is invisible on Kalshi. Skill cannot be demonstrated across venues.
- **No delegation infrastructure**: Even if skill could be verified, there's no way for capitalists to invest in forecasters rather than individual predictions.
- **No fee mechanisms**: Skilled forecasters cannot charge for their expertise.

**The result**: A massive market inefficiency. Skilled forecasters are limited to their own capital. Capitalists with capital but no domain expertise cannot access the alpha.

### Problem 3: No DeFi Primitive for Forecasting

**Prediction markets exist as isolated islands—disconnected from the broader DeFi ecosystem.**

Unlike lending protocols, DEXs, or liquid staking, prediction markets have no composability layer:

- Forecasting skill cannot be tokenized or traded
- Prediction positions cannot be used as collateral
- There are no index products for diversified prediction exposure
- Idle capital in prediction markets earns zero yield

**The result**: Prediction markets remain a niche vertical rather than a foundational DeFi primitive.

---

## 5. Solution

BeRight solves these three problems through an integrated platform that combines consumer UX, AI intelligence, and DeFi infrastructure.

### Solution 1: Swipe-to-Predict with AI Fact-Check

**We replace 30 minutes of manual research with a 30-second swipe.**

BeRight's consumer interface is a Tinder-style card deck of prediction markets:

```
┌─────────────────────────────────────────┐
│  🔴 LIVE        MOVING FAST             │
│                                         │
│  Will Bitcoin hit $100K by June 2026?   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ YES 68%  ████████████░░░  NO 32%│    │
│  └─────────────────────────────────┘    │
│                                         │
│  $2.4M volume  •  3d 2h left           │
│  📰 "BTC breaks $95K on ETF inflows"   │
│                                         │
│  Payout: 1.47x if YES wins             │
│                                         │
│     [❌]      [↷]      [✓]              │
└─────────────────────────────────────────┘
```

**The flow:**

1. **Swipe Right (YES) or Left (NO)** — Express your prediction
2. **AI Fact-Check Modal Opens** — Before confirming, see:
   - Supporting evidence for your choice
   - Challenging evidence against your choice
   - AI verdict: "GO FOR IT" / "THINK TWICE" / "COIN FLIP"
   - Source links for further research
3. **Confirm or Change** — Make an informed decision
4. **Prediction Recorded** — Your forecast is committed on-chain

**What makes this different:**

- **Aggregated markets**: Cards pull from Polymarket, Kalshi, Jupiter, Limitless, Manifold—no tab switching
- **Real-time data**: Volume, price trends, time remaining, market consensus
- **AI fact-check**: Every swipe triggers a 30-second research burst (Tavily search + LLM synthesis)
- **Competition**: Your predictions build your forecaster profile and leaderboard ranking

**Result**: Users make better predictions faster, while building verifiable track records.

### Solution 2: Forecaster Network with Delegation

**Capitalists can invest in forecasters, not just predictions.**

BeRight creates the infrastructure for forecasting skill to become an investable asset:

#### Verified On-Chain Profiles

Every forecaster has a Solana PDA storing:

```
ForecasterProfile:
  • Total predictions: 127
  • Resolved predictions: 94
  • Brier score: 0.14 (Elite tier)
  • Accuracy: 68%
  • ROI: +23.4%
  • Calibration: [10-bucket analysis]
  • Streak: 8 consecutive correct
  • Specializations: [crypto_expert, macro_expert]
```

This data is **on-chain and immutable**. It cannot be faked, deleted, or inflated.

#### Reputation Tiers

| Tier | Requirements | Unlocks |
|------|--------------|---------|
| Rookie | 10+ predictions | Basic tracking |
| Verified | 20+ predictions, Brier <0.25 | Create forecaster token |
| Elite | 50+ predictions, Brier <0.18 | Create staking pools |
| Superforecaster | 100+ predictions, Brier <0.12 | Premium features, index inclusion |

#### Capital Delegation

Capitalists browse the leaderboard, review forecaster profiles, and delegate:

```
┌─────────────────────────────────────────────────────────┐
│  FORECASTER: @alice.sol                                 │
│                                                         │
│  Tier: Elite         Brier: 0.14        ROI: +23.4%    │
│  Predictions: 127    Accuracy: 68%      Streak: 8      │
│                                                         │
│  Specializations: 🔮 Crypto Expert  📈 Macro Expert     │
│                                                         │
│  POOL STATS                                            │
│  TVL: $2.4M          30-Day Return: +8.2%              │
│  Delegators: 147     Sharpe Ratio: 2.1                 │
│                                                         │
│  Fee Structure:                                        │
│  • 20% performance fee (high-water mark)               │
│  • 2% annual management fee                            │
│  • Idle capital → Sanctum INF (6.4% APY)              │
│                                                         │
│  [DELEGATE $100]  [VIEW HISTORY]  [COPY TRADES]       │
└─────────────────────────────────────────────────────────┘
```

**How it works:**

1. Forecasters reach Elite tier through verified performance
2. They create staking pools with defined fee structures
3. Capitalists deposit USDC, receive pool share tokens
4. Forecasters deploy capital across prediction markets
5. Profits split: 80% to delegators, 20% to forecaster
6. Idle capital earns yield via Sanctum INF integration

**Result**: Skilled forecasters can attract capital. Capitalists get exposure to forecasting alpha without domain expertise.

### Solution 3: Multi-Agent AI Layer

**An autonomous intelligence system that works 24/7 across every prediction market.**

BeRight deploys a fleet of specialized AI agents built on open-cloud technology:

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                         │
│               (Intent Understanding)                    │
│                      <1 second                          │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   SCOUT     │ │  ANALYST    │ │   TRADER    │
│   Agent     │ │   Agent     │ │   Agent     │
│             │ │             │ │             │
│ • Hot mkts  │ │ • Base rates│ │ • Execution │
│ • Arbitrage │ │ • Evidence  │ │ • Kelly size│
│ • Whales    │ │ • Synthesis │ │ • Risk mgmt │
│ • News      │ │ • Calibrate │ │ • Jupiter   │
│             │ │             │ │             │
│   <2 sec    │ │  5-15 sec   │ │   2-3 sec   │
│   7 tools   │ │   6 tools   │ │  10 tools   │
└─────────────┘ └─────────────┘ └─────────────┘
        │               │               │
        └───────────────┴───────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │     DATA FABRIC       │
            │  (Unified Aggregation)│
            │                       │
            │ Polymarket • Kalshi   │
            │ Jupiter • Limitless   │
            │ Manifold • Metaculus  │
            └───────────────────────┘
```

#### Scout Agent (<2 seconds)

Fast market scanning across all platforms:

- **Hot markets**: What's trending by volume?
- **Arbitrage**: Where are cross-platform price discrepancies?
- **Whale tracking**: What are large wallets doing?
- **News**: What's moving markets right now?

```
User: "Any arbitrage opportunities?"

Scout: Found 3 opportunities:
• Bitcoin ETF: Polymarket 68¢, Kalshi 72¢ (5.9% spread)
• Fed Rate Cut: Manifold 42¢, Polymarket 45¢ (7.1% spread)
• Trump 2028: Kalshi 55¢, Jupiter 52¢ (5.8% spread)
```

#### Analyst Agent (5-15 seconds)

Deep research using Superforecaster methodology:

1. **Outside View**: Find the historical base rate
2. **Inside View**: Gather specific evidence
3. **Synthesis**: Adjust base rate with evidence
4. **Calibration**: Apply confidence adjustments
5. **Edge Calculation**: Compare model vs. market

```
User: "What's the probability of Fed rate cut by June?"

Analyst:
BASE RATE: 52% (historical cuts during similar conditions)
BULLISH: Inflation cooling, employment softening
BEARISH: Core PCE still elevated, Fed rhetoric hawkish
ADJUSTMENT: +6 points (inside view)
FINAL ESTIMATE: 58%
MARKET PRICE: 54%
EDGE: +4% (YES underpriced)
```

#### Trader Agent (2-3 seconds)

Execution and risk management:

- **Position sizing**: Kelly criterion with confidence adjustment
- **Best execution**: Compare prices across all venues
- **Risk checks**: Portfolio concentration, correlation, exposure limits
- **Jupiter execution**: Zero-fee trades on Solana

```
User: "Buy $100 YES on Fed rate cut"

Trader:
Best price: Jupiter (54¢, zero fees)
Kelly size: $85 (half-Kelly, 2% edge)
Risk check: ✓ (12% portfolio, within limits)
Transaction ready: [Sign to execute]
```

**Result**: Users get institutional-grade intelligence and execution without building their own infrastructure.

---

## 6. Competitive Landscape

### How BeRight Differs

| | Polymarket/Kalshi | Arkham Intel | Nansen | **BeRight** |
|---|---|---|---|---|
| **What they do** | Trade predictions | Track wallets | On-chain analytics | **Forecaster network + AI intelligence** |
| **Value prop** | Bet on outcomes | Whale alerts | Portfolio tracking | **Invest in forecaster skill** |
| **Track records** | Internal only | N/A | N/A | **On-chain verified Brier scores** |
| **Delegation** | No | No | No | **Yes (staking pools)** |
| **AI agents** | No | Limited | No | **Multi-agent system (25+ tools)** |
| **Aggregation** | Single platform | N/A | N/A | **5+ platforms unified** |

### Positioning

BeRight is **not** a prediction market. We do not compete with Polymarket or Kalshi for order flow.

BeRight is the **intelligence and capital layer** that makes prediction markets more valuable:

- For **Polymarket/Kalshi**: We bring users who make better-informed trades
- For **Jupiter**: We build the consumer interface for their aggregation layer
- For **Forecasters**: We create the infrastructure to monetize skill
- For **Capitalists**: We provide access to forecasting alpha

**Positioning**: "The Bloomberg Terminal for prediction markets, with skill-based capital allocation."

---

## 7. BeRight

### Product Suite

#### 1. Swipe Interface (Consumer)

Tinder-style prediction cards with:

- Aggregated markets from 5+ platforms
- Real-time pricing, volume, and time remaining
- AI fact-check on every swipe
- Competition leaderboard

#### 2. Forecaster Network (Infrastructure)

On-chain reputation system:

- Brier score tracking per prediction
- Calibration analysis (10-bucket breakdown)
- Tier progression (Rookie → Superforecaster)
- Forecaster tokens (Meteora DAMM v2)
- Staking pools for capital delegation

#### 3. AI Agent Fleet (Intelligence)

Multi-agent system:

- **Orchestrator**: Intent routing (<1s)
- **Scout**: Market scanning (7 tools, <2s)
- **Analyst**: Deep research (6 tools, 5-15s)
- **Trader**: Execution (10 tools, 2-3s)
- **xDegen**: Social content (6 tools, 2-5s)

#### 4. Data Fabric (Aggregation)

Unified market data:

- Polymarket (Gamma API)
- Kalshi (DFlow/polyrouter)
- Jupiter Prediction Markets
- Manifold, Limitless, Metaculus
- 30-second cache refresh

### Technology Stack

| Layer | Technology |
|-------|------------|
| AI/LLM | Claude Opus 4.5 (research), Sonnet 4.5 (speed) |
| Fact-Check | Tavily API (web search) + LLM synthesis |
| Backend | Next.js, TypeScript, Node.js |
| Blockchain | Solana, Anchor programs |
| Database | PostgreSQL (Supabase), Redis cache |
| Wallet | Privy (abstracted onboarding) |
| DEX | Jupiter (execution), Meteora (liquidity) |
| Yield | Sanctum INF (idle capital) |

### On-Chain Architecture

**Calibration Program** (Solana):

```
ForecasterState PDA (~280 bytes):
  - authority: Pubkey
  - total_predictions: u32
  - resolved_predictions: u32
  - avg_brier_score: f64
  - accuracy: f64
  - calibration_buckets: [[u16; 2]; 10]
  - streak_correct: u16
  - created_at: i64

PredictionRecord PDA (~160 bytes):
  - forecaster: Pubkey
  - market_id: [u8; 32]
  - predicted_probability: f64
  - direction: YES/NO
  - resolved: bool
  - outcome: bool
  - brier_score: f64
```

This creates **portable, verifiable forecaster reputation**—the foundation for capital delegation.

---

## 8. Business Model & GTM

### Revenue Streams

**1. SaaS Subscriptions**

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Daily briefs, 5 predictions/month, basic leaderboard |
| Pro | $9.99/mo | Unlimited predictions, real-time alerts, advanced analytics |
| Whale | $49.99/mo | Everything in Pro + whale alerts, custom alerts, API access |

**2. Protocol Revenue (Forecaster Network)**

| Fee | Rate | Source |
|-----|------|--------|
| Performance Fee | 20% of profits | Staking pools |
| Management Fee | 2% annual | AUM |
| Withdrawal Fee | 0.5% | Pool withdrawals |

**3. Additional Revenue**

- API licensing for institutions
- Premium research reports
- Data licensing to funds

### Go-To-Market

**Phase 1: Crypto Native (Current)**

- Primary interface: Telegram bot + Web swipe UI
- Content: Twitter threads on prediction alpha
- Community: Discord for forecaster competition
- Viral hook: Shareable prediction cards with verified track records

**Phase 2: Fintech Adjacent (Q3 2026)**

- Integration with trading platforms
- API partnerships
- Institutional API for hedge funds

**Phase 3: Mainstream (2027)**

- Mobile app (iOS/Android)
- White-label solutions
- Enterprise forecasting products

### Growth Targets

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Daily Active Users | 500 | 5,000 | 25,000 |
| Predictions Made | 5,000 | 100,000 | 1M |
| Pro Subscribers | 50 | 750 | 5,000 |
| Pool TVL | — | $5M | $50M |

---

## 9. Team

**Founder: Shivam Soni**

Full-stack engineer with deep expertise in Solana development, AI systems, and financial technology. Builder of production systems integrating blockchain infrastructure with machine learning pipelines.

**Technical Background:**
- Solana program development (Anchor, Native)
- AI/LLM application architecture
- Prediction market infrastructure
- DeFi protocol design

**Contact:**
- Email: shivam@beright.io
- GitHub: github.com/shivamSspirit
- Twitter: @beright_io

---

## 10. Conclusion

### The Opportunity

Prediction markets are at an inflection point. Monthly volumes have grown from millions to billions. The infrastructure is finally ready for scale.

But prediction markets today are broken:
- Users waste hours on manual research across fragmented platforms
- Skilled forecasters cannot prove their ability or attract capital
- Capitalists cannot access forecasting alpha without becoming domain experts
- The ecosystem lacks DeFi composability

### What BeRight Builds

**For Forecasters**: A swipe interface with AI fact-checking, on-chain reputation tracking, and the ability to monetize skill through capital delegation.

**For Capitalists**: Access to verified forecaster profiles, staking pools, and exposure to prediction market alpha without domain expertise.

**For the Ecosystem**: A multi-agent AI layer that aggregates data, synthesizes research, and executes trades across every major prediction market.

### The Thesis

Prediction markets are a $30B industry growing at 30%+ annually.

The winners will not be those who build another trading venue. The winners will be those who build the **intelligence and capital layer** that makes forecasting skill tradeable.

BeRight is that layer.

**Stop guessing. Start proving.**

---

**BeRight Protocol**
*The Intelligence Layer for Prediction Markets*

beright.io | @beright_io | github.com/beright

---

## Appendix: Key Terms

| Term | Definition |
|------|------------|
| **Brier Score** | Measure of forecast accuracy (lower is better). 0 = perfect, 0.25 = random, 1 = worst |
| **Calibration** | How well predicted probabilities match actual outcome frequencies |
| **Base Rate** | Historical frequency of an event type (outside view) |
| **Kelly Criterion** | Optimal bet sizing formula based on edge and bankroll |
| **PDA** | Program Derived Address—deterministic Solana account for storing data |
| **Superforecaster** | Elite forecaster achieving Brier score <0.12 with 100+ predictions |
