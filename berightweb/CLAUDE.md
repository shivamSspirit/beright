# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

This is `berightweb`, the frontend workspace of the BeRight monorepo. See the parent `/CLAUDE.md` for full monorepo documentation including backend architecture, multi-agent system, and prediction market platform integrations.

## Commands

```bash
# From this directory (berightweb/)
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run lint     # Run ESLint

# From monorepo root (recommended)
npm run dev:web  # Start frontend only
npm run dev      # Start both frontend + backend
```

## Tech Stack

- Next.js 16.1.6 with App Router and Turbopack
- React 19.2.3
- TypeScript 5 (strict mode, bundler resolution)
- Tailwind CSS 4
- Privy for wallet authentication
- Solana Kit for blockchain interactions
- Framer Motion + React Spring for animations

## Architecture

### Path Aliases

Use `@/*` for imports from `src/`:
```typescript
import { api } from '@/lib/api';
import { CardStack } from '@/components/CardStack';
```

### API Proxy

All `/api/*` requests are proxied to the backend (port 3001) via `next.config.ts` rewrites. Never call the backend directly from client components.

```typescript
// Correct - uses proxy
const res = await fetch('/api/markets');

// Wrong - bypasses proxy, causes CORS issues
const res = await fetch('http://localhost:3001/api/markets');
```

### Key Directories

```
src/
├── app/           # Next.js App Router pages
│   ├── page.tsx   # Home with swipeable CardStack
│   ├── markets/   # Market browser
│   ├── forecaster/# Prediction tools
│   ├── leaderboard/
│   ├── profile/
│   └── embed/     # Embeddable widget
├── components/    # React components
│   ├── CardStack.tsx     # Core swipeable cards (react-spring)
│   ├── SwipeCard.tsx     # Individual market card
│   ├── TradingModal.tsx  # Trade execution UI
│   ├── AIDebateModal.tsx # AI debate visualization
│   └── MoodPills.tsx     # Sentiment indicators
├── hooks/         # Custom React hooks
├── context/       # React context providers
├── providers/     # Next.js providers (Privy, etc.)
└── lib/
    ├── api.ts     # Typed API client for backend
    └── supabase.ts# Supabase client
```

### Component Patterns

**Swipeable Cards**: `CardStack.tsx` uses `@react-spring/web` and `@use-gesture/react` for Tinder-style market cards. Swipe right = bullish, left = bearish.

**Modals**: Trading and AI features use modal pattern with Framer Motion animations.

**Mood System**: Components use the shared `Mood` type (`BULLISH | BEARISH | NEUTRAL | ALERT | EDUCATIONAL | ERROR`) from the backend for consistent sentiment display.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=
```

## Data Flow

```
Component → lib/api.ts → /api/* proxy → beright-ts backend
```

The `lib/api.ts` client provides typed methods matching backend endpoints. Always use this client rather than raw fetch for consistency and type safety.
