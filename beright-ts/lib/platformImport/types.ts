/**
 * Platform Import Types
 *
 * Core type definitions for cross-platform reputation aggregation.
 * Used by platform connectors, verification system, and composite scoring.
 */

// =============================================================================
// PLATFORM TYPES
// =============================================================================

export type ExternalPlatform =
  | 'metaculus'
  | 'manifold'
  | 'goodjudgment'
  | 'polymarket'
  | 'kalshi'
  | 'infer'
  | 'hypermind'
  | 'predictit';

export type VerificationMethod =
  | 'oauth'
  | 'signature'
  | 'profile_code'
  | 'manual_review';

export type AuthMethod =
  | 'oauth'
  | 'api_key'
  | 'wallet_signature'
  | 'profile_code'
  | 'manual_review';

export type ScoringType = 'brier' | 'log' | 'accuracy' | 'pnl';

export type ForecasterTier =
  | 'unranked'
  | 'rookie'
  | 'verified'
  | 'elite'
  | 'superforecaster';

// =============================================================================
// CALIBRATION DATA
// =============================================================================

export interface CalibrationBucket {
  predictedProbability: number; // Center of bucket (0.05, 0.15, etc.)
  actualFrequency: number;      // Actual outcome rate
  count: number;                 // Number of predictions in bucket
}

// =============================================================================
// IMPORTED STATS
// =============================================================================

export interface ImportedStats {
  // Core metrics (normalized)
  brierScore: number | null;     // 0-1, lower is better
  predictionCount: number;
  resolvedCount: number;
  accuracy: number | null;       // 0-1, correct predictions / total

  // Calibration data
  calibrationData: CalibrationBucket[] | null;

  // Platform-specific rank
  platformRank: number | null;
  platformPercentile: number | null;

  // For real-money platforms
  totalVolumeUsd: number | null;
  profitLossUsd: number | null;
  roi: number | null;

  // Import metadata
  importedAt: string;
  rawData: Record<string, unknown>; // Original API response for debugging
}

// =============================================================================
// PLATFORM LINK
// =============================================================================

export interface ExternalPlatformLink {
  id: string;
  forecasterPubkey: string;

  // Platform identity
  platform: ExternalPlatform;
  platformUserId: string;
  platformProfileUrl: string | null;

  // Verification
  verifiedAt: string | null;
  verificationMethod: VerificationMethod | null;
  verificationProof: string | null;

  // Imported stats (snapshot at import time)
  importedStats: ImportedStats;

  // Refresh tracking
  lastRefreshedAt: string;
  refreshIntervalDays: number;
  autoRefreshEnabled: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// VERIFICATION
// =============================================================================

export interface OwnershipProof {
  type: AuthMethod;
  data: {
    // For oauth
    accessToken?: string;
    // For wallet_signature
    message?: string;
    signature?: string;
    walletType?: 'solana' | 'ethereum';
    // For profile_code
    code?: string;
    // For api_key
    key?: string;
  };
}

export interface VerificationResult {
  verified: boolean;
  error?: string;
  profileUrl?: string;
}

export interface VerificationCode {
  id: string;
  forecasterPubkey: string;
  platform: ExternalPlatform;
  platformUserId: string;
  code: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

// =============================================================================
// COMPOSITE SCORING
// =============================================================================

export interface ScoreComponent {
  source: 'beright' | ExternalPlatform;
  displayName: string;
  weight: number;
  normalizedScore: number; // 0-1 (1 = perfect)
  predictionCount: number;
  isVerified: boolean;
}

export interface OnChainMetrics {
  avgBrierScore: number;
  avgLogScore: number;
  accuracy: number;
  streakCorrect: number;
  maxStreakCorrect: number;
  marketsTraded: number;
}

export interface CompositeScoreResult {
  score: number;           // 0-10000
  tier: ForecasterTier;
  breakdown: ScoreComponent[];
  totalPredictions: number;
  lastCalculatedAt: string;

  // On-chain calibration metadata (from Solana calibration program)
  onChainVerified?: boolean;       // True if score came from on-chain
  calibrationMultiplier?: number;  // 0.9-1.1 based on bucket accuracy
  streakBonus?: number;            // 1.0+ based on prediction streaks
  onChainMetrics?: OnChainMetrics; // Detailed on-chain stats
}

export interface CompositeScoreInput {
  // Native BeRight score (on-chain)
  berightBrier: number | null;
  berightPredictions: number;

  // Imported scores (from linked platforms)
  importedScores: {
    platform: ExternalPlatform;
    brier: number;
    predictions: number;
    weight: number;
    isVerified: boolean;
  }[];
}

// =============================================================================
// FORECASTER PROFILE
// =============================================================================

export interface ForecasterProfileWithImports {
  // Core identity
  id: string;
  pubkey: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;

  // Social links
  twitterHandle: string | null;
  telegramUsername: string | null;

  // Native BeRight stats (from on-chain)
  nativeStats: {
    brierScore: number | null;
    predictionCount: number;
    resolvedCount: number;
    accuracy: number | null;
    calibrationBuckets: number[][] | null;
    streak: number;
    maxStreak: number;
    lastPredictionAt: string | null;
  };

  // Linked external platforms
  linkedPlatforms: ExternalPlatformLink[];

  // Composite score (weighted average of all platforms)
  compositeScore: number;
  compositeTier: ForecasterTier;

  // Score breakdown for transparency
  scoreBreakdown: ScoreComponent[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// PLATFORM CONNECTOR INTERFACE
// =============================================================================

export interface PlatformConnector {
  platform: ExternalPlatform;

  // Verify user owns this account
  verifyOwnership(userId: string, proof: OwnershipProof): Promise<VerificationResult>;

  // Fetch forecaster stats from platform
  fetchStats(userId: string): Promise<ImportedStats>;

  // Normalize platform-specific score to Brier (0-1)
  normalizeToBrier(platformData: unknown): number | null;

  // Check if user exists on platform
  userExists(userId: string): Promise<boolean>;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface LinkPlatformRequest {
  platform: ExternalPlatform;
  platformUserId: string;
  proof: OwnershipProof;
}

export interface LinkPlatformResponse {
  success: boolean;
  link?: ExternalPlatformLink;
  error?: string;
}

export interface GenerateCodeRequest {
  forecasterPubkey: string;
  platform: ExternalPlatform;
  platformUserId: string;
}

export interface GenerateCodeResponse {
  code: string;
  expiresAt: string;
  instructions: string;
}

export interface CheckCodeRequest {
  forecasterPubkey: string;
  platform: ExternalPlatform;
  platformUserId: string;
  code: string;
}

export interface CheckCodeResponse {
  verified: boolean;
  profileUrl?: string;
  error?: string;
}

export interface CompositeScoreResponse {
  compositeScore: number;
  tier: ForecasterTier;
  breakdown: ScoreComponent[];
  lastCalculatedAt: string;
}

export interface LinkedPlatformsResponse {
  platforms: ExternalPlatformLink[];
}

export interface LeaderboardEntry {
  rank: number;
  forecaster: {
    pubkey: string;
    displayName: string | null;
    avatarUrl: string | null;
    tier: ForecasterTier;
  };
  compositeScore: number;
  nativeBrier: number | null;
  linkedPlatforms: ExternalPlatform[];
  totalPredictions: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}
