import { TourStep } from '@/components/OnboardingTour';

/**
 * Tour Steps for Markets Page (Prediction Cards)
 *
 * Guides users through:
 * - Viewing prediction cards
 * - Swiping/interacting with cards
 * - Checking fact-check information
 * - Clicking Yes/No to make predictions
 * - Signing transactions on devnet
 */
export const MARKETS_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-markets',
    target: '[data-tour="market-cards"]',
    title: 'Welcome to BeRight Markets!',
    description: 'This is your prediction marketplace. Browse trending markets across crypto, politics, economics, and more. All predictions are recorded on-chain with your Solana devnet wallet.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'prediction-card',
    target: '[data-tour="prediction-card"]',
    title: 'Swipeable Prediction Cards',
    description: 'Each card represents a real prediction market. You can swipe left/right to browse through markets, or click to view details.',
    placement: 'bottom',
    action: 'Try swiping the card left or right',
    highlightPadding: 16,
  },
  {
    id: 'fact-check',
    target: '[data-tour="fact-check-btn"]',
    title: 'AI-Powered Fact Check',
    description: 'Click the fact-check button to see AI-generated analysis, historical data, and probability estimates. Our agents analyze news, social sentiment, and on-chain data to give you an edge.',
    placement: 'top',
    action: 'Click to see the fact-check analysis',
    highlightPadding: 8,
  },
  {
    id: 'make-prediction',
    target: '[data-tour="yes-no-buttons"]',
    title: 'Make Your Prediction',
    description: 'Click YES or NO to make your prediction. This will prepare a transaction that records your prediction on Solana devnet. Your prediction becomes part of your immutable track record.',
    placement: 'top',
    action: 'Click YES or NO to continue',
    highlightPadding: 12,
  },
  {
    id: 'sign-transaction',
    target: '[data-tour="wallet-connect"]',
    title: 'Sign with Your Devnet Wallet',
    description: 'Connect your Solana wallet (using devnet mode) and sign the transaction. This is completely free on devnet - no real money involved. Your prediction will be stored on-chain and contribute to your forecaster score.',
    placement: 'bottom',
    action: 'Connect wallet and sign the transaction',
    highlightPadding: 12,
  },
];

/**
 * Tour Steps for Terminal Page (Agentic Interface)
 *
 * Guides users through:
 * - Understanding the terminal interface
 * - Using CLI commands
 * - Interacting with AI agents
 * - Viewing portfolio and signals
 */
export const TERMINAL_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-terminal',
    target: '[data-tour="terminal-main"]',
    title: 'Welcome to BeRight Terminal',
    description: 'This is your AI-powered trading terminal. Use natural language or commands to interact with our agent fleet. All features are available for free in demo mode using our test API.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'cli-input',
    target: '[data-tour="cli-input"]',
    title: 'Command Line Interface',
    description: 'Type commands like "/hot", "/arb", or "/signals" to get real-time market data. Or just ask in plain English like "What are the odds on Bitcoin ETF approval?" - our agents understand natural language.',
    placement: 'top',
    action: 'Try typing "/hot" or asking a question',
    highlightPadding: 12,
  },
  {
    id: 'agent-fleet',
    target: '[data-tour="agent-fleet"]',
    title: 'Your AI Agent Fleet',
    description: 'Four specialized agents work for you: SCOUT finds opportunities, ANALYST does deep research, TRADER executes trades, and WHALE tracks smart money. They collaborate to give you an edge.',
    placement: 'right',
    highlightPadding: 12,
  },
  {
    id: 'markets-tab',
    target: '[data-tour="markets-tab"]',
    title: 'Live Market Feed',
    description: 'Browse trending markets sorted by volume and activity. Click any market to see detailed charts, predictions, and trade history. All data is pulled from Jupiter/DFlow on Solana.',
    placement: 'right',
    highlightPadding: 8,
  },
  {
    id: 'portfolio-sidebar',
    target: '[data-tour="portfolio-sidebar"]',
    title: 'Your Portfolio & Risk',
    description: 'Track your positions, P&L, and risk exposure in real-time. All your trades across different platforms are aggregated here. In demo mode, this shows simulated positions.',
    placement: 'left',
    highlightPadding: 12,
  },
  {
    id: 'signals-feed',
    target: '[data-tour="signals-feed"]',
    title: 'Intelligence Signals (SSE)',
    description: 'Real-time alerts from our AI agents. When SCOUT detects arbitrage, ANALYST finds mispricing, or WHALE spots big moves - you\'ll see it here first. Signals update via Server-Sent Events.',
    placement: 'left',
    action: 'Watch for live signals to appear',
    highlightPadding: 12,
  },
  {
    id: 'try-commands',
    target: '[data-tour="cli-input"]',
    title: 'Try These Commands',
    description: 'Explore with:\n• "/hot" - Trending markets\n• "/arb" - Arbitrage opportunities\n• "/research Bitcoin ETF" - Deep analysis\n• "/calibration" - Check your forecasting accuracy\n\nEverything works for free in demo mode!',
    placement: 'top',
    action: 'Type a command to get started',
    highlightPadding: 12,
  },
];

/**
 * Tour Steps for Single Market Detail Page
 *
 * Guides users through:
 * - Viewing market details
 * - Reading probability charts
 * - Checking liquidity and volume
 * - Making trades
 */
export const MARKET_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    id: 'market-overview',
    target: '[data-tour="market-header"]',
    title: 'Market Overview',
    description: 'View all the details for this prediction market: current odds, total volume, liquidity, and resolution date. This market is live on Solana via Jupiter/DFlow.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'price-chart',
    target: '[data-tour="price-chart"]',
    title: 'Live Price Chart',
    description: 'Track how the probability has changed over time. When more people bet YES, the price goes up. When they bet NO, it goes down. This is how prediction markets aggregate information.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'trade-panel',
    target: '[data-tour="trade-panel"]',
    title: 'Place Your Trade',
    description: 'Choose YES or NO, enter your amount, and execute the trade. Your transaction will be submitted to Solana devnet. Check the estimated payout before confirming.',
    placement: 'left',
    action: 'Try placing a trade',
    highlightPadding: 12,
  },
  {
    id: 'liquidity-info',
    target: '[data-tour="liquidity-stats"]',
    title: 'Liquidity & Stats',
    description: 'Check the available liquidity before trading. Higher liquidity means less slippage. You can also see total volume and number of traders participating.',
    placement: 'top',
    highlightPadding: 8,
  },
];

/**
 * Get tour steps based on page/context
 */
export function getTourSteps(page: 'markets' | 'terminal' | 'market-detail'): TourStep[] {
  switch (page) {
    case 'markets':
      return MARKETS_TOUR_STEPS;
    case 'terminal':
      return TERMINAL_TOUR_STEPS;
    case 'market-detail':
      return MARKET_DETAIL_TOUR_STEPS;
    default:
      return [];
  }
}
