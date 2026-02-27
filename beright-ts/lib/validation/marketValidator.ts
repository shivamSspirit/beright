/**
 * Institutional-Grade Market Data Validator
 *
 * Bloomberg-grade verification for prediction market data.
 * Ensures data accuracy, freshness, and arbitrage validity.
 *
 * Features:
 * - Real-time price verification
 * - Stale data detection
 * - Market equivalence checking
 * - False arbitrage prevention
 * - Multi-market disambiguation
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type VerificationStatus =
  | 'VERIFIED'           // 0-1% deviation
  | 'MINOR_DEVIATION'    // 1-5% deviation
  | 'STALE_OR_MOVING'    // 5-10% deviation
  | 'INVALID'            // >10% deviation
  | 'MULTIPLE_MARKETS'   // Ambiguous match
  | 'NOT_FOUND';         // Market not found

export type ArbitrageStatus =
  | 'TRUE_ARBITRAGE'     // Valid arb opportunity
  | 'FALSE_ARBITRAGE'    // Non-equivalent markets
  | 'NEEDS_REVIEW'       // Manual review needed
  | 'INSUFFICIENT_DATA'; // Can't determine

export interface MarketIdentity {
  question: string;
  resolutionCriteria?: string;
  resolutionDate?: Date;
  eventScope?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'specific_event';
  platform: string;
  ticker?: string;
}

export interface VerificationResult {
  market: string;
  platform: string;
  briefPrice: number;
  actualPrice: number;
  deviation: number;
  status: VerificationStatus;
  timestamp: Date;
  confidence: number;
  reason: string;
  url?: string;
}

export interface ArbitrageVerification {
  topic: string;
  market1: MarketIdentity;
  market2: MarketIdentity;
  price1: number;
  price2: number;
  spread: number;
  arbitrageStatus: ArbitrageStatus;
  equivalenceScore: number;
  reason: string;
  confidence: number;
  isValid: boolean;
}

export interface ValidationReport {
  generatedAt: Date;
  marketsVerified: VerificationResult[];
  arbitrageChecks: ArbitrageVerification[];
  summary: {
    totalMarkets: number;
    verified: number;
    stale: number;
    invalid: number;
    trueArbitrage: number;
    falseArbitrage: number;
  };
  dataQualityScore: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Freshness thresholds (milliseconds)
  STALE_THRESHOLD_MS: 5 * 60 * 1000,  // 5 minutes

  // Price deviation thresholds (percentage points)
  VERIFIED_THRESHOLD: 1,        // 0-1% = verified
  MINOR_DEVIATION_THRESHOLD: 5, // 1-5% = minor deviation
  STALE_THRESHOLD: 10,          // 5-10% = stale or moving

  // Arbitrage thresholds
  MIN_ARB_SPREAD: 0.08,         // 8% minimum spread
  MIN_LIQUIDITY: 1000,          // $1000 minimum liquidity
  MIN_EQUIVALENCE_SCORE: 0.85,  // 85% match required

  // Matching weights
  WEIGHTS: {
    questionMatch: 0.35,
    dateMatch: 0.30,
    scopeMatch: 0.20,
    criteriaMatch: 0.15,
  },
};

// =============================================================================
// TEXT SIMILARITY
// =============================================================================

/**
 * Calculate Jaccard similarity between two strings
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(normalizeText(str1).split(/\s+/));
  const set2 = new Set(normalizeText(str2).split(/\s+/));

  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set(Array.from(set1).concat(Array.from(set2)));

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract date from question text
 */
