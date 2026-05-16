# /markets

Search and display prediction markets.

## Usage

`/markets [query]` - Search for markets matching query
`/markets trending` - Show trending markets
`/markets hot` - Show hot markets by volume

## Implementation

### Search
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node skills/markets.ts search "[query]"
```

### Trending
```bash
curl -s http://localhost:3001/api/v2/markets/trending | jq
```

### Hot
```bash
curl -s http://localhost:3001/api/markets/hot | jq
```

## Output Format

```
Market Search: "[query]"
─────────────────────────
Found X markets

1. "Market question here"
   Platform: Polymarket
   Probability: 65%
   Volume 24h: $1.2M
   Closes: 2024-12-31

2. "Another market question"
   Platform: Kalshi
   Probability: 42%
   Volume 24h: $800K
   Closes: 2024-06-30

[Show top 5 results]
```
