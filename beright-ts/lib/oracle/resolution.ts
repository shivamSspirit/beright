/**
 * Oracle Resolution Tracking Service
 *
 * Checks for resolved markets and updates Oracle forecasts with outcomes.
 * Calculates Brier scores and updates aggregate statistics.
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { polymarketProvider } from '../dataFabric/providers/polymarket';
import { jupiterProvider } from '../dataFabric/providers/jupiter';

// =============================================================================
// TYPES
// =============================================================================

export interface ResolutionResult {
  forecastId: string;
  marketId: string;
  outcome: boolean;
  brierScore: number;
  updatedAt: Date;
}

export interface ResolutionRunResult {
  success: boolean;
  checked: number;
  resolved: number;
  failed: number;
  results: ResolutionResult[];
  errors: string[];
  duration_ms: number;
}

// =============================================================================
// BRIER SCORE CALCULATION
// =============================================================================

/**
 * Calculate Brier score: (probability - outcome)²
 *
 * @param probability - Oracle's predicted probability (0-1)
 * @param outcome - Actual outcome (true = YES, false = NO)
 * @returns Brier score (0-1, lower is better)
 */
export function calculateBrierScore(probability: number, outcome: boolean): number {
  const actual = outcome ? 1 : 0;
  return Math.pow(probability - actual, 2);
}

/**
 * Calculate log score for better discrimination at extremes
 *
 * @param probability - Oracle's predicted probability (0-1)
 * @param outcome - Actual outcome
 * @returns Log score (more negative = worse)
 */
export function calculateLogScore(probability: number, outcome: boolean): number {
  // Clamp probability to avoid log(0)
  const p = Math.max(0.001, Math.min(0.999, probability));

  if (outcome) {
    return Math.log(p);
  } else {
    return Math.log(1 - p);
  }
}

// =============================================================================
// MARKET RESOLUTION CHECKING
// =============================================================================

interface MarketOutcome {
  resolved: boolean;
  outcome: boolean | null;
  resolvedAt: Date | null;
}

/**
 * Check if a Polymarket market has resolved
 */
async function checkPolymarketResolution(marketId: string): Promise<MarketOutcome> {
  try {
    const market = await polymarketProvider.fetchMarket(marketId);

    if (!market) {
      return { resolved: false, outcome: null, resolvedAt: null };
    }

    // Check if market is resolved
    const rawData = market._raw as Record<string, unknown> | undefined;
    if (market.status === 'resolved' || rawData?.resolved) {
      // Determine outcome from final price
      // YES = 1.0, NO = 0.0
      const yesPrice = market.yesPrice;
      const outcome = yesPrice >= 0.99; // YES won if price is ~1

      return {
        resolved: true,
        outcome,
        resolvedAt: new Date(),
      };
    }

    return { resolved: false, outcome: null, resolvedAt: null };
  } catch (error) {
    console.error(`[Resolution] Error checking Polymarket ${marketId}:`, error);
    return { resolved: false, outcome: null, resolvedAt: null };
  }
}

/**
 * Check if a Jupiter market has resolved
 */
async function checkJupiterResolution(marketId: string): Promise<MarketOutcome> {
  try {
    // Remove jupiter- prefix if present
    const cleanId = marketId.replace(/^jupiter-/, '');
    const market = await jupiterProvider.fetchMarket(cleanId);

    if (!market) {
      return { resolved: false, outcome: null, resolvedAt: null };
    }

    // Check resolution status
    const rawData = market._raw as Record<string, unknown> | undefined;
    const rawMarket = rawData?.market as Record<string, unknown> | undefined;
    const status = rawMarket?.status as string | undefined;
    if (status === 'resolved_yes' || status === 'resolved_no') {
      return {
        resolved: true,
        outcome: status === 'resolved_yes',
        resolvedAt: new Date(),
      };
    }

    return { resolved: false, outcome: null, resolvedAt: null };
  } catch (error) {
    console.error(`[Resolution] Error checking Jupiter ${marketId}:`, error);
    return { resolved: false, outcome: null, resolvedAt: null };
  }
}

/**
 * Check resolution status for a market on any platform
 */
async function checkMarketResolution(
  marketId: string,
  platform: string
): Promise<MarketOutcome> {
  switch (platform.toLowerCase()) {
    case 'polymarket':
      return checkPolymarketResolution(marketId);
    case 'jupiter':
      return checkJupiterResolution(marketId);
    default:
      console.warn(`[Resolution] Unknown platform: ${platform}`);
      return { resolved: false, outcome: null, resolvedAt: null };
  }
}

// =============================================================================
// RESOLUTION PROCESSING
// =============================================================================

/**
 * Resolve a single forecast with an outcome
 */
