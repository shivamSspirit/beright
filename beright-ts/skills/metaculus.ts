/**
 * Metaculus API Integration for BeRight Protocol
 * 5th prediction platform — high-quality community forecasts
 * Free, no auth required
 *
 * API v2 (2025+): predictions are in post.question.aggregations.recency_weighted.latest.centers[0]
 * type is in post.question.type, sort by -forecasters_count for active questions
 */

import { Market, Platform } from '../types/index';

const METACULUS_BASE = 'https://www.metaculus.com/api2';

// Response cache (30s TTL)
let metaculusCache: { data: Market[]; query: string; expiry: number } | null = null;

interface MetaculusPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  resolved: boolean;
  scheduled_close_time: string | null;
  nr_forecasters: number;
  forecasts_count: number;
  question?: {
    id: number;
    title: string;
    type: string; // 'binary' | 'numeric' | 'multiple_choice' | 'date'
    aggregations?: {
      recency_weighted?: {
        latest?: {
          centers?: number[];
          forecaster_count?: number;
        };
      };
    };
  };
}

/**
 * Extract probability from the new Metaculus API structure
 */
function extractProbability(post: MetaculusPost): number | null {
  const centers = post.question?.aggregations?.recency_weighted?.latest?.centers;
  if (centers && centers.length > 0) {
    return centers[0];
  }
  return null;
}

/**
 * Search Metaculus questions
 */
export async function fetchMetaculus(query?: string, limit = 15): Promise<Market[]> {
  // Check cache
  const cacheKey = query || '';
  if (metaculusCache && metaculusCache.query === cacheKey && metaculusCache.expiry > Date.now()) {
    return metaculusCache.data.slice(0, limit);
  }

  try {
    const params = new URLSearchParams({
      limit: Math.min(limit, 20).toString(),
      status: 'open',
      order_by: query ? '-activity' : '-forecasters_count',
    });

    if (query) {
      params.set('search', query);
    }

    const url = `${METACULUS_BASE}/questions/?${params.toString()}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = await response.json() as { results: MetaculusPost[] };
    const posts = data.results || [];

    const result = posts
      .filter(p => {
        // Must be a binary question with community prediction data
        return p.question?.type === 'binary' && extractProbability(p) !== null;
      })
      .slice(0, limit)
      .map(p => {
        const probability = extractProbability(p) ?? 0.5;

        return {
          platform: 'metaculus' as Platform,
          marketId: p.id.toString(),
          title: p.title,
          question: p.title,
          yesPrice: probability,
          noPrice: 1 - probability,
          yesPct: probability * 100,
          noPct: (1 - probability) * 100,
          volume: p.forecasts_count || p.nr_forecasters || 0,
          liquidity: p.nr_forecasters || 0,
          endDate: p.scheduled_close_time ? new Date(p.scheduled_close_time) : null,
          status: (p.resolved ? 'resolved' : 'active') as 'active' | 'resolved',
          url: `https://www.metaculus.com/questions/${p.id}/${p.slug || ''}/`,
        };
      });

    metaculusCache = { data: result, query: cacheKey, expiry: Date.now() + 30_000 };
    return result;
  } catch (error) {
    console.error('Metaculus fetch error:', error);
    return [];
  }
}

/**
 * Get Metaculus question by ID
 */
export async function getMetaculusQuestion(id: number): Promise<Market | null> {
  try {
    const url = `${METACULUS_BASE}/questions/${id}/`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const p = await response.json() as MetaculusPost;
    const probability = extractProbability(p) ?? 0.5;

    return {
      platform: 'metaculus' as Platform,
      marketId: p.id.toString(),
      title: p.title,
      question: p.title,
      yesPrice: probability,
      noPrice: 1 - probability,
      yesPct: probability * 100,
      noPct: (1 - probability) * 100,
      volume: p.forecasts_count || p.nr_forecasters || 0,
      liquidity: p.nr_forecasters || 0,
      endDate: p.scheduled_close_time ? new Date(p.scheduled_close_time) : null,
      status: (p.resolved ? 'resolved' : 'active') as 'active' | 'resolved',
      url: `https://www.metaculus.com/questions/${p.id}/${p.slug || ''}/`,
    };
  } catch {
    return null;
  }
}

// CLI interface
if (process.argv[1]?.endsWith('metaculus.ts')) {
  const query = process.argv.slice(2).join(' ') || '';
  (async () => {
    console.log(`Searching Metaculus for: ${query || '(trending)'}...`);
    const markets = await fetchMetaculus(query || undefined);
    if (markets.length === 0) {
      console.log('No results found.');
      return;
    }
    for (const m of markets) {
      console.log(`  ${m.title.slice(0, 60)}`);
      console.log(`    YES: ${m.yesPct.toFixed(1)}% | Forecasters: ${m.liquidity}`);
      console.log(`    ${m.url}\n`);
    }
  })();
}
