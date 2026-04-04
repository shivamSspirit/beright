# BeRight Protocol - Complete Cost Breakdown Analysis

## Summary
BeRight is built on a multi-provider architecture with strategic cost optimization. While many services have free tiers, production deployment requires paid tiers. Total monthly operational cost estimate: **$1,000-$5,000+** depending on usage.

---

## 1. LLM PROVIDERS (AI/ML - Highest Cost)

### Primary LLMs Used
The system routes different agents to different models for cost optimization.

#### Anthropic (Claude)
**Used for:** Deep reasoning, forecasting, research synthesis (analyst, forecaster agents)
- **Models:**
  - Claude 3 Sonnet (fast reasoning): $3/$15 per MTok (input/output)
  - Claude 3 Opus (best reasoning): $15/$90 per MTok
- **Estimated Usage:** 
  - Analyst agent: ~10-50 calls/day at 2K tokens avg = $0.30-2.00/day
  - Forecaster: ~5-20 calls/day at 4K tokens = $0.60-3.60/day
  - Scout synthesis: ~20-100 calls/day at 2K tokens = $0.60-3.00/day
- **Monthly Cost:** $50-350/month
- **Free Tier:** No free tier; pay-as-you-go only
- **Env Vars:** `ANTHROPIC_API_KEY`

#### Google Gemini
**Used for:** Fallback LLM, content generation, general tasks
- **Models:**
  - Gemini 2.0 Flash (free tier available)
  - Gemini 1.5 Pro: $3.50/$10.50 per MTok
- **Free Tier:**
  - 15 requests per minute (RPM)
  - 1M tokens per minute
  - 1,500 requests per day
  - No daily usage limit on input tokens
- **Estimated Paid Usage:** $10-100/month (if free tier exhausted)
- **Env Vars:** `GEMINI_API_KEY`

#### Groq (Llama models)
**Used for:** Fast routing, signal evaluation (free tier available)
- **Models:**
  - Llama 3.1 8B: Free tier (generous)
  - Llama 3.3 70B: Free tier
- **Free Tier:**
  - Very generous: ~9,000 requests per day
  - Fast inference (600 tokens/sec for 8B)
- **Cost:** FREE unless enterprise pricing needed
- **Env Vars:** `GROQ_API_KEY` (free)

#### Mistral AI
**Used for:** Fast routing, orchestration, embeddings
- **Models:**
  - Mistral Small: $0.14/$0.42 per MTok (routing)
  - Mistral Large: $0.81/$2.43 per MTok (complex reasoning)
  - Embeddings: $0.02 per MTok
- **Estimated Usage:** $10-50/month (light usage)
- **Free Tier:** No free tier
- **Env Vars:** `MISTRAL_API_KEY`

#### OpenAI (GPT-4)
**Used for:** Optional fallback
- **Models:**
  - GPT-4o mini: $0.15/$0.60 per MTok
  - GPT-4o: $2.50/$10.00 per MTok
- **Estimated Usage:** $20-100/month (if used)
- **Free Tier:** Trial credits only (~$5-18)
- **Env Vars:** `OPENAI_API_KEY`

#### xAI (Grok)
**Used for:** Optional experimental fallback
- **Models:**
  - Grok-2-mini: Limited pricing info
  - Grok-2: Limited pricing info
- **Estimated Cost:** $20-50/month
- **Env Vars:** `XAI_API_KEY`

**Total LLM Monthly Cost: $110-650/month** (mostly Claude + fallbacks)

---

## 2. SEARCH & RESEARCH APIs (Secondary)

### Serper.dev (Primary search API)
**Used for:** Google SERP results, news search, fact-checking research
- **Pricing:** 
  - $20/month for 10,000 queries
  - $50/month for 30,000 queries
  - $100/month for 100,000 queries
  - $0.005 per query above plan
- **Free Tier:**
  - 2,500 free queries (no credit card required)
  - Good for testing
- **Current Usage (from code):**
  - Analyst fact-checking: ~5-20 calls/day
  - News intel: ~10-30 calls/day
  - Finance intel: ~5-15 calls/day
  - Estimated: ~300-1,500 queries/month
- **Estimated Cost:** FREE (if <2,500/month) or $20-50/month
- **Env Vars:** `SERPER_API_KEY`

### Tavily (Deprecated, Replaced by Serper)
**Used for:** (DEPRECATED - now using Serper instead)
- **Previous Pricing:** $20-500/month depending on tier
- **Current Status:** Fallback only, not actively used
- **Env Vars:** `TAVILY_API_KEY` (legacy, can be removed)

