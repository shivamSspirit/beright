/**
 * Market Watcher Service
 *
 * Monitors prediction markets for resolution and auto-resolves predictions.
 * This is the core automation engine for BeRight Protocol.
 */

import { EventEmitter } from 'events';
import { DFlowWebSocket, getDFlowWebSocket, DFlowPriceUpdate } from '../lib/dflow/websocket';
import { getMarket, checkMarketResolutions, DFlowMarket } from '../lib/dflow/api';
import { db, supabase } from '../lib/supabase/client';
import { resolvePrediction as onchainResolve } from '../lib/onchain/commit';
import { calculateBrierScore, interpretBrierScore } from '../lib/onchain/memo';

// Types
interface WatchedMarket {
  ticker: string;
  predictionIds: string[];
  lastChecked: Date;
  status: 'watching' | 'resolved' | 'error';
  currentPrice?: { yes: number; no: number };
}

interface PredictionToResolve {
  id: string;
  user_id: string;
  market_id: string;
  market_ticker: string;
  probability: number;
  direction: 'YES' | 'NO';
  tx_signature?: string;
  created_at: string;
}

interface ResolutionResult {
  predictionId: string;
  outcome: boolean;
  brierScore: number;
  txSignature?: string;
  error?: string;
}

export class MarketWatcher extends EventEmitter {
  private watchedMarkets: Map<string, WatchedMarket> = new Map();
  private ws: DFlowWebSocket;
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollFrequencyMs = 60000; // Check every minute
  private useWebSocket = true;

  constructor(options?: { pollFrequencyMs?: number; useWebSocket?: boolean }) {
    super();
    this.ws = getDFlowWebSocket();
    if (options?.pollFrequencyMs) this.pollFrequencyMs = options.pollFrequencyMs;
    if (options?.useWebSocket !== undefined) this.useWebSocket = options.useWebSocket;
  }

  /**
   * Start the market watcher service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[MarketWatcher] Already running');
      return;
    }

    console.log('[MarketWatcher] Starting...');
    this.isRunning = true;

    // Load pending predictions from database
    await this.loadPendingPredictions();

    // Connect WebSocket for real-time updates
    if (this.useWebSocket) {
      await this.setupWebSocket();
    }

    // Start polling for resolution status
    this.startPolling();

    this.emit('started');
    console.log(`[MarketWatcher] Started. Watching ${this.watchedMarkets.size} markets`);
  }

  /**
   * Stop the market watcher service
   */
  stop(): void {
    console.log('[MarketWatcher] Stopping...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.useWebSocket) {
      this.ws.disconnect();
    }

    this.emit('stopped');
    console.log('[MarketWatcher] Stopped');
  }

  /**
   * Load pending predictions from database
   */
  private async loadPendingPredictions(): Promise<void> {
    try {
      // Get predictions that haven't been resolved yet
      const { data: predictions, error } = await supabase
        .from('predictions')
        .select('*')
        .is('resolved_at', null)
        .not('market_ticker', 'is', null);

      if (error) {
        console.error('[MarketWatcher] Failed to load predictions:', error);
        return;
      }

      if (!predictions || predictions.length === 0) {
        console.log('[MarketWatcher] No pending predictions to watch');
        return;
      }

      // Group by market ticker
      for (const pred of predictions) {
        const ticker = pred.market_ticker;
        if (!ticker) continue;

        if (!this.watchedMarkets.has(ticker)) {
          this.watchedMarkets.set(ticker, {
            ticker,
            predictionIds: [],
            lastChecked: new Date(0),
            status: 'watching',
          });
        }

        const watched = this.watchedMarkets.get(ticker)!;
        if (!watched.predictionIds.includes(pred.id)) {
          watched.predictionIds.push(pred.id);
        }
      }

      console.log(`[MarketWatcher] Loaded ${predictions.length} pending predictions across ${this.watchedMarkets.size} markets`);
    } catch (err) {
      console.error('[MarketWatcher] Error loading predictions:', err);
    }
  }

