# /calibrate

Run calibration analysis on past predictions.

## Steps

1. Run calibration service:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npm run calibration
   ```

2. Analyze Brier scores
3. Compare against market consensus
4. Generate improvement suggestions

## Output Format

```
Calibration Report
══════════════════

Overall Performance
───────────────────
Brier Score: 0.18 (Good)
Predictions: 45 total
Resolved: 32
Pending: 13

Calibration by Confidence
─────────────────────────
50-60%: 12 predictions, 58% correct (well-calibrated)
60-70%: 10 predictions, 72% correct (slightly overconfident)
70-80%: 8 predictions, 68% correct (overconfident)
80%+:   2 predictions, 50% correct (very overconfident)

vs Market Consensus
───────────────────
Beat market: 18 times (56%)
Matched market: 8 times (25%)
Worse than market: 6 times (19%)

Improvement Areas
─────────────────
- Reduce confidence in 70%+ predictions
- Sports markets: underperforming (-0.05 Brier)
- Politics markets: outperforming (+0.03 Brier)

On-Chain Record
───────────────
Latest commit: [tx hash]
Verified Brier: 0.18
```