async function resolveForecast(
  forecastId: string,
  probability: number,
  outcome: boolean
): Promise<ResolutionResult | null> {
  if (!isSupabaseConfigured) {
    console.warn('[Resolution] Supabase not configured');
    return null;
  }

  const brierScore = calculateBrierScore(probability, outcome);

  try {
    const { error } = await supabaseAdmin
      .from('oracle_forecasts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        actual_outcome: outcome,
        brier_score: brierScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', forecastId);

    if (error) {
      console.error(`[Resolution] Error updating forecast ${forecastId}:`, error);
      return null;
    }

    return {
      forecastId,
      marketId: '', // Will be populated by caller
      outcome,
      brierScore,
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error(`[Resolution] Exception resolving ${forecastId}:`, error);
    return null;
  }
}

// =============================================================================
// MAIN RESOLUTION SERVICE
// =============================================================================

/**
 * Check all unresolved forecasts and update with outcomes
 *
 * This should be run periodically (daily or more frequently)
 * to update Oracle's track record.
 */
export async function checkResolutions(): Promise<ResolutionRunResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const results: ResolutionResult[] = [];

  console.log('[Resolution] Starting resolution check...');

  if (!isSupabaseConfigured) {
    return {
      success: false,
      checked: 0,
      resolved: 0,
      failed: 0,
      results: [],
      errors: ['Supabase not configured'],
      duration_ms: Date.now() - startTime,
    };
  }

  try {
    // Get unresolved forecasts
    const { data: forecasts, error } = await supabaseAdmin
      .from('oracle_forecasts')
      .select('id, market_id, platform, probability, market_end_date')
      .eq('resolved', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Resolution] Error fetching forecasts:', error);
      return {
        success: false,
        checked: 0,
        resolved: 0,
        failed: 0,
        results: [],
        errors: [error.message],
        duration_ms: Date.now() - startTime,
      };
    }

    const unresolvedForecasts = forecasts || [];
    console.log(`[Resolution] Checking ${unresolvedForecasts.length} unresolved forecasts`);

    let resolved = 0;
    let failed = 0;

    for (const forecast of unresolvedForecasts) {
      try {
        // Skip if market hasn't ended yet
        if (forecast.market_end_date) {
          const endDate = new Date(forecast.market_end_date);
          if (endDate > new Date()) {
            continue; // Skip - market still active
          }
        }

        // Check resolution status
        const resolution = await checkMarketResolution(
          forecast.market_id,
          forecast.platform
        );

        if (resolution.resolved && resolution.outcome !== null) {
          const result = await resolveForecast(
            forecast.id,
            forecast.probability,
            resolution.outcome
          );

          if (result) {
            result.marketId = forecast.market_id;
            results.push(result);
            resolved++;
            console.log(`[Resolution] Resolved ${forecast.market_id}: ${resolution.outcome ? 'YES' : 'NO'} (Brier: ${result.brierScore.toFixed(4)})`);
          } else {
            failed++;
            errors.push(`Failed to update forecast ${forecast.id}`);
          }
        }

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failed++;
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Error processing ${forecast.id}: ${errMsg}`);
        console.error(`[Resolution] Error processing ${forecast.id}:`, error);
      }
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[Resolution] Complete: ${resolved} resolved, ${failed} failed in ${duration_ms}ms`);

    return {
      success: true,
      checked: unresolvedForecasts.length,
      resolved,
      failed,
      results,
      errors,
      duration_ms,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Resolution] Fatal error:', error);

    return {
      success: false,
      checked: 0,
      resolved: 0,
      failed: 0,
      results: [],
      errors: [errMsg],
      duration_ms: Date.now() - startTime,
    };
  }
}

/**
 * Manually resolve a forecast (for admin use)
 */
export async function manualResolve(
  forecastId: string,
  outcome: boolean
): Promise<ResolutionResult | null> {
  if (!isSupabaseConfigured) {
    console.warn('[Resolution] Supabase not configured');
    return null;
  }

  try {
    // Get forecast probability
    const { data: forecast, error: fetchError } = await supabaseAdmin
      .from('oracle_forecasts')
      .select('probability, market_id')
      .eq('id', forecastId)
      .single();

    if (fetchError || !forecast) {
      console.error('[Resolution] Forecast not found:', forecastId);
      return null;
    }

    const result = await resolveForecast(forecastId, forecast.probability, outcome);
    if (result) {
      result.marketId = forecast.market_id;
    }

    return result;
  } catch (error) {
    console.error('[Resolution] Error in manual resolve:', error);
    return null;
  }
}

/**
 * Recalculate Brier score for a forecast (if outcome changed)
 */
export async function recalculateBrier(forecastId: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: forecast, error } = await supabaseAdmin
      .from('oracle_forecasts')
      .select('probability, actual_outcome')
      .eq('id', forecastId)
      .single();

    if (error || !forecast || forecast.actual_outcome === null) {
      return null;
    }

    const brierScore = calculateBrierScore(forecast.probability, forecast.actual_outcome);

    await supabaseAdmin
      .from('oracle_forecasts')
      .update({ brier_score: brierScore })
      .eq('id', forecastId);

    return brierScore;
  } catch (error) {
    console.error('[Resolution] Error recalculating Brier:', error);
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  checkMarketResolution,
  resolveForecast,
};
