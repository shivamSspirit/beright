/**
 * BeRight Trust Engine
 *
 * The core validation orchestrator that:
 * 1. Runs all validation checks on market data
 * 2. Calculates confidence scores
 * 3. Filters out low-quality data
 * 4. Adds trust indicators for display
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import {
  RawMarketData,
  ValidatedMarket,
  ValidationResult,
  ValidationCheck,
  ValidationContext,
  TrustEngineResult,
  TRUST_THRESHOLDS,
  FRESHNESS_THRESHOLDS,
  getTrustIndicator,
  PLATFORM_CONFIGS,
} from '../data/types';

import { VALIDATION_RULES } from './validators/index';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Minimum score to include in results (filter out below this)
 */
const MIN_TRUST_SCORE = 25;

/**
 * Score to show warnings (yellow indicator)
 */
const WARNING_THRESHOLD = 75;

/**
 * Number of markets to validate in parallel
 */
const PARALLEL_VALIDATION_BATCH = 10;

// =============================================================================
// PRICE ORACLE
// =============================================================================

/**
 * Simple price oracle for BTC/ETH
 * Fetches from public APIs (Binance, Coinbase as fallback)
 */
async function getOraclePrice(asset: 'BTC' | 'ETH'): Promise<number | undefined> {
  const symbol = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';

  try {
    // Try Binance first
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (response.ok) {
      const data = await response.json();
      return parseFloat(data.price);
    }
  } catch {
    // Binance failed, try Coinbase
  }

  try {
    const coinbaseSymbol = asset === 'BTC' ? 'BTC-USD' : 'ETH-USD';
    const response = await fetch(
      `https://api.coinbase.com/v2/prices/${coinbaseSymbol}/spot`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (response.ok) {
      const data = await response.json();
      return parseFloat(data.data.amount);
    }
  } catch {
    // Both failed
  }

  return undefined;
}

/**
 * Get oracle prices for validation context
 */
async function getOraclePrices(): Promise<{ btc?: number; eth?: number }> {
  const [btc, eth] = await Promise.all([
    getOraclePrice('BTC'),
    getOraclePrice('ETH'),
  ]);

  return { btc, eth };
}

// =============================================================================
// VALIDATION EXECUTION
// =============================================================================

/**
 * Run all validation checks on a single market
 */
async function validateMarket(
  market: RawMarketData,
  context: ValidationContext
): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const failedChecks: string[] = [];
  const warnings: string[] = [];

  // Run all validators
  for (const rule of VALIDATION_RULES) {
    try {
      const check = await rule.validator(market, context);
      checks.push(check);

      if (!check.passed) {
        failedChecks.push(rule.name);

        // If required and failed, this is critical
        if (rule.required) {
          warnings.push(`CRITICAL: ${check.message}`);
        } else {
          warnings.push(check.message || `${rule.name} check failed`);
        }
      } else if (check.confidence < 70) {
        // Low confidence even though passed
        warnings.push(`Warning: ${check.message}`);
      }
    } catch (error) {
      // Validator threw an error - treat as low confidence pass
      checks.push({
        name: rule.name,
        passed: true,
        confidence: 50,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}`,
      });
    }
  }

  // Calculate overall confidence score
  let totalWeight = 0;
  let weightedScore = 0;

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    const rule = VALIDATION_RULES[i];

    totalWeight += rule.weight;
    weightedScore += check.confidence * rule.weight;
  }

  const overallConfidence = totalWeight > 0
    ? Math.round(weightedScore / totalWeight)
    : 50;

  // Check if any required checks failed
  const isValid = !failedChecks.some(name => {
    const rule = VALIDATION_RULES.find(r => r.name === name);
    return rule?.required === true;
  });

  return {
    isValid,
    overallConfidence,
    checks,
    failedChecks,
    warnings,
    timestamp: new Date(),
  };
}

/**
 * Convert validated result to ValidatedMarket
 */
function createValidatedMarket(
  market: RawMarketData,
  validation: ValidationResult
): ValidatedMarket {
  // Calculate data age
  const dataAgeSeconds = (Date.now() - market.fetchedAt.getTime()) / 1000;
  const isFresh = dataAgeSeconds < FRESHNESS_THRESHOLDS.acceptable;

  // Determine trust level
  const trustScore = validation.overallConfidence;
  let trustLevel: ValidatedMarket['trustLevel'];

  if (!validation.isValid || trustScore < MIN_TRUST_SCORE) {
    trustLevel = 'filtered';
  } else if (trustScore >= TRUST_THRESHOLDS.verified) {
    trustLevel = 'verified';
  } else if (trustScore >= TRUST_THRESHOLDS.good) {
    trustLevel = 'good';
  } else if (trustScore >= TRUST_THRESHOLDS.unverified) {
    trustLevel = 'unverified';
  } else {
    trustLevel = 'suspicious';
  }

  // Create source label
  const platformConfig = PLATFORM_CONFIGS[market.platform];
  const platformName = platformConfig?.displayName || market.platform;
  const sourceLabel = market.source === 'direct'
    ? `${platformName} (Direct API)`
    : `${platformName} via ${market.source.toUpperCase()}`;

  return {
    ...market,
    validation,
    trustScore,
    trustLevel,
    dataAgeSeconds,
    isFresh,
    sourceLabel,
  };
}

// =============================================================================
// TRUST ENGINE
// =============================================================================

/**
 * Main Trust Engine class
 */
export class TrustEngine {
  private marketCache: Map<string, RawMarketData> = new Map();
  private oraclePrices: { btc?: number; eth?: number } = {};
  private lastOracleFetch: number = 0;

  /**
   * Validate a batch of markets
   */
  async validateMarkets(markets: RawMarketData[]): Promise<TrustEngineResult> {
    const startTime = Date.now();
    const validatedMarkets: ValidatedMarket[] = [];
    const filteredOut: TrustEngineResult['filteredOut'] = [];
    const warnings: string[] = [];
    const sources = new Set<RawMarketData['source']>();

    // Update oracle prices if stale (>1 minute)
    if (Date.now() - this.lastOracleFetch > 60000) {
      try {
        this.oraclePrices = await getOraclePrices();
        this.lastOracleFetch = Date.now();
      } catch {
        warnings.push('Failed to fetch oracle prices');
      }
    }

    // Build context for validation
    const context: ValidationContext = {
      oraclePrice: this.oraclePrices.btc, // Default to BTC
      existingMarkets: this.marketCache,
    };

    // Process markets in batches for parallelization
    for (let i = 0; i < markets.length; i += PARALLEL_VALIDATION_BATCH) {
      const batch = markets.slice(i, i + PARALLEL_VALIDATION_BATCH);

      const results = await Promise.all(
        batch.map(async market => {
          // Determine oracle price based on market content
          const marketContext = { ...context };
          const title = market.title.toLowerCase();

          if (title.includes('btc') || title.includes('bitcoin')) {
            marketContext.oraclePrice = this.oraclePrices.btc;
          } else if (title.includes('eth') || title.includes('ethereum')) {
            marketContext.oraclePrice = this.oraclePrices.eth;
          }

          // Get previous price from cache for historical validation
          const cacheKey = `${market.platform}:${market.id}`;
          const cached = this.marketCache.get(cacheKey);
          if (cached) {
            marketContext.previousPrice = cached.yesPrice;
          }

          // Run validation
          const validation = await validateMarket(market, marketContext);
          const validated = createValidatedMarket(market, validation);

          // Update cache
          this.marketCache.set(cacheKey, market);
          sources.add(market.source);

          return validated;
        })
      );

      // Sort results into validated vs filtered
      for (const validated of results) {
        if (validated.trustLevel === 'filtered') {
          filteredOut.push({
            market: validated,
            reason: validated.validation.warnings.join('; ') || 'Failed validation',
          });
        } else {
          validatedMarkets.push(validated);
        }
      }
    }

    // Calculate overall data quality score
    const totalScore = validatedMarkets.reduce((sum, m) => sum + m.trustScore, 0);
    const avgScore = validatedMarkets.length > 0
      ? Math.round(totalScore / validatedMarkets.length)
      : 0;

    return {
      markets: validatedMarkets,
      filteredOut,
      fetchedAt: new Date(),
      totalFetched: markets.length,
      totalValidated: validatedMarkets.length,
      totalFiltered: filteredOut.length,
      sources: Array.from(sources),
      dataQualityScore: avgScore,
      warnings,
    };
  }

  /**
   * Validate a single market
   */
  async validateSingle(market: RawMarketData): Promise<ValidatedMarket | null> {
    const result = await this.validateMarkets([market]);

    if (result.markets.length > 0) {
      return result.markets[0];
    }

    return null;
  }

  /**
   * Get current oracle prices
   */
  async getOraclePrices(): Promise<{ btc?: number; eth?: number }> {
    if (Date.now() - this.lastOracleFetch > 60000) {
      this.oraclePrices = await getOraclePrices();
      this.lastOracleFetch = Date.now();
    }

    return this.oraclePrices;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.marketCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.marketCache.size;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global Trust Engine instance
 */
export const trustEngine = new TrustEngine();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format trust indicator for Telegram display
 */
export function formatTrustIndicator(market: ValidatedMarket): string {
  const indicator = getTrustIndicator(market.trustScore);
  const freshness = market.isFresh ? '' : ' (stale)';

  return `${indicator.emoji} ${indicator.label}${freshness}`;
}

/**
 * Format validation summary for display
 */
export function formatValidationSummary(market: ValidatedMarket): string {
  const lines: string[] = [];

  lines.push(`Trust Score: ${market.trustScore}/100`);
  lines.push(`Source: ${market.sourceLabel}`);
  lines.push(`Age: ${Math.round(market.dataAgeSeconds)}s`);

  if (market.validation.warnings.length > 0) {
    lines.push(`Warnings:`);
    for (const warning of market.validation.warnings.slice(0, 3)) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export default trustEngine;
