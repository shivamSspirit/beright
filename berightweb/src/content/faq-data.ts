/**
 * FAQ Content Data
 *
 * 7 essential FAQs covering core concepts.
 * Concise answers for quick understanding.
 */

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
}

export type FAQCategory =
  | 'Getting Started'
  | 'Core Concepts'
  | 'Platform'
  | 'Pricing';

export const FAQ_CATEGORIES: FAQCategory[] = [
  'Getting Started',
  'Core Concepts',
  'Platform',
  'Pricing',
];

export const CATEGORY_COLORS: Record<FAQCategory, { bg: string; border: string; text: string }> = {
  'Getting Started': { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', text: '#10B981' },
  'Core Concepts': { bg: 'rgba(255, 193, 7, 0.12)', border: 'rgba(255, 193, 7, 0.25)', text: '#FFC107' },
  'Platform': { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.25)', text: '#8B5CF6' },
  'Pricing': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)', text: '#F97316' },
};

export const FAQ_ITEMS: FAQItem[] = [
  // ===========================================================================
  // GETTING STARTED
  // ===========================================================================
  {
    id: 'what-is-beright',
    category: 'Getting Started',
    question: 'What is BeRight?',
    answer: `BeRight is an AI-powered prediction market intelligence platform. We help you:

• **Find opportunities** — Aggregate odds from Polymarket, Kalshi, Jupiter, and more
• **Get AI insights** — One-line edge analysis on every market
• **Build reputation** — Track your accuracy with on-chain Brier scores
• **Prove your edge** — Build a public calibration history and verified prediction record

Think of it as Bloomberg Terminal meets AI copilot for prediction markets.`,
  },
  {
    id: 'get-started',
    category: 'Getting Started',
    question: 'How do I get started?',
    answer: `**3 steps to start:**

1. **Connect wallet** — Click "Connect" (Phantom, Solflare, or email login via Privy)
2. **Explore markets** — Swipe cards on the home page or browse the Markets tab
3. **Make predictions** — Swipe right for YES, left for NO. Your accuracy is tracked automatically.

For power users, open the **Terminal** and type naturally: "What's hot?" or "Find arbitrage opportunities."`,
  },

  // ===========================================================================
  // CORE CONCEPTS
  // ===========================================================================
  {
    id: 'brier-score',
    category: 'Core Concepts',
    question: 'What is a Brier Score?',
    answer: `Brier Score measures how **calibrated** your predictions are — not just direction, but confidence accuracy.

**Formula:** (your probability − actual outcome)²

**Example:** You predict 80% YES, it happens → Score = 0.04 (great). You predict 80% YES, it doesn't → Score = 0.64 (poor).

**Benchmarks:**
• < 0.15 — Elite forecaster
• 0.15–0.25 — Good
• > 0.25 — Below random guessing

Lower is better. Your score is recorded on-chain as verifiable proof of skill.`,
  },
  {
    id: 'platforms',
    category: 'Core Concepts',
    question: 'Which platforms does BeRight support?',
    answer: `We aggregate data from major prediction markets:

• **Polymarket** — Largest crypto market (USDC, Polygon)
• **Kalshi** — US-regulated, real USD
• **Jupiter/DFlow** — Solana-native, zero payout fees
• **Manifold** — Play money, great for practice

You get unified search, cross-platform arbitrage detection, and whale tracking — all in one place.`,
  },

  // ===========================================================================
  // PLATFORM
  // ===========================================================================
  {
    id: 'terminal',
    category: 'Platform',
    question: 'How does the Terminal work?',
    answer: `The Terminal is a natural language interface for power users.

**Just type what you want:**
• "What's hot right now?"
• "Find arbitrage opportunities"
• "Research the Fed rate decision"
• "Show my calibration stats"

**Or use commands:**
• \`/hot\` — Trending markets
• \`/arb\` — Arbitrage scanner
• \`/research <topic>\` — Deep AI analysis
• \`/predict YES on <market> at 70%\` — Record a prediction

The AI routes your request to the right agent (Scout, Analyst, or Trader) automatically.`,
  },
  {
    id: 'onchain-reputation',
    category: 'Platform',
    question: 'How does on-chain reputation work?',
    answer: `BeRight records prediction activity and calibration data on Solana-linked infrastructure.

**What gets tracked:**
• Your wallet address
• The market and side you predicted
• Timing and forecast metadata
• Brier-style calibration outcomes as markets resolve

**Why it matters:**
• Your track record is verifiable
• Rankings can use the same underlying history
• Reputation is portable across the BeRight product surface

The goal is simple: make forecasting skill measurable instead of self-reported.`,
  },

  // ===========================================================================
  // PRICING
  // ===========================================================================
  {
    id: 'pricing',
    category: 'Pricing',
    question: 'What are the subscription tiers?',
    answer: `**Free** — Profile aggregation, 3 AI edge insights per market, 5 Terminal queries/day, unlimited manual trade execution

**Pro ($19/mo)** — 10-20 arbitrage alerts, 50 Terminal queries/day, portfolio tracking, 20 AI fact-checks, unlimited trading

**Alpha ($49/mo)** — All AI agents, deep research, 100 Terminal queries/day, AI alerts, 30+ arbitrage detection, 50+ AI fact-checks

All paid plans include a 7-day money-back guarantee.`,
  },
];

export default FAQ_ITEMS;
