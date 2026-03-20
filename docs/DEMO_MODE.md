# BeRight Protocol - Demo/Production Mode Architecture

## Overview

The BeRight Protocol supports two operating modes:
- **Demo Mode** (`beright.fun`): Devnet, mock data, paper trading
- **Production Mode** (future domain): Mainnet, live APIs, real trading

The UI is **identical** in both modes. Only the backend data sources change.

## Quick Start

### Enable Demo Mode (default)
```bash
# In .env
BERIGHT_MODE=demo
NEXT_PUBLIC_BERIGHT_MODE=demo
```

### Enable Production Mode
```bash
# In .env
BERIGHT_MODE=production
NEXT_PUBLIC_BERIGHT_MODE=production
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (UI)                            │
│                   (Same components in both modes)                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ API Calls
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BERIGHT_MODE = ?                           │
├────────────────────────────┬────────────────────────────────────┤
│        demo                │           production               │
├────────────────────────────┼────────────────────────────────────┤
│ • Solana Devnet            │ • Solana Mainnet                   │
│ • Mock market data         │ • Live DFlow/Jupiter APIs          │
│ • Fake tx confirmations    │ • Real blockchain transactions     │
│ • Paper trading            │ • Live trading                     │
│ • Demo leaderboard         │ • Real leaderboard                 │
│ • Waitlist shown           │ • Full access                      │
└────────────────────────────┴────────────────────────────────────┘
```

## Files Created

### Backend (beright-ts)

| File | Purpose |
|------|---------|
| `lib/mode.ts` | Mode detection and configuration |
| `lib/demo/index.ts` | Module exports |
| `lib/demo/dataProvider.ts` | Unified data provider (switches by mode) |
| `lib/demo/mockMarkets.ts` | 15+ realistic demo markets |
| `lib/demo/mockLeaderboard.ts` | 15 demo forecasters |
| `lib/demo/mockConfirmations.ts` | Fake Solana transactions |
| `app/api/v2/mode/route.ts` | Mode info API endpoint |
| `app/api/v2/demo/markets/route.ts` | Demo markets endpoint |

### Frontend (berightweb)

| File | Purpose |
|------|---------|
| `context/ModeContext.tsx` | React context for mode state |
| `components/ModeBanner.tsx` | Demo mode banner + indicator |
| `lib/api.ts` | Added getModeInfo() function |

## Usage

### Backend: Check Mode
```typescript
import { isDemo, getModeConfig } from '@/lib/mode';

if (isDemo()) {
  // Return demo data
} else {
  // Return production data
}
```

### Backend: Get Demo Data
```typescript
import { getDemoMarkets, getDemoLeaderboard } from '@/lib/demo';

const markets = getDemoMarkets();
const leaderboard = getDemoLeaderboard(50);
```

### Frontend: Check Mode
```typescript
import { useMode } from '@/context/ModeContext';

function MyComponent() {
  const { isDemo, networkLabel, showWaitlist } = useMode();

  return (
    <div>
      {isDemo && <span>Demo Mode - {networkLabel}</span>}
    </div>
  );
}
```

### Frontend: Show Mode Banner
```tsx
import { ModeBanner, ModeIndicator } from '@/components/ModeBanner';

// In layout
<ModeBanner />

// In header/nav
<ModeIndicator />
```

## Demo Markets

15 pre-built markets covering:
- **Crypto**: BTC $100K, ETH $10K, SOL $500
- **Politics**: 2028 Election, Fed Chair
- **Economics**: Fed rates, Recession, Inflation
- **Tech**: AGI, Tesla FSD, Apple Vision Pro
- **Sports**: Super Bowl, World Cup

All markets have:
- Realistic prices (with optional jitter)
- Mock token addresses (devnet)
- Fake volume and open interest
- DFlow-compatible structure

## Demo Leaderboard

15 forecasters with:
- Realistic Brier scores (0.089 - 0.255)
- Accuracy percentages (70% - 91%)
- Prediction counts
- Tier assignments (Superforecaster, Elite, Verified, Rookie)

## API Endpoints

### GET /api/v2/mode
Returns current mode configuration.

```json
{
  "success": true,
  "data": {
    "mode": "demo",
    "network": "devnet",
    "networkLabel": "Devnet",
    "tradingMode": "paper",
    "showWaitlist": true,
    "features": {
      "trading": true,
      "predictions": true,
      "leaderboard": true,
      "agents": true
    }
  }
}
```

### GET /api/v2/demo/markets
Returns demo market data (only in demo mode).

```json
{
  "success": true,
  "count": 15,
  "events": [...],
  "meta": {
    "source": "demo",
    "network": "devnet"
  }
}
```

## Next Steps

1. **Add ModeProvider to app layout** - Wrap the app with ModeContext
2. **Add ModeBanner to layout** - Show demo indicator
3. **Create waitlist page** - `/waitlist` for email collection
4. **Update existing API routes** - Add mode checks to return demo data
5. **Test full flow** - Verify demo mode works end-to-end

## Domain Strategy

| Domain | Mode | Purpose |
|--------|------|---------|
| `beright.fun` | demo | VC demos, testing, waitlist |
| TBD (beright.ai?) | production | Paid users, real trading |

## Environment Variables

```bash
# Required
BERIGHT_MODE=demo|production
NEXT_PUBLIC_BERIGHT_MODE=demo|production

# Mode determines which to use
HELIUS_RPC_DEVNET=...   # Used in demo
HELIUS_RPC_MAINNET=...  # Used in production
```
