# Skill: Debug

Systematic debugging approach for BeRight issues.

## Step 1: Reproduce
- Get exact steps to reproduce
- Identify: always happens vs intermittent
- Note: environment (local/prod), user tier, input data

## Step 2: Isolate
- Which layer? (API, Agent, Data Fabric, Platform)
- Check logs for errors
- Trace the request flow

## Step 3: Common Issues

### Agent Not Responding
```bash
# Check API key
echo $ANTHROPIC_API_KEY | head -c 10

# Check rate limits
grep "429" logs/*.log
```

### Stale Market Data
- Data Fabric cache TTL is 30s
- Force refresh: clear cache or wait
- Check platform API directly

### Telegram Handler Errors
```bash
# Check webhook status
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo
```

### On-Chain Transaction Failed
- Check wallet balance (SOL for fees)
- Check RPC endpoint status
- Verify transaction in explorer

## Step 4: Fix
- Make minimal change to fix issue
- Don't refactor while debugging
- Add logging if issue was hard to find

## Step 5: Verify
- Confirm fix works
- Check no regression in related areas
- Document root cause in commit message
