# /arb

Scan for arbitrage opportunities across prediction markets.

## Steps

1. Run the arbitrage scanner:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/arbitrage.ts
   ```

2. Parse and format the results

3. Highlight opportunities with >2% spread

## Output Format

```
Arbitrage Scanner
─────────────────
Scanned: X markets across Y platforms
Time: 2024-03-15 10:30:00 UTC

Opportunities Found:

Market: "Will Bitcoin hit $100k by EOY?"
├─ Polymarket: 65% ($1.2M volume)
├─ Kalshi:     62% ($800K volume)
└─ Spread:     3.0% potential profit

Market: "Will Fed cut rates in June?"
├─ Polymarket: 45% ($2.1M volume)
├─ Manifold:   42% ($50K volume)
└─ Spread:     3.0% potential profit

Summary: 2 opportunities with >2% spread
```
