/**
 * Oracle Forecaster Service
 *
 * Autonomous forecasting service that:
 * 1. Discovers trending markets via discovery.ts
 * 2. Generates forecasts using the Forecaster agent
 * 3. Saves results to Supabase oracle_forecasts table
 * 4. Updates aggregate stats
 *
 * This is the core engine that powers Oracle's autonomous predictions.
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import { discoverTrendingMarkets, TriagedMarket } from './discovery';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { searchMarkets } from '../../skills/markets';
import { estimateBaseRate } from '../analyst/baserates';
import { gatherEvidence } from '../analyst/evidence';
import { UnifiedMarket, MarketCategory, detectCategory } from '../dataFabric/types';

// =============================================================================
// TYPES
// =============================================================================

export interface OracleForecast {
  // Core identification
  market_id: string;
  platform: string;
  question: string;
  category: string;

  // Forecast
  probability: number;
  confidence: string;
  confidence_low: number;
  confidence_high: number;

  // Market comparison
  market_price: number;
  edge: number;
  edge_direction: string;

  // Recommendation
  action: string;
  suggested_size: string | null;
  risk_level: string | null;
  best_platform: string | null;

  // Full methodology
  methodology: Record<string, unknown>;
  uncertainties: unknown[];
  update_triggers: unknown[];
  sources: unknown[];

  // Market metadata
  market_volume: number;
  market_end_date: string | null;
  market_description: string | null;
}

export interface OracleRunResult {
  success: boolean;
  runId: string;
  forecasts: number;
  scanned: number;
  skipped: number;
  failed: number;
  duration_ms: number;
  errors: string[];
}

// =============================================================================
// FORECAST GENERATION
// =============================================================================

/**
 * Calculate confidence level based on evidence quality
 */
function calculateConfidence(outsideView: any, insideView: any): 'high' | 'medium' | 'low' {
  const outsideConfidence = outsideView.confidence || 'medium';
  const evidenceCount = (insideView.bullishFactors?.length || 0) + (insideView.bearishFactors?.length || 0);

  if (outsideConfidence === 'high' && evidenceCount >= 4) return 'high';
  if (outsideConfidence === 'high' || evidenceCount >= 3) return 'medium';
  return 'low';
}

/**
 * Calculate confidence interval based on probability and confidence level
 */
function calculateConfidenceInterval(probability: number, confidence: string): { low: number; high: number } {
  const width = confidence === 'high' ? 0.10 : confidence === 'medium' ? 0.15 : 0.20;
  return {
    low: Math.max(0.02, probability - width),
    high: Math.min(0.98, probability + width),
  };
}

/**
 * Generate key uncertainties for the forecast
 */
function generateUncertainties(question: string, category: MarketCategory, insideView: any): unknown[] {
  const uncertainties: unknown[] = [];
  const q = question.toLowerCase();

  // Category-specific uncertainties
  if (category === 'politics') {
    uncertainties.push({ factor: 'Polling volatility', impact: 'Polls can shift 5-10% in final weeks' });
    uncertainties.push({ factor: 'Turnout uncertainty', impact: 'Unexpected turnout could shift outcome 3-5%' });
  } else if (category === 'crypto') {
    uncertainties.push({ factor: 'Market sentiment', impact: 'Crypto markets highly sentiment-driven' });
    uncertainties.push({ factor: 'Regulatory news', impact: 'Sudden regulation could move markets 20%+' });
  } else if (category === 'economics') {
    uncertainties.push({ factor: 'Fed communication', impact: 'Fed language shifts market expectations' });
    uncertainties.push({ factor: 'Data revisions', impact: 'Economic data often revised significantly' });
  }

  // Add from evidence
  if (insideView.bearishFactors?.length > 0) {
    uncertainties.push({
      factor: 'Key risk',
      impact: insideView.bearishFactors[0]?.factor || 'Downside scenario',
    });
  }

  return uncertainties.slice(0, 4);
}

/**
 * Generate update triggers for the forecast
 */
function generateUpdateTriggers(question: string, category: MarketCategory, probability: number): unknown[] {
  const triggers: unknown[] = [];

  if (category === 'politics') {
    triggers.push({ event: 'Major poll release', action: 'Reassess if 3+ point shift' });
    triggers.push({ event: 'Breaking scandal/endorsement', action: 'Immediate reassessment' });
  } else if (category === 'crypto') {
    triggers.push({ event: 'Price moves 10%+', action: 'Reassess probability' });
    triggers.push({ event: 'Major protocol announcement', action: 'Update inside view' });
  } else if (category === 'economics') {
    triggers.push({ event: 'Fed meeting/minutes', action: 'Update post-release' });
    triggers.push({ event: 'Key economic data', action: 'Assess impact on base rate' });
  }

  // Generic triggers
  triggers.push({ event: 'Market moves 15%+ from current', action: 'Investigate and reassess' });

  return triggers.slice(0, 4);
}

