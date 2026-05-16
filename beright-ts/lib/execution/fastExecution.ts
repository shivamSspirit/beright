/**
 * Fast Execution Engine - Unified High-Speed Trading
 *
 * Combines all fast execution components:
 * - Connection pooling (fastConnection)
 * - Transaction building (fastTransaction)
 * - JITO bundles (jitoBundle)
 * - Jupiter Ultra (jupiterUltra)
 * - Latency tracking (latencyTracker)
 *
 * Target: Microsecond/millisecond execution for DFlow/Solana trades
 *
 * @author BeRight Protocol
 */

import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { EXECUTION_CONFIG, FastExecutionResult, LatencyMetrics } from '../../config/execution';
import { FastConnectionPool, getFastConnectionPool, initializeFastConnection } from './fastConnection';
import { FastTransactionBuilder, getFastTransactionBuilder } from './fastTransaction';
import { JitoBundleSubmitter, getJitoBundleSubmitter } from './jitoBundle';
import { JupiterUltraClient, getJupiterUltraClient } from './jupiterUltra';
import { LatencyTracker, getLatencyTracker, formatMicroseconds } from './latencyTracker';

// ============================================================================
// TYPES
// ============================================================================

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number; // In smallest unit (e.g., lamports for SOL, 10^6 for USDC)
  slippageBps?: number;
  useJito?: boolean;
  jitoTipLamports?: number;
  maxLatencyMs?: number;
  dryRun?: boolean;
}

export interface ArbitrageParams {
  marketId: string;
  buyPlatform: 'dflow' | 'polymarket' | 'kalshi';
  sellPlatform: 'dflow' | 'polymarket' | 'kalshi';
  side: 'YES' | 'NO';
  positionSizeUsd: number;
  spreadPct: number;
  atomic?: boolean; // Try to bundle both legs
}

export interface ArbitrageResult {
  success: boolean;
  buySignature?: string;
  sellSignature?: string;
  profitUsd: number;
  executionTimeMs: number;
  error?: string;
}

export interface EngineStats {
  initialized: boolean;
  totalSwaps: number;
  successfulSwaps: number;
  totalArbitrages: number;
  successfulArbitrages: number;
  avgLatencyMs: number;
  uptime: number;
}

// ============================================================================
// FAST EXECUTION ENGINE
// ============================================================================

export class FastExecutionEngine {
  private connectionPool: FastConnectionPool;
  private txBuilder: FastTransactionBuilder;
  private jitoSubmitter: JitoBundleSubmitter;
  private jupiterClient: JupiterUltraClient;
  private latencyTracker: LatencyTracker;

  private initialized: boolean = false;
  private startTime: number = 0;
  private stats = {
    totalSwaps: 0,
    successfulSwaps: 0,
    totalArbitrages: 0,
    successfulArbitrages: 0,
  };

  constructor() {
    this.connectionPool = getFastConnectionPool();
    this.txBuilder = getFastTransactionBuilder();
    this.jitoSubmitter = getJitoBundleSubmitter();
    this.jupiterClient = getJupiterUltraClient();
    this.latencyTracker = getLatencyTracker();
  }

