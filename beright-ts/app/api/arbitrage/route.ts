/**
 * Arbitrage API Route
 * GET /api/arbitrage - Scan for arbitrage opportunities
 * GET /api/arbitrage?q=bitcoin - Search specific topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext } from '../../../lib/apiMiddleware';
import { scanAll, ArbitrageOpportunity } from '../../../skills/arbitrage';
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

    // Scan for arbitrage
    const allOpportunities = await scanAll(query);

    // Filter by minimum spread
    const opportunities = allOpportunities
      .filter(opp => opp.spread >= minSpread)
      .slice(0, limit);

    const duration = timer();
    log.logSkillExecution({
      name: 'arbitrage.scan',
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      query: query || 'all',
      count: opportunities.length,
      opportunities: opportunities.map(opp => ({
        topic: opp.topic,
        platformA: opp.platformA,
        platformB: opp.platformB,
        marketA: opp.marketA,
        marketB: opp.marketB,
        priceAYes: opp.priceAYes,
        priceBYes: opp.priceBYes,
        spread: opp.spread,
        profitPercent: opp.profitPercent,
        strategy: opp.strategy,
        confidence: opp.matchConfidence,
        urlA: opp.urlA,
        urlB: opp.urlB,
      })),
      scannedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'arbitrage',
    querySchema,
    cache: { maxAge: 30, staleWhileRevalidate: 60 },
  }
);