/**
 * Generate trading recommendation
 */
function generateTradingRecommendation(
  probability: number,
  consensusPrice: number,
  edge: number,
  confidence: string,
  marketPrices: Array<{ platform: string; price: number; volume: number }>
): Record<string, unknown> {
  const absEdge = Math.abs(edge);

  // Determine action
  let action = 'NO_TRADE';
  if (absEdge >= 0.05 && confidence !== 'low') {
    action = edge > 0 ? 'BUY_YES' : 'BUY_NO';
  } else if (absEdge >= 0.03 && confidence === 'high') {
    action = edge > 0 ? 'BUY_YES' : 'BUY_NO';
  } else if (absEdge >= 0.03) {
    action = 'WAIT';
  }

  // Determine size
  let suggestedSize = null;
  if (action !== 'NO_TRADE' && action !== 'WAIT') {
    if (confidence === 'high' && absEdge >= 0.10) {
      suggestedSize = 'large';
    } else if (confidence === 'high' || absEdge >= 0.07) {
      suggestedSize = 'medium';
    } else {
      suggestedSize = 'small';
    }
  }

  // Determine risk level
  let riskLevel = null;
  if (action !== 'NO_TRADE' && action !== 'WAIT') {
    if (confidence === 'low' || absEdge < 0.05) {
      riskLevel = 'high';
    } else if (confidence === 'medium') {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
  }

  // Find best platform
  let bestPlatform = null;
  if (marketPrices.length > 0) {
    const sorted = [...marketPrices].sort((a, b) => {
      if (edge > 0) {
        return a.price - b.price; // Buy YES where cheapest
      } else {
        return b.price - a.price; // Buy NO where most expensive
      }
    });
    bestPlatform = sorted[0]?.platform || null;
  }

  return {
    action,
    suggestedSize,
    riskLevel,
    bestPlatform,
    reasoning: action === 'NO_TRADE'
      ? 'Insufficient edge or confidence for trade'
      : action === 'WAIT'
        ? 'Edge present but confidence insufficient - monitor for better entry'
        : `${absEdge >= 0.05 ? 'Strong' : 'Moderate'} edge detected (${(absEdge * 100).toFixed(1)}%)`,
  };
}

/**
 * Generate a single forecast for a market
 */
async function generateForecast(market: TriagedMarket): Promise<OracleForecast | null> {
  try {
    console.log(`[Oracle] Generating forecast for: ${market.question.substring(0, 50)}...`);

    // Step 1: Get current market prices
    const existingMarkets = await searchMarkets(market.question);
    const marketPrices: Array<{ platform: string; price: number; volume: number }> = [];

    for (const m of existingMarkets.slice(0, 5)) {
      if (m.yesPrice > 0 && m.yesPrice < 1) {
        marketPrices.push({
          platform: m.platform,
          price: m.yesPrice,
          volume: m.volume || 0,
        });
      }
    }

    // Use market's own price if no search results
    if (marketPrices.length === 0) {
      marketPrices.push({
        platform: market.platform,
        price: market.yesPrice,
        volume: market.volume,
      });
    }

    const consensusPrice = marketPrices.reduce((sum, m) => sum + m.price, 0) / marketPrices.length;

    // Step 2: Outside view - Base rate estimation
    const category = market.category || detectCategory(market.question);
    const outsideView = await estimateBaseRate(market.question, category);

    // Step 3: Inside view - Evidence gathering
    const unifiedMarket: UnifiedMarket = {
      id: market.id,
      slug: 'temp',
      question: market.question,
      category,
      tags: [],
      platforms: [],
      bestBid: consensusPrice - 0.02,
      bestAsk: consensusPrice + 0.02,
      consensusPrice,
      priceRange: { min: consensusPrice - 0.1, max: consensusPrice + 0.1 },
      totalVolume: market.volume,
      totalVolume24h: market.volume24h || 0,
      totalLiquidity: market.liquidity,
      lastUpdate: new Date(),
      status: 'active',
      isResolved: false,
      overallTrustScore: 0.5,
      platformCount: marketPrices.length,
    };

    const insideView = await gatherEvidence(unifiedMarket, { includeNews: false });

    // Step 4: Synthesis
    let probability = outsideView.baseRate;
    probability += insideView.insideAdjustment;
    probability = Math.max(0.02, Math.min(0.98, probability));

    // Step 5: Confidence assessment
    const confidence = calculateConfidence(outsideView, insideView);
    const confidenceInterval = calculateConfidenceInterval(probability, confidence);

    // Step 6: Edge calculation
    const edge = probability - consensusPrice;
    const edgeDirection = edge > 0.03 ? 'bullish' : edge < -0.03 ? 'bearish' : 'neutral';

    // Step 7: Generate additional analysis
    const uncertainties = generateUncertainties(market.question, category, insideView);
    const updateTriggers = generateUpdateTriggers(market.question, category, probability);
    const tradingRec = generateTradingRecommendation(probability, consensusPrice, edge, confidence, marketPrices);

    // Build methodology object
    const methodology = {
      outsideView: {
        referenceClass: outsideView.referenceClass,
        baseRate: outsideView.baseRate,
        sampleSize: outsideView.sampleSize || 'N/A',
        confidence: outsideView.confidence,
        reasoning: outsideView.reasoning,
      },
      insideView: {
        bullishFactors: insideView.bullishFactors?.slice(0, 4) || [],
        bearishFactors: insideView.bearishFactors?.slice(0, 4) || [],
        netDirection: insideView.netDirection,
        adjustment: insideView.insideAdjustment,
      },
      synthesis: {
        description: `Base rate ${(outsideView.baseRate * 100).toFixed(0)}% → Adjusted ${(probability * 100).toFixed(0)}%`,
        reasoning: `Starting from "${outsideView.referenceClass}" base rate, ${insideView.netDirection === 'bullish' ? 'bullish factors dominate' : insideView.netDirection === 'bearish' ? 'bearish factors dominate' : 'factors balanced'}.`,
      },
      model: 'claude-opus-4-5',
      temperature: 0.3,
    };

    const forecast: OracleForecast = {
      market_id: market.id,
      platform: market.platform,
      question: market.question,
      category,
      probability,
      confidence,
      confidence_low: confidenceInterval.low,
      confidence_high: confidenceInterval.high,
      market_price: consensusPrice,
      edge,
      edge_direction: edgeDirection,
      action: tradingRec.action as string,
      suggested_size: tradingRec.suggestedSize as string | null,
      risk_level: tradingRec.riskLevel as string | null,
      best_platform: tradingRec.bestPlatform as string | null,
      methodology,
      uncertainties,
      update_triggers: updateTriggers,
      sources: marketPrices.map(m => ({ platform: m.platform, price: m.price, volume: m.volume })),
      market_volume: market.volume,
      market_end_date: market.endDate?.toISOString() || null,
      market_description: market.description || null,
    };

    console.log(`[Oracle] Forecast complete: ${(probability * 100).toFixed(0)}% (edge: ${(edge * 100).toFixed(1)}%)`);
    return forecast;
  } catch (error) {
    console.error(`[Oracle] Failed to generate forecast for ${market.id}:`, error);
    return null;
  }
}

// =============================================================================
// STORAGE
// =============================================================================

/**
 * Save a forecast to the database
 */
async function saveForecast(forecast: OracleForecast): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('[Oracle] Supabase not configured, skipping save');
    return false;
  }

  try {
    const { error } = await supabaseAdmin
      .from('oracle_forecasts')
      .insert({
        market_id: forecast.market_id,
        platform: forecast.platform,
        question: forecast.question,
        category: forecast.category,
        probability: forecast.probability,
        confidence: forecast.confidence,
        confidence_low: forecast.confidence_low,
        confidence_high: forecast.confidence_high,
        market_price: forecast.market_price,
        edge: forecast.edge,
        edge_direction: forecast.edge_direction,
        action: forecast.action,
        suggested_size: forecast.suggested_size,
        risk_level: forecast.risk_level,
        best_platform: forecast.best_platform,
        methodology: forecast.methodology,
        uncertainties: forecast.uncertainties,
        update_triggers: forecast.update_triggers,
        sources: forecast.sources,
        market_volume: forecast.market_volume,
        market_end_date: forecast.market_end_date,
        market_description: forecast.market_description,
      });

    if (error) {
      console.error('[Oracle] Error saving forecast:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Oracle] Exception saving forecast:', error);
    return false;
  }
}