  /**
   * Setup WebSocket for real-time price updates
   */
  private async setupWebSocket(): Promise<void> {
    try {
      // Setup event handlers
      this.ws.on('price', (update: DFlowPriceUpdate) => {
        this.handlePriceUpdate(update);
      });

      this.ws.on('disconnected', () => {
        console.log('[MarketWatcher] WebSocket disconnected, relying on polling');
      });

      // Connect
      await this.ws.connect();

      // Subscribe to watched markets
      const tickers = [...this.watchedMarkets.keys()];
      if (tickers.length > 0) {
        this.ws.subscribeToPrices(tickers);
      }
    } catch (err) {
      console.error('[MarketWatcher] WebSocket setup failed:', err);
      console.log('[MarketWatcher] Falling back to polling only');
      this.useWebSocket = false;
    }
  }

  /**
   * Handle real-time price updates
   */
  private handlePriceUpdate(update: DFlowPriceUpdate): void {
    const watched = this.watchedMarkets.get(update.market_ticker);
    if (!watched) return;

    watched.currentPrice = {
      yes: parseFloat(update.yes_bid) || 0,
      no: parseFloat(update.no_bid) || 0,
    };

    this.emit('priceUpdate', {
      ticker: update.market_ticker,
      price: watched.currentPrice,
    });
  }

  /**
   * Start polling for market resolution status
   */
  private startPolling(): void {
    // Initial check
    this.checkAllMarkets();

    // Schedule periodic checks
    this.pollInterval = setInterval(() => {
      this.checkAllMarkets();
    }, this.pollFrequencyMs);
  }

  /**
   * Check all watched markets for resolution
   */
  private async checkAllMarkets(): Promise<void> {
    if (this.watchedMarkets.size === 0) return;

    const tickers = [...this.watchedMarkets.keys()];
    console.log(`[MarketWatcher] Checking ${tickers.length} markets for resolution...`);

    try {
      const resolutions = await checkMarketResolutions(tickers);

      for (const [ticker, status] of resolutions) {
        const watched = this.watchedMarkets.get(ticker);
        if (!watched) continue;

        watched.lastChecked = new Date();

        if (status.resolved && status.result) {
          console.log(`[MarketWatcher] Market resolved: ${ticker} = ${status.result.toUpperCase()}`);
          await this.resolveMarketPredictions(ticker, status.result === 'yes');
        }
      }
    } catch (err) {
      console.error('[MarketWatcher] Error checking markets:', err);
    }
  }

