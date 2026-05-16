/**
 * Correlated Market Extraction
 *
 * Identifies and tracks relationships between markets:
 *   - Price correlation (movement similarity)
 *   - Semantic correlation (topic similarity via embeddings)
 *   - Cross-platform matching (same event on different platforms)
 *
 * Used by Scout to provide richer signal context.
 *
 * Usage:
 *   const related = await findCorrelatedMarkets(marketId);
 *   const clusters = await getMarketClusters();
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { findSimilarMarkets, generateEmbedding, cosineSimilarity, isEmbeddingsConfigured } from '../embeddings';

export interface CorrelatedMarket {
  marketId: string;
  platform: string;
  title: string;
  correlationType: 'price' | 'semantic' | 'cross_platform';
  correlationScore: number;
  priceCorrelation?: number;
  semanticSimilarity?: number;
}

export interface MarketCluster {
  id: string;
  name: string;
  markets: Array<{
    marketId: string;
    platform: string;
    title: string;
  }>;
  avgCorrelation: number;
  theme?: string;
}

/**
 * Find correlated markets using multiple methods
 */
export async function findCorrelatedMarkets(
  marketId: string,
  platform: string,
  options?: {
    limit?: number;
    minCorrelation?: number;
    methods?: ('price' | 'semantic' | 'cross_platform')[];
  }
): Promise<CorrelatedMarket[]> {
  if (!isSupabaseConfigured) return [];

  const limit = options?.limit || 5;
  const minCorrelation = options?.minCorrelation || 0.5;
  const methods = options?.methods || ['price', 'semantic', 'cross_platform'];

  const results: CorrelatedMarket[] = [];

  // Get source market info
  const { data: sourceMarket } = await supabaseAdmin
    .from('market_cache')
    .select('title, category')
    .eq('market_id', marketId)
    .eq('platform', platform)
    .single();

  if (!sourceMarket) return [];

  // 1. Price correlation (from price_snapshots)
  if (methods.includes('price')) {
    const priceCorrelated = await findPriceCorrelatedMarkets(
      marketId,
      platform,
      limit,
      minCorrelation
    );
    results.push(...priceCorrelated);
  }

  // 2. Semantic correlation (from embeddings)
  if (methods.includes('semantic') && isEmbeddingsConfigured()) {
    const semanticCorrelated = await findSemanticCorrelatedMarkets(
      sourceMarket.title,
      marketId,
      platform,
      limit,
      minCorrelation
    );
    results.push(...semanticCorrelated);
  }

  // 3. Cross-platform matching
  if (methods.includes('cross_platform')) {
    const crossPlatform = await findCrossPlatformMarkets(
      sourceMarket.title,
      marketId,
      platform,
      limit
    );
    results.push(...crossPlatform);
  }

  // Deduplicate and sort by correlation
  const seen = new Set<string>();
  return results
    .filter(r => {
      const key = `${r.marketId}:${r.platform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.correlationScore - a.correlationScore)
    .slice(0, limit);
}

/**
 * Find markets with correlated price movements
 */
async function findPriceCorrelatedMarkets(
  marketId: string,
  platform: string,
  limit: number,
  minCorrelation: number
): Promise<CorrelatedMarket[]> {
  try {
    // Get price history for source market
    const { data: sourcePrices } = await supabaseAdmin
      .from('price_snapshots')
      .select('yes_price, snapshot_at')
      .eq('market_id', marketId)
      .order('snapshot_at', { ascending: true })
      .limit(100);

    if (!sourcePrices || sourcePrices.length < 10) return [];

    // Get other markets with price data
    const { data: otherMarkets } = await supabaseAdmin
      .from('price_snapshots')
      .select('market_id, platform')
      .neq('market_id', marketId)
      .order('snapshot_at', { ascending: false })
      .limit(500);

    if (!otherMarkets) return [];

    // Unique markets
    const uniqueMarkets = new Map<string, string>();
    for (const m of otherMarkets) {
      uniqueMarkets.set(m.market_id, m.platform);
    }

    const results: CorrelatedMarket[] = [];

    // Calculate correlation for each market
    for (const [otherId, otherPlatform] of uniqueMarkets) {
      const { data: otherPrices } = await supabaseAdmin
        .from('price_snapshots')
        .select('yes_price, snapshot_at')
        .eq('market_id', otherId)
        .order('snapshot_at', { ascending: true })
        .limit(100);

      if (!otherPrices || otherPrices.length < 10) continue;

      // Calculate Pearson correlation
      const correlation = calculatePriceCorrelation(
        sourcePrices.map(p => p.yes_price),
        otherPrices.map(p => p.yes_price)
      );

      if (Math.abs(correlation) >= minCorrelation) {
        // Get market title
        const { data: marketInfo } = await supabaseAdmin
          .from('market_cache')
          .select('title')
          .eq('market_id', otherId)
          .single();

        results.push({
          marketId: otherId,
          platform: otherPlatform,
          title: marketInfo?.title || otherId,
          correlationType: 'price',
          correlationScore: Math.abs(correlation),
          priceCorrelation: correlation,
        });
      }

      if (results.length >= limit * 2) break;
    }

    return results.slice(0, limit);
  } catch (err) {
    console.warn('[Correlation] Price correlation error:', err);
    return [];
  }
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePriceCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;

  const aTrimmed = a.slice(-n);
  const bTrimmed = b.slice(-n);

  const meanA = aTrimmed.reduce((s, x) => s + x, 0) / n;
  const meanB = bTrimmed.reduce((s, x) => s + x, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = aTrimmed[i] - meanA;
    const diffB = bTrimmed[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Find semantically similar markets using embeddings
 */
async function findSemanticCorrelatedMarkets(
  title: string,
  marketId: string,
  platform: string,
  limit: number,
  minCorrelation: number
): Promise<CorrelatedMarket[]> {
  try {
    const similar = await findSimilarMarkets(title, {
      limit: limit + 1,
      threshold: minCorrelation,
    });

    return similar
      .filter(s => s.id !== marketId)
      .slice(0, limit)
      .map(s => ({
        marketId: s.id,
        platform: (s.metadata as any)?.platform || 'unknown',
        title: s.title || s.id,
        correlationType: 'semantic' as const,
        correlationScore: s.similarity,
        semanticSimilarity: s.similarity,
      }));
  } catch (err) {
    console.warn('[Correlation] Semantic correlation error:', err);
    return [];
  }
}

/**
 * Find same event on different platforms
 */
async function findCrossPlatformMarkets(
  title: string,
  marketId: string,
  platform: string,
  limit: number
): Promise<CorrelatedMarket[]> {
  try {
    // Extract key terms from title
    const keyTerms = extractKeyTerms(title);
    if (keyTerms.length === 0) return [];

    // Search for similar titles on other platforms
    const searchPattern = keyTerms.slice(0, 3).join('%');

    const { data: matches } = await supabaseAdmin
      .from('market_cache')
      .select('market_id, platform, title')
      .neq('market_id', marketId)
      .neq('platform', platform)
      .ilike('title', `%${searchPattern}%`)
      .limit(limit * 2);

    if (!matches) return [];

    // Calculate title similarity
    return matches
      .map(m => ({
        marketId: m.market_id,
        platform: m.platform,
        title: m.title,
        correlationType: 'cross_platform' as const,
        correlationScore: calculateTitleSimilarity(title, m.title),
      }))
      .filter(m => m.correlationScore >= 0.5)
      .sort((a, b) => b.correlationScore - a.correlationScore)
      .slice(0, limit);
  } catch (err) {
    console.warn('[Correlation] Cross-platform error:', err);
    return [];
  }
}

/**
 * Extract key terms from market title
 */
function extractKeyTerms(title: string): string[] {
  const stopWords = new Set([
    'will', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'by',
    'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has',
    'do', 'does', 'did', 'done', 'can', 'could', 'would', 'should',
    'this', 'that', 'these', 'those', 'and', 'or', 'but', 'if', 'then',
    'before', 'after', 'during', 'above', 'below', 'between',
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Calculate Jaccard similarity between titles
 */
function calculateTitleSimilarity(a: string, b: string): number {
  const termsA = new Set(extractKeyTerms(a));
  const termsB = new Set(extractKeyTerms(b));

  if (termsA.size === 0 || termsB.size === 0) return 0;

  const intersection = [...termsA].filter(t => termsB.has(t)).length;
  const union = new Set([...termsA, ...termsB]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Get market clusters (groups of related markets)
 */
export async function getMarketClusters(
  options?: { limit?: number; minSize?: number }
): Promise<MarketCluster[]> {
  if (!isSupabaseConfigured) return [];

  const limit = options?.limit || 10;
  const minSize = options?.minSize || 2;

  try {
    // Get categories with multiple markets
    const { data: categories } = await supabaseAdmin
      .from('market_cache')
      .select('category')
      .not('category', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (!categories) return [];

    // Count by category
    const categoryCounts = new Map<string, number>();
    for (const c of categories) {
      if (c.category) {
        categoryCounts.set(c.category, (categoryCounts.get(c.category) || 0) + 1);
      }
    }

    // Build clusters
    const clusters: MarketCluster[] = [];

    for (const [category, count] of categoryCounts) {
      if (count < minSize) continue;

      const { data: markets } = await supabaseAdmin
        .from('market_cache')
        .select('market_id, platform, title')
        .eq('category', category)
        .limit(10);

      if (markets && markets.length >= minSize) {
        clusters.push({
          id: `cluster_${category.toLowerCase().replace(/\s+/g, '_')}`,
          name: category,
          markets: markets.map(m => ({
            marketId: m.market_id,
            platform: m.platform,
            title: m.title,
          })),
          avgCorrelation: 0.7, // Assumed for category-based clusters
          theme: category,
        });
      }

      if (clusters.length >= limit) break;
    }

    return clusters;
  } catch (err) {
    console.warn('[Correlation] Cluster error:', err);
    return [];
  }
}

/**
 * Enhance signal with correlated market context
 */
export async function enrichSignalWithCorrelations(
  signal: { marketId: string; platform: string; marketTitle: string }
): Promise<{
  correlatedMarkets: CorrelatedMarket[];
  crossPlatformMatches: number;
  avgCorrelation: number;
}> {
  const correlated = await findCorrelatedMarkets(signal.marketId, signal.platform, {
    limit: 5,
    minCorrelation: 0.5,
  });

  const crossPlatform = correlated.filter(c => c.correlationType === 'cross_platform');

  return {
    correlatedMarkets: correlated,
    crossPlatformMatches: crossPlatform.length,
    avgCorrelation: correlated.length > 0
      ? correlated.reduce((sum, c) => sum + c.correlationScore, 0) / correlated.length
      : 0,
  };
}

/**
 * Format correlation context for Scout prompt
 */
export function formatCorrelationContext(
  correlatedMarkets: CorrelatedMarket[]
): string {
  if (correlatedMarkets.length === 0) return '';

  const lines = ['Related Markets:'];

  for (const m of correlatedMarkets.slice(0, 3)) {
    const typeLabel = {
      price: '📈',
      semantic: '🔗',
      cross_platform: '🌐',
    }[m.correlationType];

    lines.push(`${typeLabel} ${m.title.slice(0, 40)} (${m.platform}) — ${(m.correlationScore * 100).toFixed(0)}%`);
  }

  return lines.join('\n');
}
