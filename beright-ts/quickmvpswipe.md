# BeRight: 3-Day MVP Sprint

## Competitive Landscape (Colosseum AI Agent Hackathon)

### Direct Competitors in Hackathon
| Project | Focus | Threat Level | Our Edge |
|---------|-------|--------------|----------|
| **AgentBets** | Prediction markets for agent outcomes | HIGH | We have multi-platform arb, they're single-focus |
| **AgentDEX** | DEX for agents | MEDIUM | We're specialized in prediction markets |
| **SIDEX/SidexBot** | Crypto trading bot | MEDIUM | We have superforecaster methodology, they're just trading |
| **Pyxis Protocol** | Oracle marketplace | LOW | Different focus |
| **Parallax** | Trading agent | MEDIUM | We have social layer (copy trading, leaderboard) |

### Our Unfair Advantages
1. **5-Platform Coverage** - Polymarket, Kalshi (DFlow), Manifold, Limitless, Metaculus
2. **Real Arbitrage Detection** - Cross-platform spread finder (working NOW)
3. **Swipe UX** - No one else has Tinder-for-predictions
4. **Dual Interface** - Casual (Swipe) + Power User (Telegram)
5. **Social Proof** - Leaderboard, copy trading, Brier scores
6. **OpenClaw Native** - Full integration with gateway, skills, heartbeat

---

## Current State: What's Already Built

### Backend (100% Complete)
- [x] `markets.ts` - Unified data from 5 platforms
- [x] `arbitrage.ts` - Cross-platform arb scanner
- [x] `trade.ts` - Jupiter/DFlow execution (dry run)
- [x] `whale.ts` - Solana wallet tracking
- [x] `research.ts` - AI-powered analysis
- [x] `calibration.ts` - Brier score tracking
- [x] `copyTrading.ts` - Follow/signals
- [x] `notifications.ts` - Alert system
- [x] `heartbeat.ts` - Autonomous scanning

### API Routes (100% Complete)
- [x] `/api/markets` - Market data + search
- [x] `/api/brief` - Morning briefing
- [x] `/api/predictions` - User predictions
- [x] `/api/leaderboard` - Rankings
- [x] `/api/alerts` - Notification system
- [x] `/api/agent-feed` - SSE for live updates

### Telegram Bot (100% Complete)
- [x] All commands working
- [x] OpenClaw integration
- [x] Heartbeat automation

### Web UI (50% Complete)
- [x] Terminal dashboard (`page.tsx`)
- [x] Market display
- [x] Arb radar
- [x] Stats panel
- [ ] **Swipe interface** - NOT BUILT
- [ ] **Wallet connect** - NOT BUILT
- [ ] **Trade execution UI** - NOT BUILT
- [ ] **Mobile optimization** - NOT BUILT

---

## 3-Day MVP Plan

### Day 1: Swipe Core (8 hours)

#### Morning (4h) - Swipe Component
```
app/
├── swipe/
│   ├── page.tsx          # Main swipe view
│   ├── SwipeCard.tsx     # Individual market card
│   ├── SwipeStack.tsx    # Card stack with gestures
│   └── BetModal.tsx      # Confirm bet modal
```

**Tasks:**
1. Create `/swipe` route (30 min)
2. Build `SwipeCard` component with market data (1h)
3. Implement swipe gestures with Framer Motion (1.5h)
4. Add swipe actions: RIGHT=YES, LEFT=NO, UP=Skip (1h)

**Deliverable:** Swipeable cards showing real market data

#### Afternoon (4h) - Market Queue
**Tasks:**
1. Create smart queue API `/api/swipe-queue` (1h)
   - Prioritize by: volume, arb opportunity, trending
   - Filter already-bet markets
2. Implement infinite scroll/load more (1h)
3. Add quick filters: Politics, Crypto, Sports (1h)
4. Mobile-first CSS (1h)

**Deliverable:** Curated market feed that loads dynamically

---

### Day 2: Wallet & Betting (8 hours)

#### Morning (4h) - Wallet Connection
**Tasks:**
1. Install Privy SDK (30 min)
2. Create `WalletProvider` wrapper (1h)
3. Build connect button component (1h)
4. Store user wallet in Supabase (1h)
5. Display balance (SOL + USDC) (30 min)

**Deliverable:** Users can connect Phantom/Solflare wallet

#### Afternoon (4h) - Bet Flow
**Tasks:**
1. Create bet confirmation modal (1h)
   - Show: market, direction, amount, potential payout
2. Integrate with `trade.ts` for quotes (1h)
3. Add bet size selector ($5, $10, $25, custom) (1h)
4. Show transaction status (pending/confirmed) (1h)

**Deliverable:** Full bet flow (quote only, no execution)

---

### Day 3: Polish & Ship (8 hours)

#### Morning (4h) - Gamification
**Tasks:**
1. Add streak counter (30 min)
2. Show "Whales are X% YES" social proof (1h)
3. Add swipe animations (confetti on bet) (1h)
4. Create daily stats banner (1h)
5. Implement PWA manifest for mobile install (30 min)

**Deliverable:** Engaging, gamified experience

#### Afternoon (4h) - Integration & Deploy
**Tasks:**
1. Connect swipe UI to Telegram (deep links) (1h)
2. Add "Share prediction" to X/Telegram (30 min)
3. Final mobile testing (1h)
4. Deploy to Vercel (30 min)
5. Create demo video (1h)

**Deliverable:** Live product at beright.app

---

## Technical Spec: Swipe Component