  /**
   * Resolve all predictions for a market
   */
  private async resolveMarketPredictions(ticker: string, outcomeYes: boolean): Promise<void> {
    const watched = this.watchedMarkets.get(ticker);
    if (!watched || watched.status === 'resolved') return;

    const results: ResolutionResult[] = [];

    for (const predictionId of watched.predictionIds) {
      try {
        const result = await this.resolvePrediction(predictionId, outcomeYes);
        results.push(result);
      } catch (err) {
        console.error(`[MarketWatcher] Failed to resolve prediction ${predictionId}:`, err);
        results.push({
          predictionId,
          outcome: outcomeYes,
          brierScore: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Mark market as resolved
    watched.status = 'resolved';

    // Emit resolution event
    this.emit('marketResolved', {
      ticker,
      outcome: outcomeYes ? 'YES' : 'NO',
      results,
    });

    // Remove from watched list
    this.watchedMarkets.delete(ticker);

    // Unsubscribe from WebSocket
    if (this.useWebSocket) {
      this.ws.unsubscribe('prices', [ticker]);
    }

    console.log(`[MarketWatcher] Resolved ${results.length} predictions for ${ticker}`);
  }

  /**
   * Resolve a single prediction
   */
  private async resolvePrediction(predictionId: string, outcomeYes: boolean): Promise<ResolutionResult> {
    // Get prediction details
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', predictionId)
      .single();

    if (error || !prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }

    // Calculate Brier score
    const brierScore = calculateBrierScore({
      probability: prediction.probability,
      direction: prediction.direction as 'YES' | 'NO',
      outcome: outcomeYes,
    });

    const brierInterpretation = interpretBrierScore(brierScore);

    // Update database
    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        resolved_at: new Date().toISOString(),
        outcome: outcomeYes ? 'YES' : 'NO',
        brier_score: brierScore,
        auto_resolved: true,
      })
      .eq('id', predictionId);

    if (updateError) {
      throw new Error(`Failed to update prediction: ${updateError.message}`);
    }

    // Commit resolution on-chain (if original was on-chain)
    let txSignature: string | undefined;
    if (prediction.tx_signature) {
      try {
        const onchainResult = await onchainResolve(
          prediction.tx_signature,
          prediction.probability,
          prediction.direction as 'YES' | 'NO',
          outcomeYes
        );

        if (onchainResult.success) {
          txSignature = onchainResult.signature;

          // Update with resolution TX
          await supabase
            .from('predictions')
            .update({ resolution_tx: txSignature })
            .eq('id', predictionId);
        }
      } catch (err) {
        console.error(`[MarketWatcher] On-chain resolution failed for ${predictionId}:`, err);
      }
    }

    // Emit prediction resolved event
    this.emit('predictionResolved', {
      predictionId,
      userId: prediction.user_id,
      question: prediction.question,
      predictedDirection: prediction.direction,
      predictedProbability: prediction.probability,
      outcome: outcomeYes ? 'YES' : 'NO',
      brierScore,
      quality: brierInterpretation.quality,
      txSignature,
    });

    return {
      predictionId,
      outcome: outcomeYes,
      brierScore,
      txSignature,
    };
  }

  /**
   * Add a new prediction to watch
   */
  async watchPrediction(predictionId: string, marketTicker: string): Promise<void> {
    if (!this.watchedMarkets.has(marketTicker)) {
      this.watchedMarkets.set(marketTicker, {
        ticker: marketTicker,
        predictionIds: [],
        lastChecked: new Date(0),
        status: 'watching',
      });

      // Subscribe to WebSocket updates
      if (this.useWebSocket && this.ws.connected) {
        this.ws.subscribeToPrices([marketTicker]);
      }
    }

    const watched = this.watchedMarkets.get(marketTicker)!;
    if (!watched.predictionIds.includes(predictionId)) {
      watched.predictionIds.push(predictionId);
    }

    console.log(`[MarketWatcher] Now watching ${marketTicker} for prediction ${predictionId}`);
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    watchedMarkets: number;
    pendingPredictions: number;
    useWebSocket: boolean;
    wsConnected: boolean;
  } {
    let pendingPredictions = 0;
    for (const watched of this.watchedMarkets.values()) {
      pendingPredictions += watched.predictionIds.length;
    }

    return {
      isRunning: this.isRunning,
      watchedMarkets: this.watchedMarkets.size,
      pendingPredictions,
      useWebSocket: this.useWebSocket,
      wsConnected: this.ws.connected,
    };
  }

  /**
   * Get watched markets details
   */
  getWatchedMarkets(): WatchedMarket[] {
    return [...this.watchedMarkets.values()];
  }

  /**
   * Force check a specific market
   */
  async forceCheck(ticker: string): Promise<void> {
    const resolutions = await checkMarketResolutions([ticker]);
    const status = resolutions.get(ticker);

    if (status?.resolved && status.result) {
      await this.resolveMarketPredictions(ticker, status.result === 'yes');
    }
  }
}

// Singleton instance
let watcherInstance: MarketWatcher | null = null;

export function getMarketWatcher(): MarketWatcher {
  if (!watcherInstance) {
    watcherInstance = new MarketWatcher();
  }
  return watcherInstance;
}

// CLI interface
if (require.main === module) {
  const watcher = new MarketWatcher({ pollFrequencyMs: 30000, useWebSocket: true });

  watcher.on('started', () => console.log('Market watcher started'));
  watcher.on('stopped', () => console.log('Market watcher stopped'));

  watcher.on('priceUpdate', (data) => {
    console.log(`[PRICE] ${data.ticker}: YES ${data.price.yes} / NO ${data.price.no}`);
  });

  watcher.on('marketResolved', (data) => {
    console.log(`[RESOLVED] ${data.ticker} = ${data.outcome}`);
    console.log(`  Resolved ${data.results.length} predictions`);
  });

  watcher.on('predictionResolved', (data) => {
    console.log(`[PREDICTION] ${data.predictionId}`);
    console.log(`  Predicted: ${data.predictedDirection} @ ${(data.predictedProbability * 100).toFixed(0)}%`);
    console.log(`  Outcome: ${data.outcome}`);
    console.log(`  Brier Score: ${data.brierScore.toFixed(4)} (${data.quality})`);
  });

  watcher.start().catch(console.error);

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    watcher.stop();
    process.exit(0);
  });
}
