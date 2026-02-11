# BeRight Supabase Integration

Complete database setup for BeRight Protocol prediction market intelligence platform.

## Quick Start

### 1. Set Environment Variables

Copy `.env.example` to `.env` and add your Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Initialize Database

**Option A: Automatic Migration (Recommended)**

```bash
npx ts-node lib/supabase/migrate.ts
```

**Option B: Manual Migration**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy contents of `lib/supabase/schema.sql`
4. Paste and execute
5. Go to **Database > Replication**
6. Enable realtime for `beright_events` table

### 3. Test Connection

```bash
npx ts-node lib/supabase/test-connection.ts
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|--------|
| `users` | User profiles (wallet + Telegram) |
| `predictions` | All user predictions with Brier scores |
| `alerts` | Price/arbitrage alerts |
| `watchlist` | User-tracked markets |
| `whale_wallets` | Tracked whale wallets |
| `whale_trades` | Whale trade history |
| `arbitrage_history` | Detected arbitrage opportunities |
| `sessions` | User session context |
| `beright_events` | Realtime event stream (Telegram ↔ Web sync) |

### Views

- **`leaderboard`** - User rankings by Brier score and accuracy

### Functions

- **`calculate_brier_score()`** - Calculates prediction accuracy score
- **`update_updated_at_column()`** - Auto-updates timestamps

## Usage Examples

### Backend (beright-ts)

```typescript
import { db } from '../lib/supabase/client';

// Create a user
const user = await db.users.upsertFromTelegram(123456, 'username');

// Record a prediction
const prediction = await db.predictions.create({
  user_id: user.id,
  question: 'Will Bitcoin hit $100k by EOY?',
  predicted_probability: 0.65,
  direction: 'YES',
  confidence: 'high',
  reasoning: 'Strong fundamentals...',
  platform: 'polymarket',
});

// Get leaderboard
const top10 = await db.leaderboard.get({ limit: 10 });

// Track whale wallet
const whale = await db.whales.addWallet({
  wallet_address: 'ABC123...',
  label: 'Big Player',
  platform: 'polymarket',
});

// Record arbitrage
await db.arbitrage.record({
  market_title: 'Biden wins 2024',
  platform1: 'polymarket',
  platform2: 'kalshi',
  price_platform1: 0.55,
  price_platform2: 0.48,
  spread_percent: 7.0,
});

// Publish realtime event
await db.events.publish({
  event_type: 'agent_response',
  telegram_id: 123456,
  agent: 'scout',
  command: '/markets bitcoin',
  response: 'Found 5 markets...',
  mood: 'NEUTRAL',
});
```

### Frontend (berightweb)

```typescript
import { supabase, subscribeToEvents } from '@/lib/supabase';

// Subscribe to realtime events
const channel = subscribeToEvents(
  (event) => {
    console.log('New event:', event);
    // Update UI with new event
  },
  {
    eventTypes: ['agent_response', 'arb_alert'],
    sessionId: 'session-123',
  }
);

// Fetch leaderboard
const { data: leaderboard } = await supabase
  .from('leaderboard')
  .select('*')
  .limit(10);

// Cleanup
unsubscribeFromEvents(channel);
```

## Architecture

### Row Level Security (RLS)

- **Public read** access for leaderboard data
- **Service role** (backend) has full CRUD access
- Users can update their own profiles

### Realtime Sync

The `beright_events` table enables bidirectional sync between Telegram bot and web dashboard:

```
Telegram Bot → Supabase → Web Dashboard
     ↓             ↑            ↓
  Command      Realtime     Live Updates
```

### Calibration System

Brier scores are automatically calculated when predictions resolve:

- **0.0** = Perfect prediction
- **0.25** = Random guess
- **1.0** = Completely wrong

Formula: `(forecast - actual)²`

## Files

```
lib/supabase/
├── schema.sql           # Complete database schema
├── migrate.ts           # Migration utility
├── client.ts            # Supabase client + helpers
├── types.ts             # TypeScript types
├── test-connection.ts   # Connection test
└── README.md            # This file
```

## Maintenance

### Regenerate Types

If you modify the schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
```

### Backup Database

```bash
# From Supabase dashboard: Settings > Database > Connection string
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" > backup.sql
```

### Monitor Events

```bash
# Watch realtime events
npx ts-node -e "require('./lib/supabase/client').db.events.getRecent({ limit: 20 }).then(console.log)"
```

## Troubleshooting

### Connection Fails

1. Verify environment variables are set
2. Check Supabase project is active
3. Ensure IP is allowlisted (Supabase dashboard > Settings > Database)

### RLS Blocks Queries

Use `supabaseAdmin` instead of `supabase` in backend code:

```typescript
import { supabaseAdmin } from './client';
// supabaseAdmin bypasses RLS policies
```

### Realtime Not Working

1. Enable Realtime in Supabase dashboard: Database > Replication
2. Add `beright_events` table to publication
3. Check connection: `supabase.channel('test').subscribe()`

## Support

For issues or questions:
- Check [Supabase Docs](https://supabase.com/docs)
- Review existing predictions: `/leaderboard` command in Telegram
- Test connection: `npx ts-node lib/supabase/test-connection.ts`
