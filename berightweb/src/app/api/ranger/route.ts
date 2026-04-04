import { NextResponse } from 'next/server';

/**
 * BeRight Ranger - Protocol Rates API
 *
 * ELIGIBLE PROTOCOLS (Lending Only):
 * - Drift Earn (USDC lending)
 * - Kamino Lend (USDC lending)
 * - Marginfi (USDC lending)
 *
 * DISQUALIFIED (per hackathon rules):
 * - Jupiter JLP (DEX LP - impermanent loss risk)
 * - Any junior tranche / insurance pools
 * - Ponzi-like yield-bearing stables
 */

// =============================================================================
// TYPES
// =============================================================================

interface ProtocolRate {
  protocol: string;
  asset: string;
  supplyApy: number;
  tvl: number;
  utilization: number;
  source: string;
  timestamp: number;
}

interface Prediction {
  protocol: string;
  currentRate: number;
  predictedRate: number;
  confidence: number;
  direction: 'up' | 'down' | 'stable';
}

interface Allocation {
  protocol: string;
  currentWeight: number;
  targetWeight: number;
  expectedReturn: number;
  riskScore: number;
  action: 'deposit' | 'withdraw' | 'hold';
}

// =============================================================================
// RATE HISTORY FOR PREDICTIONS
// =============================================================================

const rateHistory: Map<string, number[]> = new Map();

function updateHistory(protocol: string, rate: number) {
  const hist = rateHistory.get(protocol) || [];
  hist.push(rate);
  if (hist.length > 24) hist.shift();
  rateHistory.set(protocol, hist);
}

function predictRate(protocol: string, currentRate: number): Prediction {
  const hist = rateHistory.get(protocol) || [currentRate];

  if (hist.length < 3) {
    return {
      protocol,
      currentRate,
      predictedRate: currentRate,
      confidence: 0.5,
      direction: 'stable',
    };
  }

  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const meanReversion = (mean - currentRate) * 0.3;
  const momentum = (hist[hist.length - 1] - hist[0]) / hist.length * 0.5;
  const predicted = currentRate + meanReversion + momentum;

  const variance = hist.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / hist.length;
  const confidence = Math.max(0.4, Math.min(0.9, 1 - Math.sqrt(variance) / 3));

  const change = predicted - currentRate;
  const direction: 'up' | 'down' | 'stable' =
    change > 0.2 ? 'up' : change < -0.2 ? 'down' : 'stable';

  return { protocol, currentRate, predictedRate: predicted, confidence, direction };
}

// =============================================================================
// FETCH DRIFT LENDING DATA
// =============================================================================

async function fetchDriftData(): Promise<ProtocolRate | null> {
  try {
    const response = await fetch(
      'https://mainnet-beta.api.drift.trade/stats',
      { next: { revalidate: 60 } }
    );

    if (response.ok) {
      const data = await response.json();

      if (data.spotMarkets) {
        const usdcMarket = data.spotMarkets.find(
          (m: { symbol?: string; marketIndex?: number }) =>
            m.symbol === 'USDC' || m.marketIndex === 0
        );

        if (usdcMarket) {
          return {
            protocol: 'Drift',
            asset: 'USDC',
            supplyApy: (usdcMarket.depositApr || usdcMarket.depositRate || 0.095) * 100,
            tvl: usdcMarket.totalDeposits || 85000000,
            utilization: usdcMarket.utilization || 0.72,
            source: 'Drift API',
            timestamp: Date.now(),
          };
        }
      }
    }
  } catch (error) {
    console.error('Drift fetch error:', error);
  }

  return {
    protocol: 'Drift',
    asset: 'USDC',
    supplyApy: 9.5,
    tvl: 85000000,
    utilization: 0.72,
    source: 'Estimate',
    timestamp: Date.now(),
  };
}

// =============================================================================
// FETCH KAMINO LEND DATA (NOT LP)
// =============================================================================

