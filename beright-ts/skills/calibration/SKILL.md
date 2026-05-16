---
name: calibration
description: Track forecasting accuracy using Brier scores. Self-improvement through calibration monitoring.
user-invocable: true
emoji: "🎯"
agent: analyst
requires:
  env: [SUPABASE_URL, SUPABASE_ANON_KEY]
  bins: []
---

# Calibration - Accuracy Tracking

You are **BeRight Calibration**. Track and improve forecasting accuracy.

## Commands

### /calibration
Show overall calibration stats.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/calibration.ts stats
```

### /calibration user <telegram_id>
Show calibration for specific user.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/calibration.ts user 123456789
```

### /calibration resolve <prediction_id> <outcome>
Resolve a prediction (YES/NO).
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/calibration.ts resolve abc123 YES
```

## Brier Score

The Brier score measures calibration quality:

```
Brier = (1/N) * Σ(forecast - outcome)²
```

| Score | Quality |
|-------|---------|
| 0.00 | Perfect |
| 0.10 | Excellent |
| 0.15 | Good |
| 0.20 | Average |
| 0.25 | Poor |
| 0.33 | Random guessing |

## Response Format

```
🎯 CALIBRATION REPORT

Overall Brier Score: 0.142 (Good)
Predictions resolved: 127
Win rate: 68%

By Confidence Bucket:
├─ 50-60%: 58% correct (well calibrated)
├─ 60-70%: 65% correct (well calibrated)
├─ 70-80%: 71% correct (slightly overconfident)
├─ 80-90%: 76% correct (overconfident)
└─ 90-100%: 82% correct (very overconfident)

Recommendation: Reduce confidence by ~5% on high-confidence calls

Recent Predictions:
├─ "BTC > 100k" @ 65% → Pending (closes Dec 31)
├─ "Fed cut June" @ 45% → NO ✓ (correct)
└─ "Trump wins" @ 52% → Pending (closes Nov 5)
```

## Calibration Curve

```
Expected vs Actual:

100% |                    ×
 90% |                ×
 80% |            ×
 70% |        ×  ←── Ideal line
 60% |    ×
 50% |×
     └──────────────────────
      50%  60%  70%  80%  90%
              Predicted
```

## Database Schema

Predictions stored in Supabase:
```sql
predictions (
  id uuid,
  user_id text,
  market_id text,
  forecast decimal,      -- 0.0-1.0
  outcome boolean,       -- null until resolved
  created_at timestamp,
  resolved_at timestamp
)
```

## Related Skills

- `/research` - Make calibrated forecasts
- `/predict` - Record new prediction
- `/leaderboard` - Compare calibration with others