function extractDateFromText(text: string): Date | null {
  // Common patterns: "by March 1", "before 2026-03-01", "in February", etc.
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,                          // 2026-03-01
    /by\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
    /before\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Try to parse the date
        const dateStr = match[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Detect event scope from question
 */
function detectEventScope(question: string): MarketIdentity['eventScope'] {
  const q = question.toLowerCase();

  if (q.includes('this hour') || q.includes('hourly')) return 'hourly';
  if (q.includes('today') || q.includes('this day') || q.includes('daily')) return 'daily';
  if (q.includes('this week') || q.includes('weekly')) return 'weekly';
  if (q.includes('this month') || q.includes('monthly')) return 'monthly';
  if (q.includes('this year') || q.includes('in 2026') || q.includes('in 2027')) return 'yearly';

  return 'specific_event';
}

// =============================================================================
// MARKET EQUIVALENCE
// =============================================================================

/**
 * Calculate equivalence score between two markets
 * Returns 0-1 score indicating how equivalent the markets are
 */
export function calculateEquivalenceScore(
  market1: MarketIdentity,
  market2: MarketIdentity
): { score: number; breakdown: Record<string, number>; issues: string[] } {
  const issues: string[] = [];
  const breakdown: Record<string, number> = {};

  // 1. Question similarity (35%)
  const questionSimilarity = jaccardSimilarity(market1.question, market2.question);
  breakdown.question = questionSimilarity;
  if (questionSimilarity < 0.5) {
    issues.push(`Low question similarity: ${(questionSimilarity * 100).toFixed(0)}%`);
  }

  // 2. Resolution date match (30%)
  let dateScore = 0;
  const date1 = market1.resolutionDate || extractDateFromText(market1.question);
  const date2 = market2.resolutionDate || extractDateFromText(market2.question);

  if (date1 && date2) {
    const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) dateScore = 1;
    else if (daysDiff <= 1) dateScore = 0.9;
    else if (daysDiff <= 7) dateScore = 0.5;
    else dateScore = 0;

    if (daysDiff > 1) {
      issues.push(`Resolution dates differ by ${daysDiff.toFixed(0)} days`);
    }
  } else if (!date1 && !date2) {
    dateScore = 0.7; // Both have no date, assume similar
  } else {
    dateScore = 0.3; // One has date, one doesn't
    issues.push('One market has resolution date, other does not');
  }
  breakdown.date = dateScore;

  // 3. Event scope match (20%)
  const scope1 = market1.eventScope || detectEventScope(market1.question);
  const scope2 = market2.eventScope || detectEventScope(market2.question);
  const scopeScore = scope1 === scope2 ? 1 : 0;
  breakdown.scope = scopeScore;
  if (scope1 !== scope2) {
    issues.push(`Different event scopes: ${scope1} vs ${scope2}`);
  }

  // 4. Resolution criteria (15%)
  let criteriaScore = 0.7; // Default if not specified
  if (market1.resolutionCriteria && market2.resolutionCriteria) {
    criteriaScore = jaccardSimilarity(market1.resolutionCriteria, market2.resolutionCriteria);
    if (criteriaScore < 0.7) {
      issues.push('Resolution criteria differ significantly');
    }
  }
  breakdown.criteria = criteriaScore;

  // Calculate weighted score
  const weightedScore =
    breakdown.question * CONFIG.WEIGHTS.questionMatch +
    breakdown.date * CONFIG.WEIGHTS.dateMatch +
    breakdown.scope * CONFIG.WEIGHTS.scopeMatch +
    breakdown.criteria * CONFIG.WEIGHTS.criteriaMatch;

  return { score: weightedScore, breakdown, issues };
}

// =============================================================================
// PRICE VERIFICATION
// =============================================================================

/**
 * Verify a single market price
 */
export function verifyPrice(
  briefPrice: number,
  actualPrice: number,
  timestamp: Date
): { status: VerificationStatus; deviation: number; confidence: number; reason: string } {
  const deviation = Math.abs(briefPrice - actualPrice) * 100; // Convert to percentage points
  const ageMs = Date.now() - timestamp.getTime();

  // Check freshness first
  if (ageMs > CONFIG.STALE_THRESHOLD_MS) {
    return {
      status: 'STALE_OR_MOVING',
      deviation,
      confidence: 50,
      reason: `Data is ${Math.round(ageMs / 60000)} minutes old`,
    };
  }

  // Check deviation
  if (deviation <= CONFIG.VERIFIED_THRESHOLD) {
    return {
      status: 'VERIFIED',
      deviation,
      confidence: 95,
      reason: 'Price matches within 1%',
    };
  }

  if (deviation <= CONFIG.MINOR_DEVIATION_THRESHOLD) {
    return {
      status: 'MINOR_DEVIATION',
      deviation,
      confidence: 80,
      reason: `Minor deviation of ${deviation.toFixed(1)}%`,
    };
  }

  if (deviation <= CONFIG.STALE_THRESHOLD) {
    return {
      status: 'STALE_OR_MOVING',
      deviation,
      confidence: 60,
      reason: `Price moved ${deviation.toFixed(1)}% - may be stale or volatile`,
    };
  }

  return {
    status: 'INVALID',
    deviation,
    confidence: 30,
    reason: `Large deviation of ${deviation.toFixed(1)}% - data likely stale or incorrect`,
  };
}

// =============================================================================
// ARBITRAGE VALIDATION
// =============================================================================

/**
 * Validate an arbitrage opportunity
 */
export function validateArbitrage(
  market1: MarketIdentity & { price: number; volume?: number; liquidity?: number },
  market2: MarketIdentity & { price: number; volume?: number; liquidity?: number }
): ArbitrageVerification {
  const spread = Math.abs(market1.price - market2.price);
  const equivalence = calculateEquivalenceScore(market1, market2);

  // Build result
  const result: ArbitrageVerification = {
    topic: market1.question.substring(0, 50),
    market1,
    market2,
    price1: market1.price,
    price2: market2.price,
    spread,
    equivalenceScore: equivalence.score,
    arbitrageStatus: 'NEEDS_REVIEW',
    reason: '',
    confidence: 0,
    isValid: false,
  };

  // Check equivalence score
  if (equivalence.score < CONFIG.MIN_EQUIVALENCE_SCORE) {
    result.arbitrageStatus = 'FALSE_ARBITRAGE';
    result.reason = `Markets not equivalent (${(equivalence.score * 100).toFixed(0)}% match). Issues: ${equivalence.issues.join('; ')}`;
    result.confidence = 90;
    result.isValid = false;
    return result;
  }

  // Check spread threshold
  if (spread < CONFIG.MIN_ARB_SPREAD) {
    result.arbitrageStatus = 'FALSE_ARBITRAGE';
    result.reason = `Spread too small (${(spread * 100).toFixed(1)}% < ${CONFIG.MIN_ARB_SPREAD * 100}% minimum)`;
    result.confidence = 95;
    result.isValid = false;
    return result;
  }

  // Check liquidity
  const minLiq = Math.min(market1.liquidity || 0, market2.liquidity || 0);
  if (minLiq > 0 && minLiq < CONFIG.MIN_LIQUIDITY) {
    result.arbitrageStatus = 'NEEDS_REVIEW';
    result.reason = `Low liquidity ($${minLiq.toLocaleString()}) - execution may be difficult`;
    result.confidence = 60;
    result.isValid = false;
    return result;
  }

  // If equivalence issues exist but score is above threshold, flag for review
  if (equivalence.issues.length > 0) {
    result.arbitrageStatus = 'NEEDS_REVIEW';
    result.reason = `Potential issues: ${equivalence.issues.join('; ')}`;
    result.confidence = 70;
    result.isValid = false;
    return result;
  }

  // Valid arbitrage
  result.arbitrageStatus = 'TRUE_ARBITRAGE';
  result.reason = `Valid ${(spread * 100).toFixed(1)}% spread on equivalent markets`;
  result.confidence = Math.round(equivalence.score * 100);
  result.isValid = true;

  return result;
}

// =============================================================================
// LIVE PRICE FETCHERS
// =============================================================================

/**
 * Fetch live price from Polymarket
 */
async function fetchPolymarketPrice(marketId: string): Promise<{ price: number; timestamp: Date } | null> {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    let price = 0.5;

    try {
      const prices = typeof data.outcomePrices === 'string'
        ? JSON.parse(data.outcomePrices)
        : data.outcomePrices;
      price = parseFloat(prices?.[0]) || 0.5;
    } catch {
      price = parseFloat(data.yes_price) || 0.5;
    }

    return { price, timestamp: new Date() };
  } catch {
    return null;
  }
}