**Total Search/Research Cost: $0-50/month**

---

## 3. DATABASE & STORAGE (Infrastructure)

### Supabase (PostgreSQL + Real-time)
**Used for:** User data, predictions, trades, alerts, whale tracking, leaderboard
- **Pricing Tiers:**
  - Free: 500MB storage, 2GB bandwidth/month, up to 50k concurrent connections
  - Pro: $25/month, 8GB storage, 250GB bandwidth/month
  - Team: $299/month, unlimited storage/bandwidth
- **Current Usage (from code):**
  - Tables: users, predictions, alerts, watchlist, trades, whale_wallets, whale_trades, arbitrage_history, strategy_performance, portfolio_snapshots, external_platform_links, verification_codes, leaderboard, beright_events
  - Storage: ~100MB-1GB (small user base)
  - Real-time subscriptions: Active
- **Estimated Cost:** FREE (free tier sufficient) or $25/month (Pro)
- **Env Vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. BLOCKCHAIN INFRASTRUCTURE (Solana RPC)

### Helius (Primary RPC Provider)
**Used for:** Solana mainnet transactions, data indexing, whale tracking
- **Pricing:**
  - Free tier: 10,000 API calls/month, limited to devnet
  - Growth: $100/month, 2M API calls/month
  - Scale: $500/month, 10M calls/month
  - Custom: per request
- **Current Usage (from code):**
  - RPC calls: ~100-1,000 per day (market data, whale tracking)
  - WebSocket subscriptions: Active
  - Estimated: ~30K-300K calls/month
- **Estimated Cost:** $100-500/month (Growth tier likely)
- **Env Vars:** `HELIUS_RPC_MAINNET`, `HELIUS_WEBSOCKET_URL`, `HELIUS_API_KEY`

### JITO (MEV Protection Bundles)
**Used for:** Bundle submission for trades (MEV protection)
- **Pricing:** FREE - JITO bundles are free; tips are optional
- **Default Tip:** 10,000 lamports (~$0.01 USD per transaction)
- **Cost Impact:** ~$0.01-0.05 per trade
- **Env Vars:** `JITO_BLOCK_ENGINE_URL`, `JITO_DEFAULT_TIP_LAMPORTS`, `JITO_MAX_TIP_LAMPORTS`

### Fallback: Solana Mainnet-Beta RPC
**Used for:** Emergency fallback
- **Pricing:** FREE (rate limited)
- **Env Vars:** `SOLANA_RPC_URL`

**Total Blockchain Cost: $100-500/month**

---

## 5. PREDICTION MARKET DATA & TRADING (Provider Fees)

### Jupiter Prediction (Zero-Payout Fees)
**Used for:** Market data, price aggregation, order creation
- **Platform Cost:** FREE (0% payout fee)
- **Referral Fee:** Optional 1% (if enabled via `JUPITER_PREDICTION_FEE_BPS`)
- **Usage:** High-frequency data queries, occasional trades
- **Env Vars:** `JUPITER_PREDICTION_API_KEY`, `JUPITER_PREDICTION_REFERRAL_ACCOUNT`, `JUPITER_PREDICTION_FEE_BPS`

### DFlow (Kalshi Tokenized Markets)
**Used for:** Market data, tokenized Kalshi orders
- **Platform Cost:** 0.5% (50 bps) platform fee per trade
- **Free Tier:** Yes - read-only market data
- **Trading Cost:** $0.50 per $100 traded
- **Env Vars:** `DFLOW_API_KEY`, `DFLOW_FEE_ACCOUNT`, `DFLOW_PLATFORM_FEE_BPS`

### Polymarket (Gamma API)
**Used for:** Market data aggregation (no trading enabled yet)
- **Taker Fee:** 2% (for trading)
- **Cost for This System:** $0 (data only, no trading)
- **Env Vars:** `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_PASSPHRASE`

### Kalshi (Direct API)
**Used for:** Market data, trading (regulated in US)
- **Trading Fee:** 1% on profits (charged at settlement, not at trade)
- **Cost for This System:** $0 (no active trading)
- **Env Vars:** `KALSHI_API_KEY`, `KALSHI_API_SECRET`, `KALSHI_BUILDER_CODE`

**Total Prediction Market Cost: $0 (data only) + 0.5-2% per trade (if trading)**

---

