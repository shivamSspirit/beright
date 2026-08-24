export type CapitalSide = 'YES' | 'NO';

export type CapitalEligibilityStatus = 'eligible' | 'review' | 'ineligible';

export type CapitalReasonCode =
  | 'market_not_active'
  | 'market_not_initialized'
  | 'redemption_closed'
  | 'early_close_allowed'
  | 'resolution_rules_missing'
  | 'resolution_too_soon'
  | 'invalid_close_time'
  | 'executable_bid_unavailable'
  | 'ask_unavailable'
  | 'spread_too_wide'
  | 'volume_too_low'
  | 'open_interest_too_low'
  | 'orderbook_depth_unavailable'
  | 'orderbook_depth_too_low';

export interface CapitalMarketAccount {
  marketLedger: string;
  yesMint: string;
  noMint: string;
  isInitialized: boolean;
  redemptionStatus: 'open' | 'closed';
}

export interface CapitalMarketSnapshot {
  ticker: string;
  eventTicker: string;
  title: string;
  status: string;
  side: CapitalSide;
  bid: number | null;
  ask: number | null;
  volumeUsd: number;
  openInterestUsd: number;
  closeTime: number;
  expirationTime: number;
  canCloseEarly: boolean;
  resolutionRules: string | null;
  account: CapitalMarketAccount | null;
}

export interface CapitalOrderbook {
  yesBids?: Record<string, number>;
  yesAsks?: Record<string, number>;
  noBids?: Record<string, number>;
  noAsks?: Record<string, number>;
}

export interface CapitalRiskPrice {
  price: number | null;
  source: 'executable_bid' | 'unavailable';
  bestBid: number | null;
  bestAsk: number | null;
  spreadBps: number | null;
  availableDepthShares: number | null;
  availableDepthUsd: number | null;
  asOf: string;
}

export interface CapitalEligibilityReason {
  code: CapitalReasonCode;
  severity: 'block' | 'warning';
  message: string;
}

export interface CapitalEligibility {
  status: CapitalEligibilityStatus;
  eligible: boolean;
  score: number;
  daysToResolution: number | null;
  riskPrice: CapitalRiskPrice;
  reasons: CapitalEligibilityReason[];
  evaluatedAt: string;
}

export interface CapitalYieldRate {
  apyPct: number | null;
  source: 'jupiter_earn' | 'demo_model' | 'unavailable';
  asset: 'USDC';
  asOf: string;
  isEstimate: true;
  message?: string;
}

export interface CapitalSimulationInput {
  shares: number;
  opposingAvailableShares: number;
  holdingDays: number;
  strategyApyPct: number;
  executableBid: number;
  reserveBps?: number;
  protocolFeeBps?: number;
}

export interface CapitalSimulation {
  positionValueUsd: number;
  matchedShares: number;
  unmatchedShares: number;
  matchedPairPrincipalUsd: number;
  deployedPrincipalUsd: number;
  reserveUsd: number;
  estimatedGrossStrategyYieldUsd: number;
  estimatedGrossUserYieldUsd: number;
  estimatedProtocolFeeUsd: number;
  estimatedNetUserYieldUsd: number;
  estimatedYieldRangeUsd: {
    low: number;
    high: number;
  };
  estimatedEffectiveApyPct: number;
  assumptions: {
    userYieldSharePct: 50;
    reserveBps: number;
    protocolFeeBps: number;
    holdingDays: number;
    strategyApyPct: number;
  };
}

export type CapitalRouteAction = 'hold' | 'match_for_yield' | 'borrow' | 'exit';

export interface CapitalRouteInput {
  eligibility: CapitalEligibility;
  shares: number;
  opposingAvailableShares: number;
  holdingDays: number;
  requestedBorrowUsd?: number;
  maxLtvBps?: number;
}

export interface CapitalRouteRecommendation {
  action: CapitalRouteAction;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  matchedShares: number;
  maximumBorrowUsd: number;
  requestedBorrowUsd: number;
  requiresWalletSignature: true;
  executable: false;
  intent: {
    version: 1;
    action: CapitalRouteAction;
    amount: number;
    minOutput: number;
    expiresInSeconds: number;
  } | null;
}

export type CapitalStrategyProviderId = 'jupiter_earn' | 'kamino_earn' | 'loopscale_vault';

export type CapitalStrategyProviderStatus =
  | 'transaction_ready'
  | 'configuration_required'
  | 'partner_required';

export interface CapitalStrategyProvider {
  id: CapitalStrategyProviderId;
  name: string;
  status: CapitalStrategyProviderStatus;
  asset: 'USDC';
  custody: 'user_wallet';
  supports: Array<'deposit' | 'withdraw' | 'position'>;
  reason: string | null;
}

export type JupiterEarnAction = 'deposit' | 'withdraw' | 'redeem';

export interface PreparedCapitalTransaction {
  provider: 'jupiter_earn';
  action: JupiterEarnAction;
  asset: 'USDC';
  amountAtomic: string;
  wallet: string;
  transaction: string;
  encoding: 'base64';
  messageVersion: 'v0';
  recentBlockhash: string;
  lastValidBlockHeight: number;
  programIds: string[];
  requiresWalletSignature: true;
  serverSigned: false;
  serverSubmits: false;
}

export interface JupiterEarnPosition {
  provider: 'jupiter_earn';
  asset: 'USDC';
  wallet: string;
  lendingToken: string;
  sharesAtomic: string;
  underlyingAssetsAtomic: string;
  walletUnderlyingBalanceAtomic: string;
  supplyApyPct: number;
  rewardsApyPct: number;
  asOf: string;
}