/**
 * Fetch live price from Kalshi
 */
async function fetchKalshiPrice(ticker: string): Promise<{ price: number; timestamp: Date } | null> {
  try {
    const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const market = data.market || data;
    const price = ((market.yes_bid || 0) + (market.yes_ask || 0)) / 200;

    return { price, timestamp: new Date() };
  } catch {
    return null;
  }
}

/**
 * Fetch live price from Manifold
 */
async function fetchManifoldPrice(marketId: string): Promise<{ price: number; timestamp: Date } | null> {
  try {
    const res = await fetch(`https://api.manifold.markets/v0/market/${marketId}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const price = data.probability || 0.5;

    return { price, timestamp: new Date() };
  } catch {
    return null;
  }
}

/**
 * Fetch live price by platform
 */
export async function fetchLivePrice(
  platform: string,
  marketId: string
): Promise<{ price: number; timestamp: Date } | null> {
  switch (platform.toLowerCase()) {
    case 'polymarket':
      return fetchPolymarketPrice(marketId);
    case 'kalshi':
      return fetchKalshiPrice(marketId);
    case 'manifold':
      return fetchManifoldPrice(marketId);
    default:
      return null;
  }
}

// =============================================================================
// MAIN VALIDATOR
// =============================================================================

export interface MarketToVerify {
  platform: string;
  marketId: string;
  title: string;
  briefPrice: number;
  url?: string;
}

export interface ArbitrageToVerify {
  topic: string;
  platform1: string;
  marketId1: string;
  price1: number;
  platform2: string;
  marketId2: string;
  price2: number;
  question1?: string;
  question2?: string;
}

/**
 * Validate a full morning brief
 */
export async function validateBrief(
  markets: MarketToVerify[],
  arbitrages: ArbitrageToVerify[]
): Promise<ValidationReport> {
  const marketsVerified: VerificationResult[] = [];
  const arbitrageChecks: ArbitrageVerification[] = [];

  // Verify each market price
  for (const market of markets) {
    const liveData = await fetchLivePrice(market.platform, market.marketId);

    if (!liveData) {
      marketsVerified.push({
        market: market.title,
        platform: market.platform,
        briefPrice: market.briefPrice,
        actualPrice: 0,
        deviation: 0,
        status: 'NOT_FOUND',
        timestamp: new Date(),
        confidence: 0,
        reason: 'Could not fetch live price',
        url: market.url,
      });
      continue;
    }

    const verification = verifyPrice(market.briefPrice, liveData.price, liveData.timestamp);

    marketsVerified.push({
      market: market.title,
      platform: market.platform,
      briefPrice: market.briefPrice,
      actualPrice: liveData.price,
      deviation: verification.deviation,
      status: verification.status,
      timestamp: liveData.timestamp,
      confidence: verification.confidence,
      reason: verification.reason,
      url: market.url,
    });
  }

  // Verify each arbitrage opportunity
  for (const arb of arbitrages) {
    const market1Identity: MarketIdentity & { price: number } = {
      question: arb.question1 || arb.topic,
      platform: arb.platform1,
      ticker: arb.marketId1,
      price: arb.price1,
    };

    const market2Identity: MarketIdentity & { price: number } = {
      question: arb.question2 || arb.topic,
      platform: arb.platform2,
      ticker: arb.marketId2,
      price: arb.price2,
    };

    const arbVerification = validateArbitrage(market1Identity, market2Identity);
    arbitrageChecks.push(arbVerification);
  }

  // Calculate summary
  const summary = {
    totalMarkets: marketsVerified.length,
    verified: marketsVerified.filter(m => m.status === 'VERIFIED').length,
    stale: marketsVerified.filter(m => m.status === 'STALE_OR_MOVING').length,
    invalid: marketsVerified.filter(m => m.status === 'INVALID' || m.status === 'NOT_FOUND').length,
    trueArbitrage: arbitrageChecks.filter(a => a.arbitrageStatus === 'TRUE_ARBITRAGE').length,
    falseArbitrage: arbitrageChecks.filter(a => a.arbitrageStatus === 'FALSE_ARBITRAGE').length,
  };

  // Calculate overall data quality score
  const dataQualityScore = Math.round(
    ((summary.verified / Math.max(summary.totalMarkets, 1)) * 70) +
    ((summary.trueArbitrage / Math.max(arbitrageChecks.length, 1)) * 30)
  );

  return {
    generatedAt: new Date(),
    marketsVerified,
    arbitrageChecks,
    summary,
    dataQualityScore,
  };
}

// =============================================================================
// FORMATTER
// =============================================================================

/**
 * Format verification report for display
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  DATA VERIFICATION REPORT');
  lines.push('  Generated: ' + report.generatedAt.toLocaleString());
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push('📊 SUMMARY');
  lines.push(`   Data Quality Score: ${report.dataQualityScore}/100`);
  lines.push(`   Markets: ${report.summary.verified}/${report.summary.totalMarkets} verified`);
  lines.push(`   Arbitrage: ${report.summary.trueArbitrage} true, ${report.summary.falseArbitrage} false`);
  lines.push('');

  // Market verification
  lines.push('📈 MARKET VERIFICATION');
  for (const m of report.marketsVerified) {
    const icon = m.status === 'VERIFIED' ? '✅' :
                 m.status === 'MINOR_DEVIATION' ? '🟡' :
                 m.status === 'STALE_OR_MOVING' ? '⚠️' : '❌';
    lines.push(`${icon} ${m.market.substring(0, 40)}...`);
    lines.push(`   Brief: ${(m.briefPrice * 100).toFixed(1)}% | Actual: ${(m.actualPrice * 100).toFixed(1)}% | ${m.status}`);
  }
  lines.push('');

  // Arbitrage verification
  if (report.arbitrageChecks.length > 0) {
    lines.push('⚡ ARBITRAGE VERIFICATION');
    for (const a of report.arbitrageChecks) {
      const icon = a.arbitrageStatus === 'TRUE_ARBITRAGE' ? '✅' :
                   a.arbitrageStatus === 'FALSE_ARBITRAGE' ? '❌' : '⚠️';
      lines.push(`${icon} ${a.topic}...`);
      lines.push(`   ${a.market1.platform}: ${(a.price1 * 100).toFixed(1)}% vs ${a.market2.platform}: ${(a.price2 * 100).toFixed(1)}%`);
      lines.push(`   Status: ${a.arbitrageStatus} (${a.confidence}% confidence)`);
      lines.push(`   Reason: ${a.reason}`);
    }
  }

  return lines.join('\n');
}

export default {
  calculateEquivalenceScore,
  verifyPrice,
  validateArbitrage,
  validateBrief,
  formatValidationReport,
  fetchLivePrice,
};
