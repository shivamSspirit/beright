/**
 * Arbitrage Opportunities API
 *
 * GET /api/v2/arbitrage - Get cross-platform arbitrage opportunities
 *
 * Returns CrossOdds-style arbitrage data:
 * - Trade instructions (buy YES on A + NO on B)
 * - Guaranteed profit calculations
 * - Quality/confidence ratings
 * - Platform details and direct links
 * - Live price data
 *
 * Demo Mode: Returns realistic mock arbitrage opportunities
 * Production Mode: Real-time cross-platform scanning
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDemoFromRequest } from '../../../../lib/mode';
import { generateMockSignature } from '../../../../lib/demo/mockConfirmations';

// ============================================
// TYPES
// ============================================

export interface ArbTradeLeg {
  platform: string;
  platformDisplayName: string;
  side: 'YES' | 'NO';
  price: number;          // 0-1 (e.g., 0.09 = 9¢)
  priceDisplay: string;   // "9.0¢"
  url: string;
  liquidity: number;
  volume24h: number;
}

export interface ArbOpportunity {
  id: string;

  // Quality Assessment
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  qualityScore: number;   // 0-100
  confidenceGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // The Trade
  trade: {
    leg1: ArbTradeLeg;
    leg2: ArbTradeLeg;
    totalCost: number;          // Combined cost (e.g., 0.96)
    totalCostDisplay: string;   // "96.0¢"
    guaranteedPayout: number;   // Always 1.00
    profit: number;             // Net profit (e.g., 0.04)
    profitDisplay: string;      // "4.0¢"
    profitPercent: number;      // 4.17

    // Execution instructions
    instruction: string;        // "Buy NO on Kalshi + YES on Polymarket"
  };

  // Market Details
  market: {
    question: string;
    questionShort: string;      // Truncated for cards
    category: string;
    resolutionDate: string;
    resolutionRules: string;
    relatedMarkets: number;     // "2 markets in this event"
  };

  // Risk Assessment
  risk: {
    level: 'low' | 'medium' | 'high';
    score: number;              // 0-100, lower is better
    flags: string[];
    executionWarnings: string[];
  };

  // Position Sizing
  sizing: {
    recommended: number;        // USD
    maximum: number;            // USD
    minimum: number;            // USD for profitability
  };

  // Timing
  detectedAt: string;
  lastUpdated: string;
  priceAge: number;             // seconds since last price update

  // Demo flag
  _demo?: boolean;
}

export interface ArbApiResponse {
  success: boolean;
  data: {
    opportunities: ArbOpportunity[];
    meta: {
      totalScanned: number;
      pairsEvaluated: number;
      scanDurationMs: number;
      platforms: string[];
    };
  };
  meta: {
    source: 'demo' | 'live';
    network: 'devnet' | 'mainnet';
  };
}

// ============================================
// DEMO DATA
// ============================================

function generateDemoArbitrageOpportunities(): ArbOpportunity[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'arb-demo-001',
      quality: 'excellent',
      qualityScore: 96,
      confidenceGrade: 'A',
      trade: {
        leg1: {
          platform: 'kalshi',
          platformDisplayName: 'Kalshi',
          side: 'NO',
          price: 0.09,
          priceDisplay: '9.0¢',
          url: 'https://kalshi.com/markets/fl-05-republican',
          liquidity: 500000,
          volume24h: 125000,
        },
        leg2: {
          platform: 'polymarket',
          platformDisplayName: 'Polymarket',
          side: 'YES',
          price: 0.87,
          priceDisplay: '87.0¢',
          url: 'https://polymarket.com/event/fl-05-house-election',
          liquidity: 7874156,
          volume24h: 1250000,
        },
        totalCost: 0.96,
        totalCostDisplay: '96.0¢',
        guaranteedPayout: 1.00,
        profit: 0.04,
        profitDisplay: '4.0¢',
        profitPercent: 4.17,
        instruction: 'Buy NO on Kalshi + Buy YES on Polymarket',
      },
      market: {
        question: 'Will Republican win the House race for FL-05?',
        questionShort: 'Republican wins FL-05 House',
        category: 'elections',
        resolutionDate: '2027-11-03T20:30:00Z',
        resolutionRules: 'If the House member sworn in for FL-05 for the term beginning in 2027 is a member of the Republican Party, then the market resolves to Yes.',
        relatedMarkets: 2,
      },
      risk: {
        level: 'low',
        score: 18,
        flags: [],
        executionWarnings: [
          'Prices move fast - verify before executing',
          'Others see this alert too',
        ],
      },
      sizing: {
        recommended: 500,
        maximum: 2500,
        minimum: 25,
      },
      detectedAt: '2026-03-17T14:30:00Z',
      lastUpdated: now,
      priceAge: 5,
      _demo: true,
    },
    {
      id: 'arb-demo-002',
      quality: 'good',
      qualityScore: 82,
      confidenceGrade: 'B',
      trade: {
        leg1: {
          platform: 'polymarket',
          platformDisplayName: 'Polymarket',
          side: 'NO',
          price: 0.22,
          priceDisplay: '22.0¢',
          url: 'https://polymarket.com/event/btc-150k-2026',
          liquidity: 4500000,
          volume24h: 890000,
        },
        leg2: {
          platform: 'kalshi',
          platformDisplayName: 'Kalshi',
          side: 'YES',
          price: 0.74,
          priceDisplay: '74.0¢',
          url: 'https://kalshi.com/markets/btc-150k-dec-2026',
          liquidity: 1200000,
          volume24h: 340000,
        },
        totalCost: 0.96,
        totalCostDisplay: '96.0¢',
        guaranteedPayout: 1.00,
        profit: 0.04,
        profitDisplay: '4.0¢',
        profitPercent: 4.17,
        instruction: 'Buy NO on Polymarket + Buy YES on Kalshi',
      },
      market: {
        question: 'Will Bitcoin reach $150,000 by December 31, 2026?',
        questionShort: 'BTC hits $150k by Dec 2026',
        category: 'crypto',
        resolutionDate: '2026-12-31T23:59:59Z',
        resolutionRules: 'Market resolves to Yes if the price of Bitcoin reaches or exceeds $150,000 USD on CoinGecko at any point before December 31, 2026 11:59 PM ET.',
        relatedMarkets: 5,
      },
      risk: {
        level: 'low',
        score: 24,
        flags: [],
        executionWarnings: [
          'High volatility market - prices may shift quickly',
        ],
      },
      sizing: {
        recommended: 400,
        maximum: 2000,
        minimum: 20,
      },
      detectedAt: '2026-03-19T09:15:00Z',
      lastUpdated: now,
      priceAge: 8,
      _demo: true,
    },
    {
      id: 'arb-demo-003',
      quality: 'good',
      qualityScore: 78,
      confidenceGrade: 'B',
      trade: {
        leg1: {
          platform: 'kalshi',
          platformDisplayName: 'Kalshi',
          side: 'YES',
          price: 0.58,
          priceDisplay: '58.0¢',
          url: 'https://kalshi.com/markets/fed-rate-cut-june-2026',
          liquidity: 2800000,
          volume24h: 560000,
        },
        leg2: {
          platform: 'polymarket',
          platformDisplayName: 'Polymarket',
          side: 'NO',
          price: 0.39,
          priceDisplay: '39.0¢',
          url: 'https://polymarket.com/event/fed-rate-june-2026',
          liquidity: 3200000,
          volume24h: 720000,
        },
        totalCost: 0.97,
        totalCostDisplay: '97.0¢',
        guaranteedPayout: 1.00,
        profit: 0.03,
        profitDisplay: '3.0¢',
        profitPercent: 3.09,
        instruction: 'Buy YES on Kalshi + Buy NO on Polymarket',
      },
      market: {
        question: 'Will the Federal Reserve cut interest rates in June 2026?',
        questionShort: 'Fed cuts rates June 2026',
        category: 'economics',
        resolutionDate: '2026-06-15T18:00:00Z',
        resolutionRules: 'Resolves to Yes if the Federal Open Market Committee announces a reduction in the federal funds target rate at their June 2026 meeting.',
        relatedMarkets: 8,
      },
      risk: {
        level: 'medium',
        score: 35,
        flags: ['Resolution date approaching'],
        executionWarnings: [
          'Economic event - watch for news impacts',
        ],
      },
      sizing: {
        recommended: 300,
        maximum: 1500,
        minimum: 15,
      },
      detectedAt: '2026-03-19T11:45:00Z',
      lastUpdated: now,
      priceAge: 12,
      _demo: true,
    },
    {
      id: 'arb-demo-004',
      quality: 'fair',
      qualityScore: 65,
      confidenceGrade: 'C',
      trade: {
        leg1: {
          platform: 'polymarket',
          platformDisplayName: 'Polymarket',
          side: 'YES',
          price: 0.42,
          priceDisplay: '42.0¢',
          url: 'https://polymarket.com/event/eth-10k-2026',
          liquidity: 1800000,
          volume24h: 420000,
        },
        leg2: {
          platform: 'manifold',
          platformDisplayName: 'Manifold',
          side: 'NO',
          price: 0.56,
          priceDisplay: '56.0¢',
          url: 'https://manifold.markets/eth-10k-2026',
          liquidity: 450000,
          volume24h: 85000,
        },
        totalCost: 0.98,
        totalCostDisplay: '98.0¢',
        guaranteedPayout: 1.00,
        profit: 0.02,
        profitDisplay: '2.0¢',
        profitPercent: 2.04,
        instruction: 'Buy YES on Polymarket + Buy NO on Manifold',
      },
      market: {
        question: 'Will Ethereum reach $10,000 by end of 2026?',
        questionShort: 'ETH hits $10k by 2026',
        category: 'crypto',
        resolutionDate: '2026-12-31T23:59:59Z',
        resolutionRules: 'Market resolves Yes if ETH/USD price on CoinGecko reaches $10,000 at any point in 2026.',
        relatedMarkets: 3,
      },
      risk: {
        level: 'medium',
        score: 42,
        flags: ['Lower liquidity on Manifold', 'Small spread'],
        executionWarnings: [
          'Manifold uses play money - verify payout structure',
          'Spread may not cover transaction costs',
        ],
      },
      sizing: {
        recommended: 200,
        maximum: 800,
        minimum: 50,
      },
      detectedAt: '2026-03-19T16:20:00Z',
      lastUpdated: now,
      priceAge: 25,
      _demo: true,
    },
    {
      id: 'arb-demo-005',
      quality: 'excellent',
      qualityScore: 91,
      confidenceGrade: 'A',
      trade: {
        leg1: {
          platform: 'kalshi',
          platformDisplayName: 'Kalshi',
          side: 'NO',
          price: 0.15,
          priceDisplay: '15.0¢',
          url: 'https://kalshi.com/markets/gpt5-q2-2026',
          liquidity: 890000,
          volume24h: 210000,
        },
        leg2: {
          platform: 'polymarket',
          platformDisplayName: 'Polymarket',
          side: 'YES',
          price: 0.82,
          priceDisplay: '82.0¢',
          url: 'https://polymarket.com/event/gpt5-release-q2-2026',
          liquidity: 2100000,
          volume24h: 480000,
        },
        totalCost: 0.97,
        totalCostDisplay: '97.0¢',
        guaranteedPayout: 1.00,
        profit: 0.03,
        profitDisplay: '3.0¢',
        profitPercent: 3.09,
        instruction: 'Buy NO on Kalshi + Buy YES on Polymarket',
      },
      market: {
        question: 'Will OpenAI release GPT-5 by June 30, 2026?',
        questionShort: 'GPT-5 releases by Q2 2026',
        category: 'tech',
        resolutionDate: '2026-06-30T23:59:59Z',
        resolutionRules: 'Resolves Yes if OpenAI officially announces and releases a model called "GPT-5" or equivalent successor before June 30, 2026.',
        relatedMarkets: 4,
      },
      risk: {
        level: 'low',
        score: 22,
        flags: [],
        executionWarnings: [
          'Tech announcement timing can be unpredictable',
        ],
      },
      sizing: {
        recommended: 450,
        maximum: 2200,
        minimum: 25,
      },
      detectedAt: '2026-03-19T08:30:00Z',
      lastUpdated: now,
      priceAge: 3,
      _demo: true,
    },
  ];
}

// ============================================
// PRODUCTION SCANNER
// ============================================

async function scanLiveArbitrage(query?: string): Promise<{
  opportunities: ArbOpportunity[];
  meta: {
    totalScanned: number;
    pairsEvaluated: number;
    scanDurationMs: number;
    platforms: string[];
  };
}> {
  try {
    // Dynamic import to avoid build issues
    const { scanForArbitrage } = await import('../../../../lib/arbitrage/scanner');

    const result = await scanForArbitrage({
      query,
      platforms: ['polymarket', 'kalshi', 'manifold'],
      maxMarketsPerPlatform: 50,
      maxOpportunities: 20,
      minConfidenceGrade: 'C',
      verbose: false,
    });

    // Transform to API format
    const opportunities: ArbOpportunity[] = result.opportunities.map((opp, index) => {
      const leg1 = opp.strategy.legs[0];
      const leg2 = opp.strategy.legs[1];
      const totalCost = leg1.targetPrice + leg2.targetPrice;
      const profit = 1 - totalCost;

      // Determine quality from confidence grade
      const qualityMap: Record<string, 'excellent' | 'good' | 'fair' | 'poor'> = {
        'A': 'excellent',
        'B': 'good',
        'C': 'fair',
        'D': 'poor',
        'F': 'poor',
      };

      const riskMap: Record<number, 'low' | 'medium' | 'high'> = {};
      const riskLevel = opp.risk.overallRiskScore < 30 ? 'low' :
                       opp.risk.overallRiskScore < 60 ? 'medium' : 'high';

      return {
        id: opp.id || `arb-${index}-${Date.now()}`,
        quality: qualityMap[opp.confidence.grade] || 'fair',
        qualityScore: opp.confidence.score,
        confidenceGrade: opp.confidence.grade,
        trade: {
          leg1: {
            platform: leg1.platform,
            platformDisplayName: leg1.platform.charAt(0).toUpperCase() + leg1.platform.slice(1),
            side: leg1.side,
            price: leg1.targetPrice,
            priceDisplay: `${(leg1.targetPrice * 100).toFixed(1)}¢`,
            url: opp.pair.marketA.url || '',
            liquidity: opp.pair.marketA.volume || 0,
            volume24h: opp.pair.marketA.volume || 0,
          },
          leg2: {
            platform: leg2.platform,
            platformDisplayName: leg2.platform.charAt(0).toUpperCase() + leg2.platform.slice(1),
            side: leg2.side,
            price: leg2.targetPrice,
            priceDisplay: `${(leg2.targetPrice * 100).toFixed(1)}¢`,
            url: opp.pair.marketB.url || '',
            liquidity: opp.pair.marketB.volume || 0,
            volume24h: opp.pair.marketB.volume || 0,
          },
          totalCost,
          totalCostDisplay: `${(totalCost * 100).toFixed(1)}¢`,
          guaranteedPayout: 1.00,
          profit,
          profitDisplay: `${(profit * 100).toFixed(1)}¢`,
          profitPercent: opp.netProfitPct * 100,
          instruction: `Buy ${leg1.side} on ${leg1.platform.charAt(0).toUpperCase() + leg1.platform.slice(1)} + Buy ${leg2.side} on ${leg2.platform.charAt(0).toUpperCase() + leg2.platform.slice(1)}`,
        },
        market: {
          question: opp.pair.marketA.title,
          questionShort: opp.pair.marketA.title.length > 40
            ? opp.pair.marketA.title.slice(0, 40) + '...'
            : opp.pair.marketA.title,
          category: opp.pair.metadataA?.category || 'other',
          resolutionDate: opp.pair.marketA.endDate?.toISOString() || '',
          resolutionRules: '',
          relatedMarkets: 1,
        },
        risk: {
          level: riskLevel,
          score: opp.risk.overallRiskScore,
          flags: opp.risk.flags.map(f => f.message),
          executionWarnings: [
            'Prices move fast - verify before executing',
            'Others see this alert too',
          ],
        },
        sizing: {
          recommended: opp.execution.recommendedSize,
          maximum: opp.execution.maxSize,
          minimum: opp.execution.minSize,
        },
        detectedAt: opp.timestamp.toISOString(),
        lastUpdated: new Date().toISOString(),
        priceAge: Math.floor((Date.now() - opp.timestamp.getTime()) / 1000),
      };
    });

    return {
      opportunities,
      meta: {
        totalScanned: result.totalMarkets,
        pairsEvaluated: result.pairsEvaluated,
        scanDurationMs: result.duration,
        platforms: Object.keys(result.marketsScanned),
      },
    };
  } catch (error) {
    console.error('[Arbitrage API] Scan error:', error);
    return {
      opportunities: [],
      meta: {
        totalScanned: 0,
        pairsEvaluated: 0,
        scanDurationMs: 0,
        platforms: [],
      },
    };
  }
}

// ============================================
// API HANDLER
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || undefined;
  const minProfit = parseFloat(searchParams.get('minProfit') || '2');
  const limit = parseInt(searchParams.get('limit') || '10');

  // Get mode from cookie (UI toggle) or fall back to environment
  const cookieHeader = request.headers.get('cookie');
  const demoMode = isDemoFromRequest(cookieHeader);

  // ============================================
  // DEMO MODE
  // ============================================
  if (demoMode) {
    const opportunities = generateDemoArbitrageOpportunities()
      .filter(o => o.trade.profitPercent >= minProfit)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        meta: {
          totalScanned: 150,
          pairsEvaluated: 2250,
          scanDurationMs: 1250,
          platforms: ['kalshi', 'polymarket', 'manifold'],
        },
      },
      meta: {
        source: 'demo',
        network: 'devnet',
      },
    } as ArbApiResponse);
  }

  // ============================================
  // PRODUCTION MODE
  // ============================================
  const startTime = Date.now();
  const result = await scanLiveArbitrage(query);

  // Filter by minimum profit
  const filtered = result.opportunities
    .filter(o => o.trade.profitPercent >= minProfit)
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    data: {
      opportunities: filtered,
      meta: {
        ...result.meta,
        scanDurationMs: Date.now() - startTime,
      },
    },
    meta: {
      source: 'live',
      network: process.env.SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet' : 'devnet',
    },
  } as ArbApiResponse);
}
