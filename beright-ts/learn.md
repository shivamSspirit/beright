# BeRight Protocol - Code Learnings

Concise technical learnings from analyzing the beright codebase.

---

## Architecture Pattern

**Multi-Agent Router**: Single entry point (bot.py) routes to specialized agents based on commands/keywords.

```
Telegram → Router → [RESEARCH | ARBITRAGE | WHALE | EXECUTOR | INTEL]
```

Each agent is stateless; persistence via markdown/JSON files in `memory/`.

---

## Key Technical Patterns

### 1. Market Data Standardization

All platforms normalized to common format:
```python
{
    'platform': str,
    'yes_price': float,  # 0-1 decimal
    'yes_pct': float,    # 0-100
    'no_price': float,
    'volume': float,
    'title': str
}
```

### 2. Arbitrage Detection

**Matching Algorithm**: SequenceMatcher (40%) + Jaccard index on keywords (60%)
- Similarity threshold: 35%
- Minimum spread: 3%
- Fees: Polymarket 0.5%, Kalshi 1%, Limitless 1%

```python
def calculate_similarity(text_a, text_b):
    # SequenceMatcher for fuzzy matching
    seq_ratio = SequenceMatcher(None, a_lower, b_lower).ratio()
    # Jaccard index for keyword overlap
    words_a, words_b = set(a_lower.split()), set(b_lower.split())
    jaccard = len(words_a & words_b) / len(words_a | words_b)
    return seq_ratio * 0.4 + jaccard * 0.6
```

### 3. Position Sizing (Kelly Criterion)

Half-Kelly for safety:
```typescript
f* = (bp - q) / b * 0.5
// b = odds, p = win probability, q = 1-p
// Capped at MAX_POSITION_USD ($100)
```

### 4. Sentiment Analysis

Simple keyword counting:
- **Bullish**: bullish, up, moon, buy, yes, likely, will, confident
- **Bearish**: bearish, down, crash, sell, no, unlikely, won't, doubt
- Score: (bullish - bearish) / total * 50 + 50

### 5. RSS Feed Parsing

Handles both RSS 2.0 and Atom:
```python
# RSS 2.0: <item><title>, <link>, <description>
# Atom: <entry><title>, <link href="">, <summary>
items = root.findall('.//item') or root.findall('.//{http://www.w3.org/2005/Atom}entry')
```

---

## API Integration

### Prediction Markets (via pmxt)

```python
import pmxt
polymarket = pmxt.Polymarket()
kalshi = pmxt.Kalshi()
markets = polymarket.fetch_markets({'query': 'bitcoin'})
```

### Solana Execution (Jupiter V6 + Jito)

```typescript
// 1. Get quote
const quote = await fetch(`${JUPITER_API}/quote?inputMint=...&outputMint=...&amount=...`)

// 2. Get swap transaction
const swap = await fetch(`${JUPITER_API}/swap`, {
  body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet.publicKey })
})

// 3. Send with Jito MEV protection
const tx = VersionedTransaction.deserialize(Buffer.from(swap.swapTransaction, 'base64'))
tx.sign([wallet])
await connection.sendTransaction(tx)
```

### Helius (Whale Tracking)

```python
url = f"https://api.helius.xyz/v0/addresses/{address}/transactions?api-key={HELIUS_API_KEY}"
# Returns parsed transaction history with token transfers
```

### Twitter (via Nitter)

Nitter instances as Twitter API bypass:
```python
NITTER_INSTANCES = [
    'https://nitter.net',
    'https://nitter.privacydev.net',
    # ... fallbacks
]
# Scrape HTML, no auth needed
```

---

## Heartbeat Scheduling

```python
INTERVALS = {
    'arbitrage': 300,    # 5 min
    'whale': 900,        # 15 min
    'news': 3600,        # 1 hour
    'brief': 86400       # daily (6-9 AM window)
}

# State persisted to heartbeat-state.json
{
    'lastArbitrageScan': timestamp,
    'lastWhaleCheck': timestamp,
    'alertsSent': count,
    'errorsEncountered': count
}
```

---

## Alert Thresholds

| Type | Threshold | Action |
|------|-----------|--------|
| Arbitrage | >3% spread | Telegram alert |
| Whale | >$10K trade | Telegram alert |
| News | "breaking", "urgent", "flash" | Telegram alert |

---

## File-Based Memory

| File | Format | Purpose |
|------|--------|---------|
| `memory/positions.md` | Markdown table | Open positions |
| `memory/watchlist.md` | Markdown list | Tracked markets |
| `memory/predictions.jsonl` | JSON Lines | Prediction history |
| `memory/whales.md` | Markdown table | Whale wallets + accuracy |
| `memory/heartbeat-state.json` | JSON | Scheduler state |

---

## Telegram Message Handling

4000 char limit per message - auto-split:
```python
def split_message(text, max_len=4000):
    chunks = []
    while len(text) > max_len:
        split_point = text.rfind('\n', 0, max_len)
        if split_point == -1:
            split_point = max_len
        chunks.append(text[:split_point])
        text = text[split_point:]
    chunks.append(text)
    return chunks
```

---

## Error Handling Pattern

Graceful degradation - continue if one source fails:
```python
results = []
for platform in platforms:
    try:
        data = fetch_from(platform)
        results.extend(data)
    except Exception as e:
        logger.warning(f"{platform} failed: {e}")
        continue  # Don't stop entire operation
return results
```

---

## Key Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=       # Bot API token
SOLANA_PRIVATE_KEY=       # Byte array or base58
HELIUS_API_KEY=           # Solana RPC + wallet tracking

# Optional (for trading)
KALSHI_API_KEY=
ANTHROPIC_API_KEY=        # For agent_bot.py (Claude routing)
```

---

## Keypair Parsing

Handles both formats:
```typescript
function parsePrivateKey(keyString: string): Uint8Array {
    const trimmed = keyString.trim()
    if (trimmed.startsWith('[')) {
        // Byte array: [1,2,3,...]
        return Uint8Array.from(JSON.parse(trimmed))
    } else {
        // Base58: 5K...
        return bs58.decode(trimmed)
    }
}
```

---

## Safety Constraints

- Max position: $100 per trade
- Max portfolio: $500 total
- Slippage: 300 bps default, 1000 bps max
- Half-Kelly sizing (conservative)
- Jito MEV protection on all trades
- Never trade without explicit permission (unless auto-execute enabled)

---

## Platform-Specific Notes

### Polymarket
- Public Gamma API (no auth for reading)
- Prices in 0-1 decimal
- High liquidity, US-restricted

### Kalshi
- Prices in cents (0-100), convert to decimal
- Requires API key for trading
- Elections-focused, regulated

### Manifold
- Play money (not real trades)
- Good for sentiment signal
- Timestamps in milliseconds

---

## Code Organization

```
scripts/
├── bot.py           # Telegram entry point
├── agent_bot.py     # Claude-powered alternative
├── heartbeat.py     # Autonomous scheduler
├── execution.ts     # Solana trading
├── markets.py       # Unified market API (pmxt wrapper)
├── arbitrage.py     # Cross-platform scanner
├── research.py      # Superforecaster analysis
├── whale.py         # Helius wallet tracking
├── news.py          # RSS aggregation
├── reddit.py        # Reddit scraper
├── twitter.py       # Nitter scraper
├── polymarket.py    # Platform-specific client
├── kalshi.py        # Platform-specific client
├── manifold.py      # Platform-specific client
└── odds.py          # Cross-platform comparison
```