/**
 * Create a run log entry
 */
async function createRunLog(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('oracle_runs')
      .insert({
        started_at: new Date().toISOString(),
        status: 'running',
        platforms_queried: ['polymarket', 'jupiter'],
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Oracle] Error creating run log:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('[Oracle] Exception creating run log:', error);
    return null;
  }
}

/**
 * Update run log with results
 */
async function updateRunLog(
  runId: string,
  result: {
    status: 'completed' | 'failed' | 'partial';
    scanned: number;
    eligible: number;
    skipped: number;
    generated: number;
    saved: number;
    failed: number;
    duration_ms: number;
    errorMessage?: string;
  }
): Promise<void> {
  if (!isSupabaseConfigured || !runId) return;

  try {
    await supabaseAdmin
      .from('oracle_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: result.status,
        markets_scanned: result.scanned,
        markets_eligible: result.eligible,
        markets_skipped_existing: result.skipped,
        forecasts_generated: result.generated,
        forecasts_saved: result.saved,
        forecasts_failed: result.failed,
        duration_ms: result.duration_ms,
        error_message: result.errorMessage,
      })
      .eq('id', runId);
  } catch (error) {
    console.error('[Oracle] Error updating run log:', error);
  }
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

/**
 * Run the Oracle Forecaster
 *
 * Main entry point for autonomous forecasting:
 * 1. Discovers trending markets
 * 2. Generates forecasts for each
 * 3. Saves to database
 * 4. Returns summary
 *
 * @param targetCount - Number of markets to forecast (default: 10)
 */
