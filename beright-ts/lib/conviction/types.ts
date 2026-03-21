/**
 * BeRight Conviction - Type Definitions
 *
 * Conviction markets are prediction markets where crypto projects
 * stake real money on their own milestones, creating verifiable
 * on-chain accountability.
 */

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Categories for crypto projects
 */
export type ProjectCategory =
  | 'defi'
  | 'nft'
  | 'gaming'
  | 'infrastructure'
  | 'dao'
  | 'social'
  | 'prediction_market'
  | 'other';

/**
 * A project that creates conviction markets
 */
export interface ConvictionProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProjectCategory;

  // Links
  website: string;
  twitter?: string;
  github?: string;
  discord?: string;

  // On-chain
  tokenMint?: string;        // If they have a token
  treasuryWallet: string;    // Wallet that stakes

  // Metrics
  convictionScore: number;   // 0-100 overall score
  totalStaked: number;       // Total SOL staked on own markets
  marketsCreated: number;
  marketsResolved: number;
  successRate: number;       // % of milestones hit (0-100)

  // AI Visibility
  geoScore?: number;         // 0-100 AI citation score
  lastCitationCheck?: Date;

  // Verification
  verified: boolean;
  verificationMethod?: 'tweet' | 'dns' | 'wallet_sign';
  verifiedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to create a new project
 */
export interface CreateProjectRequest {
  name: string;
  slug: string;
  description?: string;
  category: ProjectCategory;

  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;

  treasuryWallet: string;
  tokenMint?: string;
}

/**
 * Response after creating a project
 */
export interface CreateProjectResponse {
  project: ConvictionProject;
  verificationChallenge: VerificationChallenge;
}

/**
 * Challenge for verifying project ownership
 */
export interface VerificationChallenge {
  type: 'tweet' | 'dns' | 'wallet_sign';
  challenge: string;
  expiresAt: Date;
}

// ============================================================================
// MARKET TYPES
// ============================================================================

/**
 * Types of milestones projects can create markets for
 */
export type MilestoneType =
  | 'mainnet_launch'
  | 'user_milestone'     // "Reach X users"
  | 'tvl_milestone'      // "Reach $X TVL"
  | 'token_launch'
  | 'partnership'
  | 'audit_completion'
  | 'feature_release'
  | 'revenue_milestone'
  | 'funding_round'
  | 'ai_visibility'      // "Get cited by ChatGPT"
  | 'custom';

/**
 * How market outcome is verified
 */
export type ResolutionSource =
  | 'on_chain'           // Verify via blockchain data
  | 'api'                // Verify via API (DefiLlama, etc)
  | 'manual'             // BeRight team verifies
  | 'oracle'             // External oracle
  | 'ai_query';          // Query AI LLMs

/**
 * Market lifecycle status
 */
export type MarketStatus =
  | 'draft'
  | 'pending_stake'      // Waiting for project to stake
  | 'active'
  | 'closed'             // Trading closed, awaiting resolution
  | 'resolved'
  | 'disputed';

/**
 * Market outcome after resolution
 */
export type MarketOutcome = 'yes' | 'no' | 'invalid';

/**
 * Project's stake on a market
 */
export interface ProjectStake {
  amount: number;          // SOL staked by project
  position: 'yes' | 'no';  // Usually 'yes'
  txSignature?: string;    // On-chain proof
  stakedAt?: Date;
}

/**
 * A conviction market - prediction market about a project's milestone
 */
export interface ConvictionMarket {
  id: string;
  projectId: string;

  // Market details
  question: string;            // "Will [Project] ship mainnet by Q3 2026?"
  description: string;
  milestoneType: MilestoneType;

  // Resolution
  resolutionCriteria: string;  // How we verify outcome
  resolutionSource: ResolutionSource;
  resolutionDate: Date;        // When market closes
  resolvedAt?: Date;
  outcome?: MarketOutcome;
  resolutionEvidence?: string; // Proof of outcome

  // Staking
  projectStake: ProjectStake;

  // Trading
  yesPrice: number;            // 0-1
  noPrice: number;
  volume: number;
  liquidity: number;
  tradeCount: number;

  // Platform
  platform: 'beright' | 'manifold' | 'polymarket';
  externalId?: string;         // ID on external platform
  externalUrl?: string;

  // Status
  status: MarketStatus;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to create a conviction market
 */
export interface CreateMarketRequest {
  projectId: string;

  question: string;
  description?: string;
  milestoneType: MilestoneType;

  resolutionCriteria?: string;    // Uses milestone template default if not provided
  resolutionSource?: ResolutionSource;  // Uses milestone template default if not provided
  resolutionDate: Date | string;  // When market resolves (accepts Date or ISO string)

