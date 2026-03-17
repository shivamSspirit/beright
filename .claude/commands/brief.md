# /brief

Generate a morning market brief with top opportunities.

## Steps

1. Run the brief generator:
   ```bash
   cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/brief.ts
   ```

2. Format the output for readability

## Brief Contents

- Top arbitrage opportunities
- Trending markets
- Markets closing soon
- Volume leaders
- Notable price movements

## Output Format

```
Morning Brief - March 15, 2024
══════════════════════════════

Top Arbitrage Opportunities
───────────────────────────
1. [Market] - 3.2% spread (Poly vs Kalshi)
2. [Market] - 2.8% spread (Poly vs Manifold)

Trending Markets
────────────────
1. "Market question" - 65% (+5% 24h)
2. "Market question" - 42% (-3% 24h)

Closing Soon (24h)
──────────────────
1. "Market question" - 72% - $500K volume
2. "Market question" - 35% - $200K volume

Volume Leaders
──────────────
1. "Market question" - $2.1M 24h volume
2. "Market question" - $1.5M 24h volume

Notable Movements
─────────────────
1. "Market question" jumped +15% on news of...
2. "Market question" dropped -8% after...
```