export async function runOracleForecaster(targetCount: number = 10): Promise<OracleRunResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log('[Oracle] Starting autonomous forecasting run...');

  // Create run log
  const runId = await createRunLog();

  try {
    // Step 1: Discover markets
    console.log('[Oracle] Step 1: Discovering trending markets...');
    const discovery = await discoverTrendingMarkets(targetCount);

    if (discovery.markets.length === 0) {
      console.log('[Oracle] No eligible markets found');
      if (runId) {
        await updateRunLog(runId, {
          status: 'completed',
          scanned: discovery.scanned,
          eligible: 0,
          skipped: discovery.skippedExisting,
          generated: 0,
          saved: 0,
          failed: 0,
          duration_ms: Date.now() - startTime,
        });
      }
      return {
        success: true,
        runId: runId || 'no-db',
        forecasts: 0,
        scanned: discovery.scanned,
        skipped: discovery.skippedExisting,
        failed: 0,
        duration_ms: Date.now() - startTime,
        errors: [],
      };
    }

    // Step 2: Generate forecasts
    console.log(`[Oracle] Step 2: Generating ${discovery.markets.length} forecasts...`);
    let savedCount = 0;
    let failedCount = 0;

    for (const market of discovery.markets) {
      try {
        const forecast = await generateForecast(market);

        if (forecast) {
          const saved = await saveForecast(forecast);
          if (saved) {
            savedCount++;
          } else {
            failedCount++;
            errors.push(`Failed to save forecast for ${market.id}`);
          }
        } else {
          failedCount++;
          errors.push(`Failed to generate forecast for ${market.id}`);
        }
      } catch (error) {
        failedCount++;
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Error processing ${market.id}: ${errMsg}`);
        console.error(`[Oracle] Error processing ${market.id}:`, error);
      }

      // Small delay between forecasts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 3: Update run log
    const duration_ms = Date.now() - startTime;
    const status = failedCount === 0 ? 'completed' : failedCount < discovery.markets.length ? 'partial' : 'failed';

    if (runId) {
      await updateRunLog(runId, {
        status,
        scanned: discovery.scanned,
        eligible: discovery.eligible,
        skipped: discovery.skippedExisting,
        generated: savedCount + failedCount,
        saved: savedCount,
        failed: failedCount,
        duration_ms,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      });
    }

    console.log(`[Oracle] Run complete: ${savedCount} forecasts saved, ${failedCount} failed`);

    return {
      success: true,
      runId: runId || 'no-db',
      forecasts: savedCount,
      scanned: discovery.scanned,
      skipped: discovery.skippedExisting,
      failed: failedCount,
      duration_ms,
      errors,
    };
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal error: ${errMsg}`);

    console.error('[Oracle] Fatal error during run:', error);

    if (runId) {
      await updateRunLog(runId, {
        status: 'failed',
        scanned: 0,
        eligible: 0,
        skipped: 0,
        generated: 0,
        saved: 0,
        failed: 0,
        duration_ms,
        errorMessage: errMsg,
      });
    }

    return {
      success: false,
      runId: runId || 'no-db',
      forecasts: 0,
      scanned: 0,
      skipped: 0,
      failed: 0,
      duration_ms,
      errors,
    };
  }
}

/**
 * Get Oracle stats from database
 */
export async function getOracleStats(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('oracle_stats')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('[Oracle] Error fetching stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Oracle] Exception fetching stats:', error);
    return null;
  }
}

/**
 * Get active (unresolved) forecasts
 */
export async function getActiveForecasts(options?: {
  category?: string;
  limit?: number;
}): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabaseAdmin
      .from('oracle_forecasts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Oracle] Error fetching active forecasts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Oracle] Exception fetching active forecasts:', error);
    return [];
  }
}

/**
 * Get resolved forecasts
 */
export async function getResolvedForecasts(options?: {
  category?: string;
  limit?: number;
}): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabaseAdmin
      .from('oracle_forecasts')
      .select('*')
      .eq('resolved', true)
      .order('resolved_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Oracle] Error fetching resolved forecasts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Oracle] Exception fetching resolved forecasts:', error);
    return [];
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  generateForecast,
  saveForecast,
  createRunLog,
  updateRunLog,
};
