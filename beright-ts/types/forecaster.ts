/**
 * BeRight Forecaster Types
 *
 * Defines the data structures for forecaster profiles, predictions,
 * and the on-chain/off-chain split.
 *
 * Architecture:
 * - On-chain: Minimal state (168 bytes) - identity, merkle root, scores
 * - Off-chain: Rich data (Supabase) - predictions, history, metadata
 * - Token: Each forecaster has SPL token via Meteora DAMM v2
 * - Yield: Idle capital earns via Sanctum INF
 *
 * @author BeRight Protocol
 */

// =============================================================================
// DOMAINS & ENUMS
// =============================================================================

export type Domain = 'politics' | 'crypto' | 'sports' | 'macro' | 'science' | 'general';

export type ForecasterTier =
  | 'unranked'        // < 5 resolved predictions
  | 'rookie'          // 5+ predictions, building history
  | 'verified'        // Brier < 0.25, 20+ predictions
  | 'elite'           // Brier < 0.15, 50+ predictions, top 20%
  | 'superforecaster'; // Brier < 0.10, 100+ predictions, top 5%

export const TIER_THRESHOLDS: Record<ForecasterTier, {
  minPredictions: number;
  maxBrier: number;
  minPercentile: number;
}> = {
  unranked: { minPredictions: 0, maxBrier: 1.0, minPercentile: 0 },
  rookie: { minPredictions: 5, maxBrier: 1.0, minPercentile: 0 },
  verified: { minPredictions: 20, maxBrier: 0.25, minPercentile: 50 },
  elite: { minPredictions: 50, maxBrier: 0.15, minPercentile: 80 },
  superforecaster: { minPredictions: 100, maxBrier: 0.10, minPercentile: 95 },
};

// =============================================================================
// ON-CHAIN STATE (Minimal - ~168 bytes)
// =============================================================================

/**
 * On-chain ForecasterProfile PDA
 *
 * This is what gets stored on Solana. Minimal footprint, maximum verifiability.
 * All rich data lives in Supabase and can be verified against these commitments.
 */
export interface ForecasterOnChain {
  // Identity (64 bytes)
  authority: string;            // Owner wallet pubkey
  tokenMint: string;            // Forecaster's SPL token mint (Meteora)

  // Commitment (40 bytes)
  predictionsRoot: string;      // Merkle root of all predictions (32 bytes hex)
  predictionCount: number;      // Total count for verification

  // Aggregated Scores (24 bytes)
  compositeScore: number;       // 0-10000, single ranking number
  skillRating: number;          // Elo-style, baseline 1000
  totalVolumeUsd: number;       // Lifetime volume wagered
  totalPnlUsd: number;          // Lifetime profit/loss (can be negative)

  // Status (8 bytes)
  tier: number;                 // 0=unranked, 1=rookie, 2=verified, 3=elite, 4=super
  canCreatePool: boolean;       // Pool eligibility flag
  isVerified: boolean;          // KYC/social verified
  flags: number;                // Bitflags for features

  // Timestamps (24 bytes)
  createdAt: number;            // Unix timestamp
  lastPredictionAt: number;     // Unix timestamp
  lastUpdatedAt: number;        // Unix timestamp

  // PDA metadata
  bump: number;
  version: number;
}

// =============================================================================
// OFF-CHAIN STATE (Rich - Supabase)
// =============================================================================

/**
 * Full ForecasterProfile (off-chain)
 *
 * This is the complete profile with all details.
 * Stored in Supabase, verified against on-chain merkle root.
 */
export interface ForecasterProfile {
  // Identity
  id: string;                   // UUID
  pubkey: string;               // Wallet address (PDA seed)
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  telegramId: number | null;
  twitterHandle: string | null;

  // Authority
  managerPubkey: string;        // Primary authority
  delegatePubkey: string | null; // Hot key for trading

  // Token (Meteora DAMM v2)
  token: ForecasterToken | null;

  // Scores - Standard Brier
  scores: {
    brierOverall: number | null;
    brierPolitics: number | null;
    brierCrypto: number | null;
    brierSports: number | null;
    brierMacro: number | null;
    brierScience: number | null;

    // Advanced scores
    volumeWeightedBrier: number | null;
    accuracy: number | null;          // 0-1, directional accuracy
    roi: number | null;               // Total return on investment
    sharpeRatio: number | null;       // Risk-adjusted returns
    kellyCompliance: number | null;   // Position sizing discipline
    skillRating: number;              // Elo-style, default 1000
    compositeScore: number;           // 0-10000, weighted blend
  };

  // Metrics
  metrics: {
    predictionCount: number;
    resolvedCount: number;
    correctCount: number;
    cumulativeVolumeUsd: number;
    profitVolumeUsd: number;
    totalAumUsd: number;              // If has pools
    totalFeesEarnedUsd: number;       // Lifetime fees
    activePoolCount: number;
    totalPoolsCreated: number;
    streak: number;                   // Current win/loss streak
    maxStreak: number;                // Best streak ever
  };

