/**
 * Arbitrage API Route
 * GET /api/arbitrage - Scan for arbitrage opportunities
 * GET /api/arbitrage?q=bitcoin - Search specific topic
 *
 * V2 UPDATE: Now uses production-grade scanner with proper market matching
 * to eliminate false positives (e.g., "LIV Golf" vs "AI bubble")
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext } from '../../../lib/apiMiddleware';
import { scanForArbitrage, DEFAULT_ARBITRAGE_CONFIG } from '../../../lib/arbitrage';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('arbitrage');

// Query parameter validation
const querySchema = z.object({
  q: z.string().max(200).optional(),
  minSpread: z.string().regex(/^\d+(\.\d+)?$/).optional().transform(v => v ? parseFloat(v) : 0.02),
  limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v) : 10),
}).strict();

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || undefined;
    const minSpread = parseFloat(searchParams.get('minSpread') || '0.02');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Use V2 production scanner (same as telegram)
    const result = await scanForArbitrage({
      query,
      verbose: false,
      minConfidenceGrade: 'F', // Return all, let client filter
      maxOpportunities: limit,
      platforms: ['polymarket', 'kalshi', 'manifold'],
      arbConfig: {
        ...DEFAULT_ARBITRAGE_CONFIG,
        minEquivalenceScore: 0.35,
        minTitleSimilarity: 0.25,
        minNetProfitPct: minSpread,
        maxDateDriftDays: 60,
      },
    });

    const duration = timer();
    log.logSkillExecution({
      name: 'arbitrage.scan',
      duration,
      success: true,
    });

    // Transform V2 results to legacy format for backwards compatibility
    const opportunities = result.opportunities.map(opp => ({
      topic: opp.pair.marketA.title.slice(0, 60),
      platformA: opp.pair.marketA.platform,
      platformB: opp.pair.marketB.platform,
      marketATitle: opp.pair.marketA.title.slice(0, 50),
      marketBTitle: opp.pair.marketB.title.slice(0, 50),
      priceAYes: opp.pair.marketA.yesPrice,
      priceBYes: opp.pair.marketB.yesPrice,
      spread: Math.abs(opp.pair.marketA.yesPrice - opp.pair.marketB.yesPrice),
      profitPercent: opp.netProfitPct * 100,
      strategy: opp.strategy.description,
      confidence: opp.pair.equivalence.overallScore,
      volumeA: opp.pair.marketA.volume,
      volumeB: opp.pair.marketB.volume,
      // V2 additional data
      confidenceGrade: opp.confidence.grade,
      riskScore: opp.risk.overallRiskScore,
      netProfitPct: opp.netProfitPct,
      isSafe: opp.risk.isSafe,
    }));

    return NextResponse.json({
      success: true,
      query: query || 'all',
      count: opportunities.length,
      opportunities,
      // V2 stats
      stats: {
        marketsScanned: result.totalMarkets,
        pairsValidated: result.pairsValidated,
        avgEquivalence: result.avgEquivalenceScore,
        scanDurationMs: result.duration,
      },
      scannedAt: new Date().toISOString(),
      version: 'v2', // Indicate we're using V2 scanner
    });
  },
  {
    rateLimit: 'arbitrage',
    querySchema,
    cache: { maxAge: 30, staleWhileRevalidate: 60 },
  }
);
