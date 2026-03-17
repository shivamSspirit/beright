# /status

Show comprehensive project status.

## Checks

### Git Status
```bash
git status --short
git log --oneline -5
```

### Server Status
```bash
curl -s http://localhost:3001/api/health 2>/dev/null || echo "Not running"
```

### Railway Status
```bash
railway status 2>/dev/null || echo "Not linked"
```

### Telegram Bot
```bash
cat /Users/shivamsoni/Desktop/beright/beright-ts/.telegram-bot.lock 2>/dev/null || echo "Not running"
```

## Output Format

```
BeRight Protocol Status
───────────────────────

Git
├─ Branch: main
├─ Clean: Yes/No
└─ Last commit: abc123 "commit message"

Local Server
├─ Status: Running/Stopped
├─ Port: 3001
└─ Health: OK/Error

Railway (Production)
├─ Status: Deployed/Pending
├─ Last deploy: 2024-03-15 10:00
└─ Health: OK/Error

Telegram Bot
├─ Status: Running/Stopped
└─ PID: 12345

Active Tasks
└─ [from CURRENT_TASK.md if exists]
```
