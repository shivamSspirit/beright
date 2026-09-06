/**
 * Platform Registry
 *
 * Metadata and verification configuration for legacy external account links.
 */

import type { ExternalPlatform, AuthMethod, ScoringType } from './types';

// =============================================================================
// PLATFORM REGISTRY
// =============================================================================

export interface PlatformRegistryEntry {
  id: ExternalPlatform;
  displayName: string;
  shortName: string;
  logoUrl: string;
  websiteUrl: string;
  profileUrlTemplate: string;

  // Reputation
  tier: 1 | 2 | 3;
  reputationWeight: number;

  // Capabilities
  apiAvailable: boolean;
  authMethods: AuthMethod[];
  canAutoRefresh: boolean;
  scoringType: ScoringType;

  // API details
  apiBaseUrl: string | null;
  rateLimitPerMinute: number | null;
  requiresAuth: boolean;

  // Verification instructions
  verificationInstructions: string;
}

export const PLATFORM_REGISTRY: Record<ExternalPlatform, PlatformRegistryEntry> = {
  metaculus: {
    id: 'metaculus',
    displayName: 'Metaculus',
    shortName: 'MC',
    logoUrl: '/logos/metaculus.svg',
    websiteUrl: 'https://www.metaculus.com',
    profileUrlTemplate: 'https://www.metaculus.com/accounts/profile/{userId}/',
    tier: 1,
    reputationWeight: 1.5,
    apiAvailable: true,
    authMethods: ['profile_code'],
    canAutoRefresh: true,
    scoringType: 'brier',
    apiBaseUrl: 'https://www.metaculus.com/api2',
    rateLimitPerMinute: 60,
    requiresAuth: false,
    verificationInstructions:
      'Add the verification code to your Metaculus bio/about section, then click Verify.',
  },

  manifold: {
    id: 'manifold',
    displayName: 'Manifold Markets',
    shortName: 'MF',
    logoUrl: '/logos/manifold.svg',
    websiteUrl: 'https://manifold.markets',
    profileUrlTemplate: 'https://manifold.markets/{userId}',
    tier: 2,
    reputationWeight: 1.2,
    apiAvailable: true,
    authMethods: ['profile_code'],
    canAutoRefresh: true,
    scoringType: 'pnl', // Play money, but we calculate Brier from bets
    apiBaseUrl: 'https://api.manifold.markets/v0',
    rateLimitPerMinute: 100,
    requiresAuth: false,
    verificationInstructions:
      'Add the verification code to your Manifold bio, then click Verify.',
  },

  polymarket: {
    id: 'polymarket',
    displayName: 'Polymarket',
    shortName: 'PM',
    logoUrl: '/logos/polymarket.svg',
    websiteUrl: 'https://polymarket.com',
    profileUrlTemplate: 'https://polymarket.com/profile/{userId}',
    tier: 2,
    reputationWeight: 1.2,
    apiAvailable: true,
    authMethods: ['wallet_signature'],
    canAutoRefresh: true,
    scoringType: 'pnl',
    apiBaseUrl: 'https://gamma-api.polymarket.com',
    rateLimitPerMinute: 30,
    requiresAuth: false,
    verificationInstructions:
      'Sign a message with your Polygon wallet to prove ownership.',
  },

  goodjudgment: {
    id: 'goodjudgment',
    displayName: 'Good Judgment Open',
    shortName: 'GJO',
    logoUrl: '/logos/goodjudgment.svg',
    websiteUrl: 'https://www.gjopen.com',
    profileUrlTemplate: 'https://www.gjopen.com/forecaster/{userId}',
    tier: 1,
    reputationWeight: 1.5,
    apiAvailable: false,
    authMethods: ['profile_code', 'manual_review'],
    canAutoRefresh: false, // Requires scraping
    scoringType: 'brier',
    apiBaseUrl: null,
    rateLimitPerMinute: null,
    requiresAuth: false,
    verificationInstructions:
      'Add the verification code to your GJO profile bio, then click Verify. May require manual review.',
  },

  kalshi: {
    id: 'kalshi',
    displayName: 'Kalshi',
    shortName: 'KS',
    logoUrl: '/logos/kalshi.svg',
    websiteUrl: 'https://kalshi.com',
    profileUrlTemplate: 'https://kalshi.com/profile/{userId}',
    tier: 2,
    reputationWeight: 1.3,
    apiAvailable: true,
    authMethods: [],
    canAutoRefresh: false,
    scoringType: 'pnl',
    apiBaseUrl: 'https://trading-api.kalshi.com/trade-api/v2',
    rateLimitPerMinute: 100,
    requiresAuth: true,
    verificationInstructions:
      'Kalshi linking is unavailable until secure OAuth or scoped read-only verification is implemented. BeRight never accepts raw Kalshi credentials.',
  },

  infer: {
    id: 'infer',
    displayName: 'INFER',
    shortName: 'INF',
    logoUrl: '/logos/infer.svg',
    websiteUrl: 'https://www.infer-pub.com',
    profileUrlTemplate: 'https://www.infer-pub.com/forecaster/{userId}',
    tier: 1,
    reputationWeight: 1.4,
    apiAvailable: false,
    authMethods: ['profile_code', 'manual_review'],
    canAutoRefresh: false,
    scoringType: 'brier',
    apiBaseUrl: null,
    rateLimitPerMinute: null,
    requiresAuth: false,
    verificationInstructions:
      'Add the verification code to your INFER profile, then click Verify. May require manual review.',
  },

  hypermind: {
    id: 'hypermind',
    displayName: 'Hypermind',
    shortName: 'HM',
    logoUrl: '/logos/hypermind.svg',
    websiteUrl: 'https://www.hypermind.com',
    profileUrlTemplate: 'https://www.hypermind.com/hypermind/app.html#user/{userId}',
    tier: 3,
    reputationWeight: 1.0,
    apiAvailable: false,
    authMethods: ['profile_code', 'manual_review'],
    canAutoRefresh: false,
    scoringType: 'accuracy',
    apiBaseUrl: null,
    rateLimitPerMinute: null,
    requiresAuth: false,
    verificationInstructions:
      'Add the verification code to your Hypermind profile, then click Verify. May require manual review.',
  },

  predictit: {
    id: 'predictit',
    displayName: 'PredictIt',
    shortName: 'PI',
    logoUrl: '/logos/predictit.svg',
    websiteUrl: 'https://www.predictit.org',
    profileUrlTemplate: 'https://www.predictit.org/profile/{userId}',
    tier: 3,
    reputationWeight: 0.9,
    apiAvailable: false,
    authMethods: ['manual_review'],
    canAutoRefresh: false,
    scoringType: 'pnl',
    apiBaseUrl: null,
    rateLimitPerMinute: null,
    requiresAuth: false,
    verificationInstructions:
      'PredictIt verification requires manual review. Submit your profile URL.',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get platforms by tier
 */
export function getPlatformsByTier(tier: 1 | 2 | 3): ExternalPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, entry]) => entry.tier === tier)
    .map(([id]) => id as ExternalPlatform);
}