  /**
   * Initialize the execution engine
   * Call this once at startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[FastExecution] Already initialized');
      return;
    }

    console.log('[FastExecution] Initializing execution engine...');

    this.startTime = Date.now();

    // Initialize connection pool (starts blockhash refresh)
    await initializeFastConnection();

    // Warm up Jupiter with a test quote
    try {
      await this.jupiterClient.getQuote({
        inputMint: EXECUTION_CONFIG.tokens.USDC,
        outputMint: EXECUTION_CONFIG.tokens.SOL,
        amount: 1_000_000, // 1 USDC
      });
      console.log('[FastExecution] Jupiter warmed up');
    } catch (error) {
      console.warn('[FastExecution] Jupiter warm-up failed:', error);
    }

    this.initialized = true;
    console.log('[FastExecution] Engine initialized and ready');
  }

  /**
   * Execute a swap with maximum speed
   */
  async executeSwap(params: SwapParams, signer: Keypair): Promise<FastExecutionResult> {
    this.stats.totalSwaps++;
    this.latencyTracker.reset();
    this.latencyTracker.start('total');

    // Check max latency
    const maxLatencyMs = params.maxLatencyMs || EXECUTION_CONFIG.latency.maxTotalMs;

    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // Get quote with timing
      this.latencyTracker.start('quote');
      const quote = await this.jupiterClient.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps || EXECUTION_CONFIG.jupiter.defaultSlippageBps,
      });
      const quoteUs = this.latencyTracker.end('quote');

      // Check if quote took too long
      if (quoteUs / 1000 > EXECUTION_CONFIG.latency.maxQuoteMs) {
        console.warn(`[FastExecution] Quote too slow: ${formatMicroseconds(quoteUs)}`);
      }

      // Check price impact
      const priceImpact = parseFloat(quote.priceImpactPct);
      if (priceImpact > EXECUTION_CONFIG.risk.maxPriceImpactPct * 100) {
        throw new Error(`Price impact too high: ${priceImpact}%`);
      }

      // Dry run - return quote without executing
      if (params.dryRun) {
        const totalUs = this.latencyTracker.end('total');
        return {
          success: true,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact,
          slippage: quote.slippageBps / 10000,
          fees: {
            priorityFeeLamports: 0,
            jitoTipLamports: 0,
            platformFeeBps: quote.platformFee?.feeBps || 0,
          },
          latency: {
            quoteUs,
            buildUs: 0,
            signUs: 0,
            submitUs: 0,
            confirmUs: 0,
            totalUs,
            timestamp: Date.now(),
          },
          simulated: true,
        };
      }

      // Get swap transaction
      this.latencyTracker.start('build');
      const swapResponse = await this.jupiterClient.getSwapTransaction({
        userPublicKey: signer.publicKey.toBase58(),
        quoteResponse: quote,
      });
      const buildUs = this.latencyTracker.end('build');

      // Sign transaction
      this.latencyTracker.start('sign');
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapResponse.swapTransaction, 'base64')
      );
      transaction.sign([signer]);
      const signUs = this.latencyTracker.end('sign');

      // Submit transaction
      this.latencyTracker.start('submit');
      let signature: string;
      let jitoTip = 0;

      if (params.useJito && EXECUTION_CONFIG.jito.enabled) {
        // Submit via JITO bundle
        jitoTip = params.jitoTipLamports || EXECUTION_CONFIG.jito.defaultTipLamports;
        const bundleResult = await this.jitoSubmitter.submitBundle([transaction], {
          tipLamports: jitoTip,
          waitForConfirmation: false, // Don't wait in hot path
        });
        signature = bundleResult.signature;
      } else {
        // Submit directly to RPC
        signature = await this.connectionPool.sendVersionedTransaction(transaction);
      }
      const submitUs = this.latencyTracker.end('submit');

      // Confirm transaction
      this.latencyTracker.start('confirm');
      const confirmation = await this.connectionPool.confirmTransaction(signature, 30_000);
      const confirmUs = this.latencyTracker.end('confirm');

      const totalUs = this.latencyTracker.end('total');

      // Log success
      console.log(
        `[FastExecution] Swap completed in ${formatMicroseconds(totalUs)}: ` +
          `${signature.slice(0, 20)}... ` +
          `(quote=${formatMicroseconds(quoteUs)}, submit=${formatMicroseconds(submitUs)})`
      );

      this.stats.successfulSwaps++;

      return {
        success: confirmation.confirmed,
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`,
        inputAmount: parseInt(quote.inAmount),
        outputAmount: parseInt(quote.outAmount),
        priceImpact,
        slippage: quote.slippageBps / 10000,
        fees: {
          priorityFeeLamports: swapResponse.prioritizationFeeLamports,
          jitoTipLamports: jitoTip,
          platformFeeBps: quote.platformFee?.feeBps || 0,
        },
        latency: {
          quoteUs,
          buildUs,
          signUs,
          submitUs,
          confirmUs,
          totalUs,
          slot: confirmation.slot,
          timestamp: Date.now(),
        },
        error: confirmation.err,
      };
    } catch (error) {
      const totalUs = this.latencyTracker.end('total');
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`[FastExecution] Swap failed in ${formatMicroseconds(totalUs)}:`, errorMsg);

      return {
        success: false,
        inputAmount: params.amount,
        outputAmount: 0,
        priceImpact: 0,
        slippage: 0,
        fees: {
          priorityFeeLamports: 0,
          jitoTipLamports: 0,
          platformFeeBps: 0,
        },
        latency: {
          quoteUs: 0,
          buildUs: 0,
          signUs: 0,
          submitUs: 0,
          confirmUs: 0,
          totalUs,
          timestamp: Date.now(),
        },
        error: errorMsg,
      };
    }
  }

  /**
   * Execute an arbitrage trade
   * Note: This is a simplified version - full implementation would need
   * platform-specific connectors for Polymarket/Kalshi
   */
  async executeArbitrage(params: ArbitrageParams, signer: Keypair): Promise<ArbitrageResult> {
    this.stats.totalArbitrages++;
    const startTime = Date.now();

    try {
      // For now, only DFlow-to-DFlow arbitrage is supported
      // This would need to be expanded with Polymarket/Kalshi connectors
      if (params.buyPlatform !== 'dflow' || params.sellPlatform !== 'dflow') {
        throw new Error('Only DFlow arbitrage currently supported');
      }

      console.log(
        `[FastExecution] Executing arbitrage: ` +
          `buy ${params.side} on ${params.buyPlatform}, sell on ${params.sellPlatform} ` +
          `for ${params.positionSizeUsd} USD (spread: ${params.spreadPct}%)`
      );

      // Calculate amounts based on position size
      const amountUsdc = params.positionSizeUsd * 1_000_000; // USDC has 6 decimals

      // TODO: Implement actual arbitrage execution
      // This would involve:
      // 1. Get DFlow market token mints
      // 2. Execute buy swap (USDC → YES/NO token)
      // 3. Execute sell swap (YES/NO token → USDC)
      // 4. Optionally bundle both in a JITO bundle for atomicity

      const executionTimeMs = Date.now() - startTime;

      // For now, return a placeholder result
      console.warn('[FastExecution] Arbitrage execution not fully implemented');

      return {
        success: false,
        profitUsd: 0,
        executionTimeMs,
        error: 'Arbitrage execution not fully implemented',
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error('[FastExecution] Arbitrage failed:', errorMsg);

      return {
        success: false,
        profitUsd: 0,
        executionTimeMs,
        error: errorMsg,
      };
    }
  }

  /**
   * Get current latency statistics
   */
  getLatencyStats(): Record<string, { avg: number; p50: number; p95: number; p99: number }> {
    const allStats = this.latencyTracker.getAllStats();
    const result: Record<string, { avg: number; p50: number; p95: number; p99: number }> = {};

    for (const [key, stats] of Object.entries(allStats)) {
      result[key] = {
        avg: stats.avg / 1000, // Convert to ms
        p50: stats.p50 / 1000,
        p95: stats.p95 / 1000,
        p99: stats.p99 / 1000,
      };
    }

    return result;
  }

  /**
   * Get engine statistics
   */
  getStats(): EngineStats {
    const latencyStats = this.latencyTracker.getStats('totalUs');

    return {
      initialized: this.initialized,
      totalSwaps: this.stats.totalSwaps,
      successfulSwaps: this.stats.successfulSwaps,
      totalArbitrages: this.stats.totalArbitrages,
      successfulArbitrages: this.stats.successfulArbitrages,
      avgLatencyMs: latencyStats.avg / 1000,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Check if engine is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.initialized) return false;
    return await this.connectionPool.isHealthy();
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    console.log('[FastExecution] Shutting down...');
    // Connection pool shutdown handled elsewhere
    this.initialized = false;
    console.log('[FastExecution] Shutdown complete');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalEngine: FastExecutionEngine | null = null;

export function getFastExecutionEngine(): FastExecutionEngine {
  if (!globalEngine) {
    globalEngine = new FastExecutionEngine();
  }
  return globalEngine;
}

export async function initializeFastExecution(): Promise<FastExecutionEngine> {
  const engine = getFastExecutionEngine();
  await engine.initialize();
  return engine;
}

export default FastExecutionEngine;
