# Local Development Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start everything with PM2
pm2 start ecosystem.config.js

# 3. View logs
pm2 logs

# 4. Stop all
pm2 stop all
```

## Individual Services

### Gateway (API Server)
```bash
npm run dev
# Runs on http://localhost:3001
```

### Telegram Bot
```bash
npx ts-node skills/telegram.ts

# Check status
npx ts-node skills/telegram.ts --status

# Force unlock if stuck
npx ts-node skills/telegram.ts --force-unlock
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET `/api/health` | Health check |
| GET `/api/v2/portfolio` | Portfolio overview |
| GET `/api/v2/risk` | Risk status & config |
| GET `/api/leaderboard` | Forecaster rankings |
| GET `/api/markets` | Hot markets |
| POST `/api/predictions` | Submit prediction |

## Environment Variables

Required in `.env`:
```
TELEGRAM_BOT_TOKEN=...     # From @BotFather
GROQ_API_KEY=...           # Primary LLM
```

Optional:
```
GEMINI_API_KEY=...         # Backup LLM
ANTHROPIC_API_KEY=...      # Backup LLM
TAVILY_API_KEY=...         # Web search
SUPABASE_URL=...           # Database
SUPABASE_SERVICE_KEY=...   # Database auth
```

## Testing

```bash
# Test API
curl http://localhost:3001/api/health

# Test Telegram bot
# Send message to @Beuniqueebot
```

## Railway Deployment

1. Connect repo to Railway
2. Set environment variables in dashboard
3. Deploy automatically on push to main

Or manually:
```bash
railway login
railway link
railway up
```