  // Ranking
  globalRank: number | null;
  percentile: number | null;          // 0-100
  tier: ForecasterTier;
  badges: string[];
  canCreatePool: boolean;

  // On-chain commitment
  predictionsRoot: string | null;     // Merkle root
  lastOnChainSync: string | null;     // ISO timestamp

  // Timestamps
  createdAt: string;
  lastPredictionAt: string | null;
  lastActiveAt: string;
  updatedAt: string;
}

// =============================================================================
// FORECASTER TOKEN (Meteora DAMM v2)
// =============================================================================

/**
 * Forecaster's personal SPL token
 *
 * Created via Meteora DAMM v2 when forecaster reaches eligibility.
 * Token represents reputation - delegators buy to "back" the forecaster.
 */
export interface ForecasterToken {
  // Token identity
  mint: string;                 // SPL token mint address
  symbol: string;               // e.g., "ALICE" (3-5 chars)
  name: string;                 // e.g., "ALICE Forecaster Token"
  decimals: number;             // Usually 6 (USDC-like)
  uri: string | null;           // Metadata URI

  // Meteora pool
  poolAddress: string;          // DAMM v2 pool: TOKEN/USDC
  poolType: 'damm_v2';
  positionNft: string | null;   // Forecaster's LP position NFT

  // Supply
  totalSupply: string;          // Fixed at creation (bigint as string)
  circulatingSupply: string;    // Held by delegators
  forecasterHolding: string;    // Locked by forecaster
  lockedUntil: number | null;   // Lock expiry timestamp

  // Market data
  priceUsd: number | null;      // Current price vs USDC
  priceChange24h: number | null;
  volume24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;

  // Pool fees
  poolFeeBps: number;           // Trading fee (e.g., 30 = 0.3%)
  feesEarned24h: number | null;
  totalFeesEarned: number | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// PREDICTIONS
// =============================================================================

/**
 * Individual prediction record
 */
export interface PredictionRecord {
  id: string;                   // UUID
  forecasterPubkey: string;

  // Market reference
  marketId: string;
  marketTitle: string;
  platform: 'polymarket' | 'kalshi' | 'jupiter' | 'dflow' | 'manifold' | 'limitless';
  domain: Domain;

  // Prediction details
  direction: 'YES' | 'NO';
  probability: number;          // 0-1, forecaster's confidence
  entryPrice: number;           // Price paid per contract (0-1)
  contracts: number;            // Number of contracts
  stakeUsd: number;             // USDC committed

  // Resolution
  outcome: boolean | null;      // true = YES won, null = unresolved
  exitPrice: number | null;     // Price on exit/resolution
  pnlUsd: number | null;        // Profit/loss in USD
  brierContribution: number | null; // (probability - outcome)²

  // On-chain proof
  intentTxSignature: string | null;     // Prediction committed
  executionTxSignature: string | null;  // Trade executed
  resolutionTxSignature: string | null; // Resolution recorded

  // Merkle proof (for verification against on-chain root)
  leafHash: string | null;      // Hash of this prediction
  merkleProof: string[] | null; // Proof path to root

  // Timestamps
  predictedAt: string;
  executedAt: string | null;
  resolvedAt: string | null;
}

/**
 * Prediction input for committing
 */
export interface PredictionInput {
  marketId: string;
  marketTitle: string;
  platform: PredictionRecord['platform'];
  direction: 'YES' | 'NO';
  probability: number;
  stakeUsd?: number;
  reasoning?: string;
}

// =============================================================================
// LEGACY POOL TYPES (retired from active BeRight scope)
// =============================================================================

/**
 * Forecast Pool - legacy schema retained for historical data compatibility.
 *
 * Vault/pool/yield products are not active BeRight product scope.
 */
export interface ForecastPool {
  // Identity
  id: string;
  pubkey: string;               // Pool PDA
  name: string;                 // 32 chars max
  description: string | null;

  // Forecaster
  forecasterPubkey: string;
  forecasterProfile: ForecasterProfile | null;

  // Token (Meteora)
  token: ForecasterToken;

  // Configuration
  category: Domain | 'mixed';
  strategyType: PoolStrategy;
  minDepositUsd: number;
  maxDepositUsd: number | null;
  maxTvlUsd: number | null;
  lockPeriodSeconds: number;

  // Fees (basis points)
  fees: {
    depositFeeBps: number;      // 0-300 (0-3%)
    managementFeeBps: number;   // Annualized AUM fee (e.g., 200 = 2%)
    performanceFeeBps: number;  // Profit share (e.g., 2000 = 20%)
    hurdleRateBps: number | null; // Min return before perf fee
  };

  // Status
  status: PoolStatus;

  // Capital allocation
  allocation: {
    totalValueUsd: number;      // Total pool value
    activePredictions: number;  // In DFlow/Jupiter positions
    sanctumYield: number;       // In Sanctum INF
    liquidReserve: number;      // USDC for withdrawals
  };