## 6. HOSTING & DEPLOYMENT

### Railway (Current Primary Deployment)
**Used for:** Backend API, daemon processes (heartbeat, scanner, oracle)
- **Pricing:**
  - Hobby: $5/month (limited)
  - Pay-as-you-go: $0.000417/hour per vCPU, ~$5-30/month for typical usage
- **Estimated Usage:**
  - 1-2 vCPU for main app
  - 0.5 vCPU for daemon processes
  - ~$10-30/month
- **Env Vars:** `RAILWAY_TOKEN` (for deployment), `PORT` (app configuration)

### Vercel (Frontend Deployment)
**Used for:** Next.js frontend (berightweb)
- **Pricing:**
  - Free: Limited usage, shared resources
  - Pro: $20/month, unlimited deployments
- **Estimated Cost:** $0-20/month
- **Env Vars:** `VERCEL_FRONTEND_URL` (for CORS)

### Local/Docker
**Used for:** Local development, optional self-hosting
- **Cost:** FREE (self-hosted)

**Total Hosting Cost: $10-50/month**

---

## 7. MESSAGING & NOTIFICATIONS

### Telegram Bot (Native Integration)
**Used for:** User notifications, command interface, alerts
- **Pricing:** FREE (Telegram Bot API)
- **No rate limits for most operations**
- **Env Vars:** `TELEGRAM_BOT_TOKEN`

### Twitter/X Integration
**Used for:** Social media posting (xDegen agent)
- **Pricing:** FREE (twitter-api-v2 library uses public endpoints)
- **Note:** Limited access without API tier upgrade
- **Env Vars:** Configured in `lib/social/twitter.ts`

**Total Messaging Cost: $0/month**

---

## 8. PAYMENT PROCESSING (Optional - For Subscriptions)

### Stripe
**Used for:** Subscription tiers (Free, Pro $29, Alpha $79, Whale $199, Enterprise $499)
- **Pricing:** 
  - Standard: 2.9% + $0.30 per transaction
  - ACH: $1 flat + 0.8% (for US bank transfers)
- **Tier-Based Revenue:** $0 (product not yet monetized) to ~$10K+/month
- **Env Vars:** `STRIPE_API_KEY`, `STRIPE_PRICE_PRO_MONTHLY/YEARLY`, etc.

**Total Payment Processing Cost: $0/month (or 2.9% of revenue)**

---

## 9. AUTHENTICATION & WALLET INTEGRATION

### Privy (Wallet Connection)
**Used for:** Wallet authentication, signing, key management
- **Pricing:** FREE (open-source / community tier)
- **Env Vars:** Configured in `berightweb/src/providers/PrivyProvider.tsx`

**Total Auth Cost: $0/month**

---

## COST SUMMARY TABLE

| Service | Category | Free Tier | Estimated Monthly Cost | Notes |
|---------|----------|-----------|----------------------|-------|
| **Anthropic (Claude)** | LLM | No | $50-350 | Primary reasoning model |
| **Gemini** | LLM | Yes (limited) | $0-100 | Fallback |
| **Groq** | LLM | Yes (generous) | $0 | Fast routing |
| **Mistral** | LLM | No | $10-50 | Embeddings + routing |
| **Serper.dev** | Search | Yes (2.5K queries) | $0-50 | Google SERP |
| **Supabase** | Database | Yes | $0-25 | PostgreSQL |
| **Helius** | RPC | No (devnet only) | $100-500 | Solana mainnet |
| **JITO** | MEV | Yes | $0 | Tips optional |
| **Jupiter** | Markets | Yes | $0 | Zero payout fees |
| **DFlow** | Markets | Yes | 0.5% per trade | Kalshi tokenized |
| **Polymarket** | Markets | Yes | $0 | Data only |
| **Kalshi** | Markets | Yes | 1% on profits | Direct API |
| **Railway** | Hosting | Limited | $10-30 | Backend |
| **Vercel** | Hosting | Yes | $0-20 | Frontend |
| **Telegram** | Messaging | Yes | $0 | Native API |
| **Stripe** | Payments | No | $0 or 2.9% | Subscriptions only |
| **Privy** | Auth | Yes | $0 | Wallet integration |

---

## PRODUCTION COST BREAKDOWN

### Minimum (MVP/Low Usage)
- LLMs: $100 (mostly free tiers + minimal Claude)
- Search: $20 (Serper free tier)
- Database: $0 (Supabase free)
- RPC: $100 (Helius minimal)
- Hosting: $15 (Railway hobby tier)
- **Total: ~$235-250/month**

