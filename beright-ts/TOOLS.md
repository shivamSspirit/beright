# TOOLS.md - BeRight Configuration

This file contains BeRight-specific configuration for the OpenClaw agent.

---

## Environment Variables

Location: `.env` file in project root (copy from `.env.example`)

### Required API Keys

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot authentication |
| `ANTHROPIC_API_KEY` | Claude API access (agents) |
| `GROQ_API_KEY` | Groq LLM (fast, free tier) |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key |
| `HELIUS_API_KEY` | Solana RPC access |
| `SOLANA_PRIVATE_KEY` | Wallet for on-chain transactions |

### Optional API Keys

| Variable | Purpose |
|----------|---------|
| `TAVILY_API_KEY` | Web search for research |
| `KALSHI_API_KEY` | Kalshi trading API |
| `KALSHI_API_SECRET` | Kalshi API secret |
| `DFLOW_API_KEY` | DFlow tokenized markets |
| `OPENAI_API_KEY` | Embeddings (optional) |

### Admin Settings

| Variable | Purpose |
|----------|---------|
| `SUPER_ADMIN_TELEGRAM_ID` | Admin notifications (5504043269) |

---

## Skill Execution

All skills run from: `/Users/shivamsoni/Desktop/beright/beright-ts`

| Skill | Command | Description |
|-------|---------|-------------|
| Arbitrage | `npx ts-node skills/arbitrage.ts` | Scan for arb opportunities |
| Research | `npx ts-node skills/research.ts "topic"` | Deep superforecaster analysis |
| Markets | `npx ts-node skills/markets.ts hot` | Hot/trending markets |
| Markets | `npx ts-node skills/markets.ts compare "topic"` | Compare odds |
| Heartbeat | `npx ts-node skills/heartbeat.ts once` | Single heartbeat cycle |
| Heartbeat | `npx ts-node skills/heartbeat.ts loop 60` | Continuous loop (60s interval) |
| Heartbeat | `npx ts-node skills/heartbeat.ts stats` | View agent stats |
| Whale | `npx ts-node skills/whale.ts scan` | Whale wallet activity |
| Intel | `npx ts-node skills/intel.ts news "topic"` | News + sentiment |
| Brief | `npx ts-node skills/brief.ts` | Morning market briefing |
| Swap | `npx ts-node skills/swap.ts SOL USDC 1` | Get swap quote |
| Builder | `npx ts-node skills/buildLoop.ts build` | Run autonomous builder |
| Poster | `npx ts-node skills/agentPoster.ts cycle` | Forum engagement |

---

## External APIs Used

### Prediction Markets
- **Polymarket:** `https://gamma-api.polymarket.com/markets`
- **Kalshi:** `https://trading-api.kalshi.com`
- **Manifold:** `https://api.manifold.markets`
- **Metaculus:** `https://www.metaculus.com/api2`
- **Limitless:** `https://api.limitless.exchange`

### Solana/DeFi
- **Jupiter:** `https://quote-api.jup.ag/v6`
- **Pyth:** `https://hermes.pyth.network`
- **Helius:** `https://mainnet.helius-rpc.com`
- **DeFi Llama:** `https://api.llama.fi`

### LLM Providers
- **Groq:** `https://api.groq.com/openai/v1`
- **Anthropic:** `https://api.anthropic.com`

---

## Memory Paths

All memory files stored in `memory/` directory:

| File | Purpose |
|------|---------|
| `memory/heartbeat-state.json` | Orchestrator counters & timestamps |
| `memory/episodes.json` | Episodic memory for learning |
| `memory/conversations.json` | User conversation state |
| `memory/users.json` | User preferences |
| `memory/alert-dedup.json` | Alert deduplication |
| `memory/daily/YYYY-MM-DD.md` | Daily episode logs |

---

## OpenClaw Integration Files

| File | Purpose |
|------|---------|
| `IDENTITY.md` | Agent identity + OpenClaw runtime architecture |
| `SOUL.md` | Agent personality + methodology |
| `HEARTBEAT.md` | Dynamic status for 30-min heartbeat checks |
| `MEMORY.md` | Synced lessons + episodic memory |
| `AGENTS.md` | BeRight Terminal runtime architecture |
| `USER.md` | User context |

---

## EC2 Deployment

**Instance:** `i-0077a040e57559b62` (beright) in `eu-north-1`

**SSH:**
```bash
ssh -i ~/Desktop/berightkey.pem ec2-user@<PUBLIC_IP>
```

**PM2 Commands:**
```bash
pm2 list                          # View all processes
pm2 logs autonomous-trader        # View trader logs
pm2 restart autonomous-trader     # Restart trader
pm2 monit                         # Real-time monitoring
```

**Deployment:**
```bash
cd /opt/beright/beright-ts
./scripts/deploy-ec2.sh           # Pull + restart
./scripts/deploy-ec2.sh status    # Check status
```

---

## Telegram Bot

- **Username:** @BeRightBot (or your bot)
- **Admin ID:** 5504043269

**Commands:**
- `/start` - Initialize bot
- `/arb` - Arbitrage scan
- `/research topic` - Deep analysis
- `/brief` - Morning briefing
- `/me` - Your stats
- `/leaderboard` - Top forecasters

---

*This is your BeRight-specific cheat sheet. Update as needed.*