  stakeAmount: number;            // SOL to stake
  stakePosition?: 'yes' | 'no';   // Default: 'yes'
}

/**
 * Response after creating a market
 */
export interface CreateMarketResponse {
  market: ConvictionMarket;
  stakeInstructions?: StakeInstructions;
}

/**
 * Instructions for staking on a market
 */
export interface StakeInstructions {
  escrowAddress: string;
  amount: number;
  memo: string;
}

/**
 * Query parameters for listing markets
 */
export interface ListMarketsQuery {
  projectId?: string;
  category?: ProjectCategory;
  status?: MarketStatus;
  milestoneType?: MilestoneType;
  sortBy?: 'volume' | 'stake' | 'closing' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Response for listing markets
 */
export interface ListMarketsResponse {
  markets: ConvictionMarket[];
  total: number;
  hasMore: boolean;
}

/**
 * Request to record a stake transaction
 */
export interface RecordStakeRequest {
  marketId: string;
  txSignature: string;         // Solana transaction
  amount: number;
  position: 'yes' | 'no';
  staker: 'project' | 'trader';
  wallet: string;
}

/**
 * Request to resolve a market
 */
export interface ResolveMarketRequest {
  marketId: string;
  outcome: MarketOutcome;
  evidence: string;            // Proof of outcome
  source: string;              // Where proof came from
}

// ============================================================================
// SCORING TYPES
// ============================================================================

/**
 * Components of a conviction score
 */
export interface ConvictionScoreComponents {
  stakeAmount: number;       // How much they've staked (0-25)
  successRate: number;       // % milestones hit (0-25)
  marketCount: number;       // How many markets (0-15)
  stakeRatio: number;        // Stake vs project size (0-15)
  communityTrust: number;    // Trading volume/sentiment (0-10)
  aiVisibility: number;      // GEO score (0-10)
}

/**
 * Full conviction score for a project
 */
export interface ConvictionScore {
  projectId: string;

  overall: number;             // 0-100

  components: ConvictionScoreComponents;

  trend: 'up' | 'down' | 'stable';
  percentile: number;          // vs other projects (0-100)

  calculatedAt: Date;
}

// ============================================================================
// AI VISIBILITY TYPES
// ============================================================================

/**
 * Supported LLMs for visibility tracking
 */
export type LLMProvider = 'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'deepseek';

/**
 * Citation status for a single LLM
 */
export interface LLMCitation {
  score: number;               // 0-100
  mentioned: boolean;
  position?: number;           // If mentioned, what position
  context?: string;            // What was said
  lastQuery: string;           // Query that found mention
  lastChecked: Date;
}

/**
 * Single AI mention record
 */
export interface AIMention {
  llm: LLMProvider;
  query: string;
  mentioned: boolean;
  context?: string;
  timestamp: Date;
}

/**
 * Full AI visibility profile for a project
 */
export interface AIVisibility {
  projectId: string;

  overall: number;             // 0-100 GEO score

  byLLM: Record<LLMProvider, LLMCitation>;

  recentMentions: AIMention[];
  trend: 'up' | 'down' | 'stable';

  lastChecked: Date;
}

// ============================================================================
// DATABASE TYPES (Supabase row types)
// ============================================================================

/**
 * Database row for conviction_projects table
 */
export interface ConvictionProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;

  website: string | null;
  twitter: string | null;
  github: string | null;
  discord: string | null;

  token_mint: string | null;
  treasury_wallet: string;

  conviction_score: number;
  total_staked: number;
  markets_created: number;
  markets_resolved: number;
  success_rate: number;

  geo_score: number | null;
  last_citation_check: string | null;

  verified: boolean;
  verification_method: string | null;
  verified_at: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Database row for conviction_markets table
 */
export interface ConvictionMarketRow {
  id: string;
  project_id: string;

  question: string;
  description: string | null;
  milestone_type: string;

  resolution_criteria: string;
  resolution_source: string;
  resolution_date: string;
  resolved_at: string | null;
  outcome: string | null;
  resolution_evidence: string | null;

  project_stake_amount: number;
  project_stake_position: string;
  project_stake_tx: string | null;
  project_stake_at: string | null;

  yes_price: number;
  no_price: number;
  volume: number;
  liquidity: number;
  trade_count: number;

  platform: string;
  external_id: string | null;
  external_url: string | null;

  status: string;

  created_at: string;
  updated_at: string;
}

/**
 * Database row for conviction_visibility table
 */
export interface ConvictionVisibilityRow {
  id: string;
  project_id: string;

  llm: string;
  query: string;
  mentioned: boolean;
  position: number | null;
  context: string | null;

  checked_at: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Standard API error response
 */
export interface ConvictionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Error codes for conviction API
 */
export const CONVICTION_ERROR_CODES = {
  PROJECT_NOT_FOUND: 'CONV_001',
  MARKET_NOT_FOUND: 'CONV_002',
  INSUFFICIENT_STAKE: 'CONV_003',
  MARKET_ALREADY_RESOLVED: 'CONV_004',
  VERIFICATION_FAILED: 'CONV_005',
  RATE_LIMITED: 'CONV_006',
  INVALID_MILESTONE_TYPE: 'CONV_007',
  RESOLUTION_DATE_IN_PAST: 'CONV_008',
  INVALID_PROJECT_SLUG: 'CONV_009',
  DUPLICATE_SLUG: 'CONV_010',
  INVALID_WALLET: 'CONV_011',
} as const;