  // Sanctum integration
  sanctum: {
    infBalance: string;         // INF tokens held (bigint)
    infValueUsd: number;        // Current value
    yieldEarned: number;        // Total yield from Sanctum
    lastHarvest: string | null; // ISO timestamp
  } | null;

  // Performance
  performance: {
    navPerShare: number;        // Net Asset Value per token
    cumulativePnlUsd: number;
    activePositions: number;
    closedPositions: number;
    winRate: number;            // 0-1
    avgReturnPct: number;
    sharpeRatio: number | null;
  };

  // Delegators
  delegatorCount: number;
  totalShares: string;          // bigint as string

  // Timestamps
  createdAt: string;
  activeAt: string | null;
  settlesAt: string;
  settledAt: string | null;
}

export type PoolStrategy =
  | 'single_market'     // Focus on one event
  | 'basket'            // Diversified across markets
  | 'arbitrage'         // Arb opportunities
  | 'long_shot'         // Low probability, high return
  | 'conservative'      // High probability, low variance
  | 'momentum'          // Follow price trends
  | 'contrarian';       // Fade consensus

export type PoolStatus =
  | 'draft'             // Being configured
  | 'open'              // Accepting deposits
  | 'active'            // Trading
  | 'settling'          // Closing positions
  | 'settled'           // Profits distributed
  | 'cancelled';        // Cancelled before activation

// =============================================================================
// DELEGATION
// =============================================================================

/**
 * Delegation record - Delegator's stake in a pool
 */
export interface Delegation {
  id: string;
  pubkey: string;               // Delegation PDA
  poolPubkey: string;
  delegatorPubkey: string;

  // Position
  tokenBalance: string;         // Forecaster tokens held (bigint)
  depositedUsd: number;         // Original USDC deposited
  currentValueUsd: number;      // Current value
  sharePercent: number;         // % of pool

  // Entry
  entryPriceUsd: number;        // Token price at entry
  depositedAt: string;

  // Withdrawal
  withdrawRequestedAt: string | null;
  withdrawableAt: string | null; // After lock period

  // Claim
  claimed: boolean;
  claimedAmountUsd: number | null;
  claimedAt: string | null;

  // P&L
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  realizedPnlUsd: number;
}

// =============================================================================
// LEADERBOARD
// =============================================================================

/**
 * Leaderboard entry for ranking display
 */
export interface LeaderboardEntry {
  rank: number;
  forecaster: ForecasterProfile;

  // Highlighted metrics
  primaryScore: number;         // Based on sortBy
  change24h: number | null;     // Rank change

  // Quick stats
  recentAccuracy: number | null;
  recentPnl: number | null;

  // Token info (if has pool)
  tokenPrice: number | null;
  tokenChange24h: number | null;
  poolTvl: number | null;

  // Badges for quick visual
  highlightBadges: string[];
}

export interface LeaderboardQuery {
  // Filtering
  domain?: Domain | 'all';
  tier?: ForecasterTier | 'all';
  minPredictions?: number;
  minResolved?: number;
  hasPool?: boolean;

  // Sorting
  sortBy:
    | 'compositeScore'
    | 'brierOverall'
    | 'volumeWeightedBrier'
    | 'roi'
    | 'sharpeRatio'
    | 'skillRating'
    | 'cumulativeVolume'
    | 'predictionCount'
    | 'poolTvl';
  sortOrder: 'asc' | 'desc';

  // Pagination
  limit: number;
  offset: number;

  // Time filtering
  timeframe?: '7d' | '30d' | '90d' | 'all';
}

// =============================================================================
// MERKLE TREE TYPES
// =============================================================================

/**
 * Merkle tree for prediction commitment
 */
export interface MerkleTree {
  root: string;                 // 32-byte hex root
  leafCount: number;
  depth: number;
  leaves: string[];             // Leaf hashes
}

/**
 * Merkle proof for a single prediction
 */
export interface MerkleProof {
  leaf: string;                 // Hash of the prediction
  proof: string[];              // Sibling hashes
  index: number;                // Leaf index
  root: string;                 // Expected root
}

// =============================================================================
// API TYPES
// =============================================================================

export interface CreateForecasterRequest {
  walletPubkey: string;
  displayName?: string;
  telegramId?: number;
  twitterHandle?: string;
}

export interface UpdateForecasterRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  twitterHandle?: string;
  isPublic?: boolean;
}

export interface CommitPredictionRequest {
  forecasterPubkey: string;
  prediction: PredictionInput;
  signTransaction?: boolean;    // Include on-chain commit
}

export interface CommitPredictionResponse {
  predictionId: string;
  intentTxSignature: string | null;
  merkleLeaf: string;
  newMerkleRoot: string;
  market: {
    title: string;
    currentPrice: number;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export type ForecasterSortField = keyof ForecasterProfile['scores'] | 'predictionCount' | 'globalRank';
