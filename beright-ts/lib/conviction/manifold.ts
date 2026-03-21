/**
 * BeRight Conviction - Manifold Integration
 *
 * Creates conviction markets on Manifold Markets platform
 * and syncs market data back to BeRight.
 *
 * Requires MANIFOLD_API_KEY environment variable for market creation.
 *
 * @author BeRight Protocol
 */

import { ConvictionMarket, ConvictionProject, MilestoneType } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MANIFOLD_API = 'https://api.manifold.markets/v0';
const REQUEST_TIMEOUT = 15000;

/**
 * Get Manifold API key from environment
 */
function getApiKey(): string | null {
  return process.env.MANIFOLD_API_KEY || null;
}

/**
 * Check if Manifold API is configured
 */
export function isManifoldConfigured(): boolean {
  return !!getApiKey();
}

// ============================================================================
// TYPES
// ============================================================================

interface ManifoldMarketResponse {
  id: string;
  slug: string;
  url: string;
  creatorUsername: string;
  question: string;
  probability: number;
  volume: number;
  totalLiquidity: number;
  closeTime: number;
  isResolved: boolean;
  resolution?: 'YES' | 'NO' | 'MKT' | 'CANCEL';
}

interface CreateManifoldMarketRequest {
  question: string;
  description: string;
  closeTime: number; // Unix timestamp in ms
  outcomeType: 'BINARY';
  initialProb: number; // 1-99
  visibility: 'public';
  groupIds?: string[];
}

interface ManifoldCreateResult {
  success: boolean;
  marketId?: string;
  slug?: string;
  url?: string;
  error?: string;
}

interface ManifoldSyncResult {
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  isResolved: boolean;
  resolution?: 'yes' | 'no' | 'invalid';
}

// ============================================================================
// MARKET CREATION
// ============================================================================

/**
 * Create a conviction market on Manifold
 */
