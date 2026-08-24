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
    description: 'Click the fact-check button to see agent-assisted analysis, historical data, and probability estimates. Our agents analyze news, social sentiment, and on-chain data to give you an edge.',
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
 * Tour Steps for Home Page (SwipeCards)
 *
 * Guides users through:
 * - Understanding swipeable prediction cards
 * - Using AI fact-check analysis
 * - Making predictions with YES/NO buttons
 * - Signing transactions on devnet
 */
export const HOME_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-home',
    target: '[data-tour="swipe-container"]',
    title: 'Welcome to BeRight!',
    description: 'Swipe through trending prediction markets. Make your forecasts, record them on-chain, and build your reputation as a superforecaster. All predictions are free on Solana devnet.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'prediction-card',
    target: '[data-tour="top-card"]',
    title: 'Swipeable Prediction Cards',
    description: 'Each card shows a live prediction market with current odds, volume, and timing. Swipe left/right to browse, or use the buttons below to make your prediction.',
    placement: 'bottom',
    action: 'Swipe or scroll to the next card',
    highlightPadding: 16,
  },
  {
    id: 'yes-no-buttons',
    target: '[data-tour="vote-buttons"]',
    title: 'Make Your Prediction',
    description: 'Click YES if you think the event will happen, or NO if you think it won\'t. This opens the AI fact-check modal with supporting analysis.',
    placement: 'top',
    action: 'Click YES or NO to continue',
    highlightPadding: 12,
  },
  {
    id: 'ai-analysis',
    target: '[data-tour="analysis-modal"]',
    title: 'AI-Powered Fact Check',
    description: 'Our AI agents analyze news, social sentiment, and historical data to give you an edge. See supporting facts, challenges, and confidence levels before confirming.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'confirm-prediction',
    target: '[data-tour="confirm-button"]',
    title: 'Record On-Chain',
    description: 'Confirm your prediction to record it on Solana devnet. This creates an immutable track record that contributes to your forecaster score. Free on devnet!',
    placement: 'top',
    action: 'Confirm to record your prediction',
    highlightPadding: 12,
  },
];

/**
 * Tour Steps for Markets Page (Browse)
 *
 * Guides users through:
 * - Browsing market cards
 * - Filtering and sorting
 * - Understanding market stats
 * - Trading markets
 */
export const MARKETS_PAGE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-markets-page',
    target: '[data-tour="markets-page"]',
    title: 'Explore All Markets',
    description: 'Browse live prediction markets from DFlow and Jupiter. Filter by category, sort by volume or activity, and trade directly from this page.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'search-filters',
    target: '[data-tour="search-filters"]',
    title: 'Search & Filter',
    description: 'Use the search bar to find specific markets, or filter by category (Crypto, Politics, Economics, etc.) and sort by trending, volume, or ending soon.',
    placement: 'bottom',
    action: 'Try searching or filtering',
    highlightPadding: 12,
  },
  {
    id: 'market-card',
    target: '[data-tour="market-card"]',
    title: 'Market Cards',
    description: 'Each card shows current YES/NO prices, 24h price movement sparkline, trading volume, and time remaining. Click to see full details or trade directly.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'market-stats',
    target: '[data-tour="market-stats"]',
    title: 'Live Market Data',
    description: 'Track real-time price changes, volume, and time remaining. The sparkline shows 24h price history. Green = price up, Red = price down.',
    placement: 'top',
    highlightPadding: 8,
  },
  {
    id: 'trade-button',
    target: '[data-tour="trade-button"]',
    title: 'Quick Trade',
    description: 'Click Trade to open the trading modal and place orders instantly. Markets are live on Solana via DFlow and Jupiter aggregator.',
    placement: 'left',
    action: 'Click Trade to see the trading interface',
    highlightPadding: 8,
  },
];

/**
 * Tour Steps for Profile Page
 *
 * Guides users through:
 * - Viewing stats and achievements
 * - Understanding league progression
 * - Managing wallet and subscription
 * - Viewing prediction history
 */
export const PROFILE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-profile',
    target: '[data-tour="profile-hero"]',
    title: 'Your Forecaster Profile',
    description: 'This is your public forecaster profile. Track your accuracy, predictions, league tier, and achievements. Share your profile to build your reputation.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'accuracy-card',
    target: '[data-tour="accuracy-card"]',
    title: 'Your Accuracy Score',
    description: 'This shows your prediction accuracy over the last 30 days. Higher accuracy = better forecaster score and higher league tier.',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'achievements',
    target: '[data-tour="achievements"]',
    title: 'Unlock Achievements',
    description: 'Earn achievements by hitting milestones: first win, win streaks, high accuracy, volume traded, and more. Unlocked achievements glow!',
    placement: 'top',
    highlightPadding: 12,
  },
  {
    id: 'league-progression',
    target: '[data-tour="league-progression"]',
    title: 'League Tier System',
    description: 'Progress through Bronze, Silver, Gold, Platinum, and Diamond tiers by earning XP from predictions and accuracy. Higher tiers unlock better rewards.',
    placement: 'top',
    highlightPadding: 12,
  },
  {
    id: 'wallet-balance',
    target: '[data-tour="wallet-balance"]',
    title: 'Your Devnet Wallet',
    description: 'View your Solana devnet balance. All predictions and trades are free on devnet. Request more test funds if needed.',
    placement: 'left',
    highlightPadding: 12,
  },
  {
    id: 'activity-feed',
    target: '[data-tour="activity-feed"]',
    title: 'On-Chain Activity',
    description: 'See your recent predictions recorded on Solana devnet. Click any item to view full details or check the transaction on Solana Explorer.',
    placement: 'left',
    action: 'Click an activity to see details',
    highlightPadding: 12,
  },
];

/**
 * Get tour steps based on page/context
 */
export function getTourSteps(page: 'home' | 'markets' | 'markets-page' | 'market-detail' | 'profile'): TourStep[] {
  switch (page) {
    case 'home':
      return HOME_TOUR_STEPS;
    case 'markets-page':
      return MARKETS_PAGE_TOUR_STEPS;
    case 'markets':
      return MARKETS_TOUR_STEPS; // For backwards compatibility (market detail page used to be called 'markets')
    case 'market-detail':
      return MARKET_DETAIL_TOUR_STEPS;
    case 'profile':
      return PROFILE_TOUR_STEPS;
    default:
      return [];
  }
}