```tsx
// app/swipe/SwipeCard.tsx
interface SwipeCardProps {
  market: {
    id: string;
    title: string;
    platform: 'polymarket' | 'kalshi' | 'manifold';
    yesPrice: number;
    noPrice: number;
    volume: number;
    endDate: string;
    category: string;
    whaleSignal?: { direction: 'YES' | 'NO'; strength: number };
  };
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
}

// Gesture thresholds
const SWIPE_THRESHOLD = 100; // pixels
const SWIPE_VELOCITY = 500;  // px/s
```

### Swipe Stack Behavior
```
┌─────────────────────────────────────┐
│                                     │
│   ← NO                    YES →     │
│                                     │
│   ┌─────────────────────────────┐   │
│   │      [Card 3 - behind]      │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │      [Card 2 - behind]      │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │                             │   │
│   │         ACTIVE CARD         │   │ ← Swipeable
│   │                             │   │
│   └─────────────────────────────┘   │
│                                     │
│         ↑ SKIP / RESEARCH           │
│                                     │
└─────────────────────────────────────┘
```

---

## API: Swipe Queue

```typescript
// GET /api/swipe-queue?category=crypto&limit=20
interface SwipeQueueResponse {
  markets: SwipeMarket[];
  hasMore: boolean;
  cursor: string;
}

interface SwipeMarket {
  id: string;
  title: string;
  platform: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate: string;
  category: string;
  trending: boolean;
  arbOpportunity: boolean;
  whaleActivity: {
    direction: 'YES' | 'NO' | null;
    confidence: number;
  } | null;
}
```

### Queue Prioritization Algorithm
```typescript
function priorityScore(market: Market): number {
  let score = 0;

  // Volume (more = better)
  score += Math.log10(market.volume + 1) * 10;

  // Arb opportunity (big bonus)
  if (market.hasArb) score += 50;

  // Trending (recent volume spike)
  if (market.trending) score += 30;

  // Whale signal (smart money)
  if (market.whaleSignal) score += 25;

  // Time sensitivity (ending soon)
  const daysUntilEnd = daysBetween(new Date(), market.endDate);
  if (daysUntilEnd < 7) score += 20;
  if (daysUntilEnd < 1) score += 40;

  // User preference (category match)
  if (userPrefers(market.category)) score += 15;

  return score;
}
```

---

## File Structure After MVP

```
app/
├── page.tsx              # Terminal dashboard (existing)
├── globals.css           # Styles (existing)
├── layout.tsx            # Root layout (existing)
├── swipe/
│   ├── page.tsx          # NEW: Swipe main view
│   ├── SwipeCard.tsx     # NEW: Market card component
│   ├── SwipeStack.tsx    # NEW: Gesture handler
│   ├── BetModal.tsx      # NEW: Confirm bet
│   └── SwipeFilters.tsx  # NEW: Category filters
├── dashboard/
│   └── page.tsx          # NEW: Creator dashboard (stretch)
├── api/
│   ├── markets/route.ts  # Existing
│   ├── brief/route.ts    # Existing
│   ├── swipe-queue/
│   │   └── route.ts      # NEW: Smart market queue
│   ├── bet/
│   │   └── route.ts      # NEW: Place bet
│   └── wallet/
│       └── route.ts      # NEW: Wallet operations
├── components/
│   ├── WalletProvider.tsx # NEW: Privy wrapper
│   ├── ConnectButton.tsx  # NEW: Wallet button
│   └── BalanceDisplay.tsx # NEW: SOL/USDC balance
└── lib/
    ├── privy.ts          # NEW: Privy config
    └── supabase.ts       # Existing (needs user table)
```

---

## Success Metrics for Demo

| Metric | Target | Measurement |
|--------|--------|-------------|
| Swipe-to-bet time | < 3 seconds | User testing |
| Markets loaded | 50+ unique | API logs |
| Platforms covered | 3+ | Feature check |
| Mobile works | Yes | Device testing |
| Wallet connects | Yes | E2E test |
| Bet quote shown | Yes | E2E test |

---

## Demo Script (2 min video)

1. **0:00-0:15** - "BeRight: Swipe to predict the future"
   - Show swipe UI, quick swipes

2. **0:15-0:30** - "Real markets from 5 platforms"
   - Show Polymarket, Kalshi, Manifold data

3. **0:30-0:45** - "Find arbitrage instantly"
   - Show arb detection, spread percentage

4. **0:45-1:00** - "Connect wallet, place bets"
   - Phantom connect, bet confirmation

5. **1:00-1:15** - "Track your accuracy"
   - Show Brier score, leaderboard

6. **1:15-1:30** - "Power users go deeper"
   - Show Telegram bot commands

7. **1:30-1:45** - "Autonomous agent running 24/7"
   - Show heartbeat, whale alerts

8. **1:45-2:00** - "Try it now: beright.app"
   - Call to action

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Framer Motion learning curve | Use existing examples, 2h max |
| Privy SDK issues | Fallback to basic Phantom adapter |
| API rate limits | Implement caching (already done) |
| Mobile gesture conflicts | Test early, use touch-action CSS |
| Time crunch | Cut dashboard, focus on swipe only |

---

## Post-Hackathon Roadmap

### Week 2: Trade Execution
- [ ] Enable real trades via Jupiter
- [ ] Add safety limits (max bet, daily cap)
- [ ] Transaction history

### Week 3: Social
- [ ] Share predictions to X
- [ ] Copy trading automation
- [ ] Referral system

### Week 4: Scale
- [ ] Push notifications (FCM)
- [ ] More platforms (PredictIt, Metaculus)
- [ ] Mobile app (Expo)

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Test swipe queue API
curl http://localhost:3000/api/swipe-queue?category=crypto

# Run heartbeat (background scanning)
npx ts-node skills/heartbeat.ts loop 300

# Check markets API
curl http://localhost:3000/api/markets?hot=true
```

---

*Ship fast. Iterate faster. Win the hackathon.*