export async function createManifoldMarket(
  market: ConvictionMarket,
  project: ConvictionProject
): Promise<ManifoldCreateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Manifold API key not configured',
    };
  }

  try {
    // Build market description with conviction context
    const description = buildManifoldDescription(market, project);

    // Create market request
    const request: CreateManifoldMarketRequest = {
      question: market.question,
      description,
      closeTime: market.resolutionDate.getTime(),
      outcomeType: 'BINARY',
      initialProb: 50, // Start at 50%
      visibility: 'public',
      groupIds: getGroupIds(market.milestoneType),
    };

    const response = await fetch(`${MANIFOLD_API}/market`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Manifold] Create market error:', response.status, errorText);
      return {
        success: false,
        error: `Manifold API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as ManifoldMarketResponse;

    return {
      success: true,
      marketId: data.id,
      slug: data.slug,
      url: data.url || `https://manifold.markets/${data.creatorUsername}/${data.slug}`,
    };
  } catch (error) {
    console.error('[Manifold] Create market exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build Manifold market description with conviction context
 */
function buildManifoldDescription(
  market: ConvictionMarket,
  project: ConvictionProject
): string {
  const parts: string[] = [];

  // Market description
  if (market.description) {
    parts.push(market.description);
    parts.push('');
  }

  // Conviction context
  parts.push('---');
  parts.push('**BeRight Conviction Market**');
  parts.push('');
  parts.push(`**Project:** ${project.name}`);
  parts.push(`**Conviction Score:** ${project.convictionScore}/100`);
  parts.push(`**Project Stake:** ${market.projectStake.amount} SOL on ${market.projectStake.position.toUpperCase()}`);
  parts.push('');
  parts.push(`**Resolution Criteria:** ${market.resolutionCriteria}`);
  parts.push(`**Resolution Source:** ${formatResolutionSource(market.resolutionSource)}`);
  parts.push('');
  parts.push(`Track this project: https://beright.ai/conviction/${project.slug}`);

  return parts.join('\n');
}

/**
 * Format resolution source for display
 */
function formatResolutionSource(source: string): string {
  const sources: Record<string, string> = {
    on_chain: 'On-chain verification',
    api: 'API data verification',
    manual: 'Manual verification by project',
    oracle: 'Oracle feed',
    ai_query: 'AI LLM citation check',
  };
  return sources[source] || source;
}

/**
 * Get Manifold group IDs for milestone type
 * These are hardcoded Manifold group IDs for categorization
 */
function getGroupIds(milestoneType: MilestoneType): string[] | undefined {
  // Manifold crypto/DeFi group IDs (placeholder - would need actual IDs)
  const groups: Record<MilestoneType, string[] | undefined> = {
    mainnet_launch: undefined,
    user_milestone: undefined,
    tvl_milestone: undefined,
    token_launch: undefined,
    partnership: undefined,
    audit_completion: undefined,
    feature_release: undefined,
    revenue_milestone: undefined,
    funding_round: undefined,
    ai_visibility: undefined,
    custom: undefined,
  };
  return groups[milestoneType];
}

// ============================================================================
// MARKET SYNC
// ============================================================================

/**
 * Fetch current market data from Manifold
 */
export async function syncManifoldMarket(
  externalId: string
): Promise<ManifoldSyncResult | null> {
  try {
    const response = await fetch(`${MANIFOLD_API}/market/${externalId}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      console.error('[Manifold] Sync error:', response.status);
      return null;
    }

    const data = (await response.json()) as ManifoldMarketResponse;

    // Map resolution
    let resolution: 'yes' | 'no' | 'invalid' | undefined;
    if (data.isResolved && data.resolution) {
      if (data.resolution === 'YES') resolution = 'yes';
      else if (data.resolution === 'NO') resolution = 'no';
      else resolution = 'invalid';
    }

    return {
      yesPrice: data.probability,
      noPrice: 1 - data.probability,
      volume: data.volume || 0,
      liquidity: data.totalLiquidity || 0,
      isResolved: data.isResolved,
      resolution,
    };
  } catch (error) {
    console.error('[Manifold] Sync exception:', error);
    return null;
  }
}

/**
 * Batch sync multiple markets
 */
export async function syncManifoldMarkets(
  externalIds: string[]
): Promise<Map<string, ManifoldSyncResult | null>> {
  const results = new Map<string, ManifoldSyncResult | null>();

  // Sync in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < externalIds.length; i += CONCURRENCY) {
    const batch = externalIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (id) => ({
        id,
        result: await syncManifoldMarket(id),
      }))
    );
    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }

  return results;
}

// ============================================================================
// MARKET RESOLUTION
// ============================================================================

/**
 * Resolve a market on Manifold (requires moderator permissions)
 *
 * Note: Only the market creator or Manifold moderators can resolve markets.
 * This function is for when BeRight is the market creator.
 */
export async function resolveManifoldMarket(
  externalId: string,
  outcome: 'YES' | 'NO' | 'MKT' | 'CANCEL'
): Promise<{ success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Manifold API key not configured',
    };
  }

  try {
    const response = await fetch(`${MANIFOLD_API}/market/${externalId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({ outcome }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Manifold resolution error: ${response.status} - ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get Manifold market URL from ID or slug
 */
export function getManifoldMarketUrl(slug: string, creatorUsername?: string): string {
  if (creatorUsername) {
    return `https://manifold.markets/${creatorUsername}/${slug}`;
  }
  return `https://manifold.markets/market/${slug}`;
}

/**
 * Health check for Manifold API
 */
export async function isManifoldHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${MANIFOLD_API}/search-markets?term=&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const manifold = {
  isConfigured: isManifoldConfigured,
  createMarket: createManifoldMarket,
  syncMarket: syncManifoldMarket,
  syncMarkets: syncManifoldMarkets,
  resolveMarket: resolveManifoldMarket,
  getMarketUrl: getManifoldMarketUrl,
  isHealthy: isManifoldHealthy,
};

export default manifold;