/**
 * Get platforms with API support
 */
export function getApiSupportedPlatforms(): ExternalPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, entry]) => entry.apiAvailable)
    .map(([id]) => id as ExternalPlatform);
}

/**
 * Get platforms that support auto-refresh
 */
export function getAutoRefreshPlatforms(): ExternalPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, entry]) => entry.canAutoRefresh)
    .map(([id]) => id as ExternalPlatform);
}

/**
 * Get display name for platform
 */
export function getPlatformDisplayName(platform: ExternalPlatform): string {
  return PLATFORM_REGISTRY[platform].displayName;
}

/**
 * Get profile URL for user
 */
export function getPlatformProfileUrl(
  platform: ExternalPlatform,
  userId: string
): string {
  return PLATFORM_REGISTRY[platform].profileUrlTemplate.replace('{userId}', userId);
}

/**
 * Check if platform supports verification method
 */
export function supportsAuthMethod(
  platform: ExternalPlatform,
  method: AuthMethod
): boolean {
  return PLATFORM_REGISTRY[platform].authMethods.includes(method);
}

/**
 * Platform display names for score breakdown
 */
export const PLATFORM_DISPLAY_NAMES: Record<'beright' | ExternalPlatform, string> = {
  beright: 'BeRight (Native)',
  metaculus: 'Metaculus',
  manifold: 'Manifold Markets',
  goodjudgment: 'Good Judgment Open',
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
  infer: 'INFER',
  hypermind: 'Hypermind',
  predictit: 'PredictIt',
};

// =============================================================================
// REPUTATION CRITERIA
// =============================================================================

/**
 * Criteria used to determine if a platform is reputable.
 * All required fields must be true, plus minimum thresholds.
 */
export interface ReputationCriteria {
  // Required (all must be true)
  hasTransparentScoring: boolean;
  marketsActuallyResolve: boolean;
  hasAntiGamingMeasures: boolean;
  operatingYears: number;

  // High signal (bonus weight)
  hasAcademicBacking?: boolean;
  hasInstitutionalBacking?: boolean;
  realMoneyAtStake?: boolean;

  // Minimum thresholds
  monthlyActiveUsers: number;
  questionsResolved: number;
}

/**
 * Check if a platform meets minimum reputation criteria
 */
export function isPlatformReputable(criteria: ReputationCriteria): boolean {
  return (
    criteria.hasTransparentScoring &&
    criteria.marketsActuallyResolve &&
    criteria.hasAntiGamingMeasures &&
    criteria.operatingYears >= 1 &&
    criteria.monthlyActiveUsers >= 1000 &&
    criteria.questionsResolved >= 100
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  PLATFORM_REGISTRY,
  PLATFORM_DISPLAY_NAMES,
  getPlatformsByTier,
  getApiSupportedPlatforms,
  getAutoRefreshPlatforms,
  getPlatformDisplayName,
  getPlatformProfileUrl,
  supportsAuthMethod,
  isPlatformReputable,
};