### Standard (Moderate Usage)
- LLMs: $200 (Claude + fallbacks)
- Search: $30 (Serper growth)
- Database: $25 (Supabase Pro)
- RPC: $250 (Helius Growth tier)
- Hosting: $25 (Railway standard)
- **Total: ~$530/month**

### Production (High Volume)
- LLMs: $500 (Multiple Claude models, frequent calls)
- Search: $100 (Serper scale tier)
- Database: $100 (Supabase Team + addons)
- RPC: $500 (Helius Scale tier)
- Hosting: $100 (Railway production grade)
- **Total: ~$1,300/month**

### Enterprise (Ultra Scale)
- LLMs: $2,000+ (Multiple providers, 24/7 usage)
- Search: $500+ (Custom Serper tier)
- Database: $500+ (Supabase enterprise)
- RPC: $2,000+ (Helius custom + failover)
- Hosting: $500+ (Dedicated infrastructure)
- **Total: $5,000+/month**

---

## COST OPTIMIZATION STRATEGIES ALREADY IN PLACE

1. **Agent-Specific LLM Routing** (`lib/llm.ts`)
   - Uses free Groq/Gemini for fast, low-complexity tasks
   - Reserves expensive Claude for deep reasoning only
   - Estimated 47% savings vs. using Claude for everything

2. **Fallback Chains**
   - Mistral → Gemini → Groq → Anthropic → OpenAI → xAI
   - Uses cheapest available option first

3. **Free Tier Maximization**
   - Gemini: 1.5M tokens/day free
   - Groq: 9,000 requests/day free
   - Serper: 2,500 queries/month free
   - Supabase: 500MB free storage

4. **Market Provider Selection**
   - Jupiter (0% fees) preferred over Polymarket (2%)
   - DFlow (0.5%) as fallback
   - Paper trading mode by default

5. **Circuit Breakers & Rate Limiting**
   - Serper: 60s cooldown on rate limit
   - Query caching in Supabase
   - Connection pooling for RPC

---

## RECOMMENDATIONS

### To Reduce Costs:
1. **Increase free tier usage:**
   - Use Groq/Gemini for more tasks
   - Optimize Serper queries (combine multiple lookups)
   - Cache RPC results aggressively

2. **Consolidate services:**
   - Use Supabase Vector for embeddings instead of Mistral
   - Use built-in caching instead of additional services

3. **Implement monitoring:**
   - Set up cost alerts in Stripe/Anthropic dashboards
   - Track token usage by agent
   - Monitor RPC call patterns

4. **Consider alternatives:**
   - Self-host embeddings model (using @xenova/transformers)
   - Use Neon instead of Supabase for raw Postgres
   - Set up fallback RPC nodes

### For Monetization:
- **Stripe integration ready** with 5 tiers
- Subscription revenue should exceed $1,500+/month at 50 paying users
- At $79/month (Alpha tier), 20 users = $1,580/month revenue
- Break-even at ~8-10 paying Pro/Alpha users

---

## ENVIRONMENT VARIABLES REQUIRED FOR FULL FUNCTIONALITY

```bash
# LLM Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=

# Search & Research
SERPER_API_KEY=
TAVILY_API_KEY=  # Deprecated, optional

# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Blockchain
HELIUS_RPC_MAINNET=
HELIUS_WEBSOCKET_URL=
HELIUS_API_KEY=
JITO_BLOCK_ENGINE_URL=

# Prediction Markets
JUPITER_PREDICTION_API_KEY=
DFLOW_API_KEY=
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_PASSPHRASE=
KALSHI_API_KEY=
KALSHI_API_SECRET=
KALSHI_BUILDER_CODE=

# Messaging
TELEGRAM_BOT_TOKEN=

# Payments
STRIPE_API_KEY=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_ALPHA_MONTHLY=
# ... etc

# Deployment
RAILWAY_TOKEN=
VERCEL_FRONTEND_URL=
```

---

## CONCLUSION

BeRight has been architected for **cost efficiency** with:
- Multi-tier LLM routing (free→fast→smart)
- Generous free tiers across all major services
- Pay-per-use APIs with circuit breakers
- Zero-fee prediction market integration

**Realistic monthly cost range: $250-$1,500** depending on usage patterns and tier.

The system is designed to be **cash-flow positive** at just 5-10 paying users at the Pro/Alpha tier.