async function fetchKaminoData(): Promise<ProtocolRate | null> {
  try {
    // Kamino Lend API (lending, not liquidity)
    const response = await fetch(
      'https://api.hubbleprotocol.io/v2/kamino-market/mainnet/metrics',
      { next: { revalidate: 60 } }
    );

    if (response.ok) {
      const data = await response.json();

      if (data.reserves) {
        const usdcReserve = data.reserves.find(
          (r: { symbol?: string; mint?: string }) =>
            r.symbol === 'USDC' || r.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        );

        if (usdcReserve) {
          return {
            protocol: 'Kamino',
            asset: 'USDC',
            supplyApy: (usdcReserve.supplyInterestAPY || 0.105) * 100,
            tvl: usdcReserve.totalSupply || 130000000,
            utilization: usdcReserve.utilizationRatio || 0.78,
            source: 'Kamino Lend',
            timestamp: Date.now(),
          };
        }
      }
    }
  } catch (error) {
    console.error('Kamino fetch error:', error);
  }

  return {
    protocol: 'Kamino',
    asset: 'USDC',
    supplyApy: 10.5,
    tvl: 130000000,
    utilization: 0.78,
    source: 'Estimate',
    timestamp: Date.now(),
  };
}

// =============================================================================
// FETCH MARGINFI LENDING DATA
// =============================================================================

async function fetchMarginfiData(): Promise<ProtocolRate | null> {
  try {
    // Marginfi Banks API
    const response = await fetch(
      'https://storage.googleapis.com/mrgn-public/mrgn-bank-metadata-cache.json',
      { next: { revalidate: 60 } }
    );

    if (response.ok) {
      const banks = await response.json();

      // Find USDC bank
      const usdcBank = Object.values(banks).find(
        (b: unknown) => {
          const bank = b as { tokenSymbol?: string; mint?: string };
          return bank.tokenSymbol === 'USDC' ||
                 bank.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        }
      ) as { lendingRate?: number; totalDeposits?: number; utilizationRate?: number } | undefined;

      if (usdcBank) {
        return {
          protocol: 'Marginfi',
          asset: 'USDC',
          supplyApy: (usdcBank.lendingRate || 0.098) * 100,
          tvl: usdcBank.totalDeposits || 95000000,
          utilization: usdcBank.utilizationRate || 0.74,
          source: 'Marginfi API',
          timestamp: Date.now(),
        };
      }
    }

    // Alternate: mrgn-ts API
    const altResponse = await fetch(
      'https://api.marginfi.com/banks',
      { next: { revalidate: 60 } }
    );

    if (altResponse.ok) {
      const altData = await altResponse.json();
      const usdcBank = altData.find?.(
        (b: { symbol?: string }) => b.symbol === 'USDC'
      );

      if (usdcBank) {
        return {
          protocol: 'Marginfi',
          asset: 'USDC',
          supplyApy: (usdcBank.lendingApy || 0.098) * 100,
          tvl: usdcBank.totalDeposits || 95000000,
          utilization: usdcBank.utilization || 0.74,
          source: 'Marginfi Banks',
          timestamp: Date.now(),
        };
      }
    }
  } catch (error) {
    console.error('Marginfi fetch error:', error);
  }

  return {
    protocol: 'Marginfi',
    asset: 'USDC',
    supplyApy: 9.8,
    tvl: 95000000,
    utilization: 0.74,
    source: 'Estimate',
    timestamp: Date.now(),
  };
}

// =============================================================================
// ALLOCATION OPTIMIZER (Sharpe Ratio Based)
// =============================================================================

function computeAllocations(rates: ProtocolRate[], predictions: Prediction[]): Allocation[] {
  const RISK_FREE = 5.0;
  const TARGET_APY = 10.0; // Hackathon minimum requirement

  // Risk scores for lending protocols (lower = safer)
  const riskScores: Record<string, number> = {
    Drift: 7,      // Established, good track record
    Kamino: 6,     // Strong protocol, good audits
    Marginfi: 7,   // Established, competitive rates
  };

  // Calculate expected returns using predictions
  const expectedReturns: Map<string, number> = new Map();
  for (const pred of predictions) {
    const expected = pred.currentRate * 0.4 + pred.predictedRate * 0.6;
    expectedReturns.set(pred.protocol, expected);
  }

  // Sharpe-like scores with confidence weighting
  const scores: Map<string, number> = new Map();
  let totalScore = 0;

  for (const rate of rates) {
    const expected = expectedReturns.get(rate.protocol) || rate.supplyApy;
    const risk = riskScores[rate.protocol] || 7;
    const pred = predictions.find(p => p.protocol === rate.protocol);
    const confidence = pred?.confidence || 0.5;

    // Bonus for protocols exceeding target APY
    const targetBonus = expected >= TARGET_APY ? 1.2 : 1.0;

    const score = Math.max(0, ((expected - RISK_FREE) / (risk / 10)) * confidence * targetBonus);
    scores.set(rate.protocol, score);
    totalScore += score;
  }

  // Convert to allocations
  const allocations: Allocation[] = [];
  const currentWeight = 1 / rates.length;

  for (const rate of rates) {
    const score = scores.get(rate.protocol) || 0;
    let targetWeight = totalScore > 0 ? score / totalScore : currentWeight;

    // Constraints: 15% min, 50% max (ensure diversification)
    targetWeight = Math.max(0.15, Math.min(0.50, targetWeight));

    const expected = expectedReturns.get(rate.protocol) || rate.supplyApy;
    const diff = targetWeight - currentWeight;

    allocations.push({
      protocol: rate.protocol,
      currentWeight,
      targetWeight,
      expectedReturn: expected,
      riskScore: riskScores[rate.protocol] || 7,
      action: diff > 0.05 ? 'deposit' : diff < -0.05 ? 'withdraw' : 'hold',
    });
  }

  // Normalize to sum to 1
  const total = allocations.reduce((sum, a) => sum + a.targetWeight, 0);
  allocations.forEach(a => { a.targetWeight = a.targetWeight / total; });

  return allocations;
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET() {
  try {
    // Fetch all LENDING protocols (no LP vaults)
    const [drift, kamino, marginfi] = await Promise.all([
      fetchDriftData(),
      fetchKaminoData(),
      fetchMarginfiData(),
    ]);

    const rates = [drift, kamino, marginfi].filter((r): r is ProtocolRate => r !== null);

    // Update history and generate predictions
    const predictions: Prediction[] = [];
    for (const rate of rates) {
      updateHistory(rate.protocol, rate.supplyApy);
      predictions.push(predictRate(rate.protocol, rate.supplyApy));
    }

    // Compute optimal allocations
    const allocations = computeAllocations(rates, predictions);

    // Calculate portfolio stats
    const portfolioApy = allocations.reduce(
      (sum, a) => sum + a.targetWeight * a.expectedReturn, 0
    );
    const portfolioRisk = allocations.reduce(
      (sum, a) => sum + a.targetWeight * a.riskScore, 0
    );
    const avgRate = rates.reduce((sum, r) => sum + r.supplyApy, 0) / rates.length;

    // Check if we meet 10% APY target
    const meetsTarget = portfolioApy >= 10.0;

    const stats = {
      portfolioApy,
      portfolioRisk,
      sharpeRatio: (portfolioApy - 5) / portfolioRisk,
      alpha: portfolioApy - avgRate,
      meetsTarget,
      targetApy: 10.0,
      totalValueLocked: 0,
      lastUpdate: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        rates,
        predictions,
        allocations,
        stats,
      },
    });
  } catch (error) {
    console.error('Ranger API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch protocol data' },
      { status: 500 }
    );
  }
}
