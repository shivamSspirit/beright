/**
 * DFlow Transaction Executor
 *
 * Handles transaction signing, submission, and confirmation for DFlow trades.
 * Extracted from skills/dflowTrade.ts for reusability across:
 * - Telegram bot trading
 * - Terminal/Web trading
 * - Autonomous agents
 *
 * Now with fast execution support:
 * - Connection pooling with keep-alive
 * - Pre-fetched blockhash
 * - JITO bundle submission
 * - Microsecond latency tracking
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionConfirmationStrategy,
  Commitment,
} from '@solana/web3.js';
import { getDFlowClient, USDC_MINT, DFlowMarket, DFlowOrderResponse, getBuilderCodeConfig } from '../dflow';
import { getFastConnectionPool, initializeFastConnection } from '../execution/fastConnection';
import { getJitoBundleSubmitter } from '../execution/jitoBundle';
import { getLatencyTracker, formatMicroseconds } from '../execution/latencyTracker';
import { EXECUTION_CONFIG } from '../../config/execution';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_RPC = process.env.HELIUS_RPC_MAINNET
  || process.env.SOLANA_RPC_URL
  || 'https://api.mainnet-beta.solana.com';

const DEFAULT_SLIPPAGE_BPS = 100; // 1%
const DEFAULT_PRIORITY_FEE = 50000; // 50k lamports
const CONFIRMATION_TIMEOUT_MS = 60000; // 60 seconds

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutorConfig {
  rpcUrl?: string;
  commitment?: Commitment;
  skipPreflight?: boolean;
  maxRetries?: number;
  // Fast execution options
  useFastConnection?: boolean;
  useJito?: boolean;
  jitoTipLamports?: number;
  trackLatency?: boolean;
}

export type ExecutionMode = 'standard' | 'fast' | 'jito';

export interface FastExecutionResult extends ExecutionResult {
  latency?: {
    quoteMs: number;
    signMs: number;
    submitMs: number;
    confirmMs: number;
    totalMs: number;
  };
  jitoBundle?: {
    bundleId: string;
    tipLamports: number;
  };
}

export interface TradeParams {
  market: DFlowMarket;
  side: 'YES' | 'NO';
  amountUsdc: number; // Amount in USDC (not lamports)
  slippageBps?: number;
  priorityFeeLamports?: number;
}

export interface ExecutionResult {
  success: boolean;
  signature?: string;
  error?: string;
  details?: {
    inputAmount: string;
    outputAmount: string;
    priceImpact: string;
    executionMode: string;
    confirmedAt?: Date;
  };
}

export interface QuoteResult {
  success: boolean;
  quote?: DFlowOrderResponse;
  error?: string;
  expectedShares?: number;
  effectivePrice?: number;
  priceImpact?: number;
}

// =============================================================================
// DFLOW EXECUTOR
// =============================================================================

export class DFlowExecutor {
  private connection: Connection;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig = {}) {
    this.config = {
      rpcUrl: config.rpcUrl || DEFAULT_RPC,
      commitment: config.commitment || 'confirmed',
      skipPreflight: config.skipPreflight ?? false,
      maxRetries: config.maxRetries ?? 3,
    };
    this.connection = new Connection(this.config.rpcUrl!, this.config.commitment);
  }

  /**
   * Get the RPC connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get a quote for a trade without executing
   * Automatically includes Kalshi Builder Code fees if configured
   */
  async getQuote(
    params: TradeParams,
    walletAddress: string
  ): Promise<QuoteResult> {
    try {
      const { market, side, amountUsdc, slippageBps } = params;

      // Get the output mint based on side
      const outputMint = this.getOutputMint(market, side);
      if (!outputMint) {
        return {
          success: false,
          error: `Market ${market.ticker} not initialized for ${side} trading`,
        };
      }

      // Convert USDC to atomic units (6 decimals)
      const amountLamports = Math.floor(amountUsdc * 1e6);

      // Get Builder Code config for fee collection
      const builderConfig = getBuilderCodeConfig();

      // Get quote from DFlow
      const client = getDFlowClient();

      // Build order params
      const orderParams: Parameters<typeof client.getOrder>[0] = {
        inputMint: USDC_MINT,
        outputMint,
        amount: amountLamports,
        userPublicKey: walletAddress,
        slippageBps: slippageBps || DEFAULT_SLIPPAGE_BPS,
      };

      // Add Builder Code fee parameters if enabled
      if (builderConfig.enabled && builderConfig.feeAccount) {
        orderParams.platformFeeBps = builderConfig.platformFeeBps;
        orderParams.platformFeeScale = builderConfig.platformFeeScale;
        orderParams.feeAccount = builderConfig.feeAccount;
      }

      const quote = await client.getOrder(orderParams);

      // Calculate expected output
      const expectedShares = parseInt(quote.outAmount) / 1e6;
      const effectivePrice = amountUsdc / expectedShares;
      const priceImpact = parseFloat(quote.priceImpactPct);

      return {
        success: true,
        quote,
        expectedShares,
        effectivePrice,
        priceImpact,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get quote',
      };
    }
  }

  /**
   * Execute a trade with a Keypair wallet
   */
  async executeWithKeypair(
    params: TradeParams,
    keypair: Keypair
  ): Promise<ExecutionResult> {
    try {
      // Get quote
      const quoteResult = await this.getQuote(params, keypair.publicKey.toBase58());
      if (!quoteResult.success || !quoteResult.quote) {
        return {
          success: false,
          error: quoteResult.error || 'Failed to get quote',
        };
      }

      const { quote } = quoteResult;

      // Check if transaction is available
      if (!quote.transaction) {
        return {
          success: false,
          error: 'No transaction returned from DFlow API',
        };
      }

      // Decode transaction
      const txBuffer = Buffer.from(quote.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Sign transaction
      transaction.sign([keypair]);

      // Submit transaction
      const signature = await this.submitTransaction(transaction);
      if (!signature) {
        return {
          success: false,
          error: 'Failed to submit transaction',
        };
      }

      // Wait for confirmation
      const confirmed = await this.confirmTransaction(signature);

      return {
        success: confirmed,
        signature,
        error: confirmed ? undefined : 'Transaction not confirmed',
        details: {
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
          executionMode: quote.executionMode,
          confirmedAt: confirmed ? new Date() : undefined,
        },
      };
    } catch (error) {
      console.error('[DFlowExecutor] Execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  /**
   * Execute a trade with fast execution mode
   * Uses connection pooling, JITO bundles, and latency tracking
   */
  async executeFast(
    params: TradeParams,
    keypair: Keypair,
    options: {
      useJito?: boolean;
      jitoTipLamports?: number;
      trackLatency?: boolean;
    } = {}
  ): Promise<FastExecutionResult> {
    const tracker = getLatencyTracker();
    const trackLatency = options.trackLatency ?? true;

    if (trackLatency) {
      tracker.reset();
      tracker.start('total');
    }

    try {
      // Initialize fast connection pool if needed
      const pool = getFastConnectionPool();
      if (!pool.getStats().isInitialized) {
        await initializeFastConnection();
      }

      // Get quote with timing
      if (trackLatency) tracker.start('quote');
      const quoteResult = await this.getQuote(params, keypair.publicKey.toBase58());
      const quoteUs = trackLatency ? tracker.end('quote') : 0;

      if (!quoteResult.success || !quoteResult.quote) {
        if (trackLatency) tracker.end('total');
        return {
          success: false,
          error: quoteResult.error || 'Failed to get quote',
        };
      }

      const { quote } = quoteResult;

      if (!quote.transaction) {
        if (trackLatency) tracker.end('total');
        return {
          success: false,
          error: 'No transaction returned from DFlow API',
        };
      }

      // Decode and sign transaction with timing
      if (trackLatency) tracker.start('sign');
      const txBuffer = Buffer.from(quote.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([keypair]);
      const signUs = trackLatency ? tracker.end('sign') : 0;

      // Submit transaction with timing
      if (trackLatency) tracker.start('submit');
      let signature: string;
      let jitoBundle: { bundleId: string; tipLamports: number } | undefined;

      if (options.useJito && EXECUTION_CONFIG.jito.enabled) {
        // Submit via JITO bundle
        const jitoSubmitter = getJitoBundleSubmitter();
        const tipLamports = options.jitoTipLamports || EXECUTION_CONFIG.jito.defaultTipLamports;

        const bundleResult = await jitoSubmitter.submitBundle([transaction], {
          tipLamports,
          waitForConfirmation: false,
        });

        signature = bundleResult.signature;
        jitoBundle = {
          bundleId: bundleResult.bundleId,
          tipLamports,
        };

        console.log(`[DFlowExecutor] JITO bundle submitted: ${bundleResult.bundleId}`);
      } else {
        // Submit via fast connection pool (skipPreflight for speed)
        signature = await pool.sendVersionedTransaction(transaction, {
          skipPreflight: true,
          preflightCommitment: this.config.commitment,
          maxRetries: 0,
        });
      }
      const submitUs = trackLatency ? tracker.end('submit') : 0;

      console.log(`[DFlowExecutor] Fast TX submitted: ${signature.slice(0, 20)}...`);

      // Confirm transaction with timing
      if (trackLatency) tracker.start('confirm');
      const confirmation = await pool.confirmTransaction(signature, 30_000);
      const confirmUs = trackLatency ? tracker.end('confirm') : 0;
      const totalUs = trackLatency ? tracker.end('total') : 0;

      console.log(
        `[DFlowExecutor] Fast execution: ` +
          `quote=${formatMicroseconds(quoteUs)}, ` +
          `sign=${formatMicroseconds(signUs)}, ` +
          `submit=${formatMicroseconds(submitUs)}, ` +
          `confirm=${formatMicroseconds(confirmUs)}, ` +
          `total=${formatMicroseconds(totalUs)}`
      );

      return {
        success: confirmation.confirmed,
        signature,
        error: confirmation.confirmed ? undefined : (confirmation.err || 'Transaction not confirmed'),
        details: {
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
          executionMode: options.useJito ? 'fast:jito' : 'fast:direct',
          confirmedAt: confirmation.confirmed ? new Date() : undefined,
        },
        latency: trackLatency ? {
          quoteMs: quoteUs / 1000,
          signMs: signUs / 1000,
          submitMs: submitUs / 1000,
          confirmMs: confirmUs / 1000,
          totalMs: totalUs / 1000,
        } : undefined,
        jitoBundle,
      };
    } catch (error) {
      if (trackLatency) tracker.end('total');
      console.error('[DFlowExecutor] Fast execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fast execution failed',
      };
    }
  }

  /**
   * Execute a trade with a pre-signed transaction
   * Use this when the wallet signs on the client side (browser)
   */
  async executePreSigned(
    signedTransaction: VersionedTransaction
  ): Promise<ExecutionResult> {
    try {
      const signature = await this.submitTransaction(signedTransaction);
      if (!signature) {
        return {
          success: false,
          error: 'Failed to submit transaction',
        };
      }

      const confirmed = await this.confirmTransaction(signature);

      return {
        success: confirmed,
        signature,
        error: confirmed ? undefined : 'Transaction not confirmed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  /**
   * Submit a signed transaction to the network
   */
  private async submitTransaction(
    transaction: VersionedTransaction
  ): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (this.config.maxRetries || 3); attempt++) {
      try {
        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: this.config.skipPreflight,
          preflightCommitment: this.config.commitment,
          maxRetries: 2,
        });

        console.log(`[DFlowExecutor] Transaction submitted: ${signature}`);
        return signature;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[DFlowExecutor] Submit attempt ${attempt + 1} failed:`, lastError.message);

        // Wait before retry
        if (attempt < (this.config.maxRetries || 3) - 1) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    console.error('[DFlowExecutor] All submit attempts failed:', lastError);
    return null;
  }

  /**
   * Wait for transaction confirmation
   */
  async confirmTransaction(
    signature: string,
    timeout: number = CONFIRMATION_TIMEOUT_MS
  ): Promise<boolean> {
    try {
      const latestBlockhash = await this.connection.getLatestBlockhash();

      const strategy: TransactionConfirmationStrategy = {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      };

      const confirmation = await this.connection.confirmTransaction(
        strategy,
        this.config.commitment
      );

      if (confirmation.value.err) {
        console.error('[DFlowExecutor] Transaction failed:', confirmation.value.err);
        return false;
      }

      console.log(`[DFlowExecutor] Transaction confirmed: ${signature}`);
      return true;
    } catch (error) {
      console.error('[DFlowExecutor] Confirmation failed:', error);
      return false;
    }
  }

  /**
   * Check order status via DFlow API
   */
  async checkOrderStatus(signature: string): Promise<{
    status: string;
    inAmount: string;
    outAmount: string;
    fills?: any[];
  } | null> {
    try {
      const client = getDFlowClient();
      const status = await client.getOrderStatus(signature);
      return status;
    } catch (error) {
      console.error('[DFlowExecutor] Status check failed:', error);
      return null;
    }
  }

  /**
   * Get the output mint address for a trade
   */
  private getOutputMint(market: DFlowMarket, side: 'YES' | 'NO'): string | null {
    const usdcAccount = market.accounts?.[USDC_MINT];
    if (!usdcAccount?.isInitialized) {
      return null;
    }

    return side === 'YES' ? usdcAccount.yesMint : usdcAccount.noMint;
  }

  /**
   * Get the input mint (outcome token) for selling
   */
  private getInputMint(market: DFlowMarket, side: 'YES' | 'NO'): string | null {
    const usdcAccount = market.accounts?.[USDC_MINT];
    if (!usdcAccount?.isInitialized) {
      return null;
    }

    return side === 'YES' ? usdcAccount.yesMint : usdcAccount.noMint;
  }

  /**
   * Sell outcome tokens back to USDC
   */
  async sellWithKeypair(
    market: DFlowMarket,
    side: 'YES' | 'NO',
    shares: number, // Number of outcome tokens to sell
    keypair: Keypair,
    slippageBps?: number
  ): Promise<ExecutionResult> {
    try {
      const inputMint = this.getInputMint(market, side);
      if (!inputMint) {
        return {
          success: false,
          error: `Market ${market.ticker} not initialized for selling`,
        };
      }

      // Convert shares to atomic units (6 decimals for outcome tokens)
      const amountLamports = Math.floor(shares * 1e6);

      // Get quote for selling (outcome token -> USDC)
      const client = getDFlowClient();
      const quote = await client.getOrder({
        inputMint,
        outputMint: USDC_MINT,
        amount: amountLamports,
        userPublicKey: keypair.publicKey.toBase58(),
        slippageBps: slippageBps || DEFAULT_SLIPPAGE_BPS,
      });

      if (!quote.transaction) {
        return {
          success: false,
          error: 'No transaction returned for sell order',
        };
      }

      // Decode and sign
      const txBuffer = Buffer.from(quote.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([keypair]);

      // Submit
      const signature = await this.submitTransaction(transaction);
      if (!signature) {
        return {
          success: false,
          error: 'Failed to submit sell transaction',
        };
      }

      // Confirm
      const confirmed = await this.confirmTransaction(signature);

      return {
        success: confirmed,
        signature,
        error: confirmed ? undefined : 'Sell transaction not confirmed',
        details: {
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
          executionMode: quote.executionMode,
          confirmedAt: confirmed ? new Date() : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sell failed',
      };
    }
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// SINGLETON & CONVENIENCE FUNCTIONS
// =============================================================================

let executorInstance: DFlowExecutor | null = null;

export function getDFlowExecutor(config?: ExecutorConfig): DFlowExecutor {
  if (!executorInstance || config) {
    executorInstance = new DFlowExecutor(config);
  }
  return executorInstance;
}

/**
 * Quick trade execution with Keypair
 */
export async function executeDFlowTrade(
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  keypair: Keypair,
  options?: {
    slippageBps?: number;
    rpcUrl?: string;
  }
): Promise<ExecutionResult> {
  const executor = getDFlowExecutor(options?.rpcUrl ? { rpcUrl: options.rpcUrl } : undefined);
  return executor.executeWithKeypair(
    {
      market,
      side,
      amountUsdc,
      slippageBps: options?.slippageBps,
    },
    keypair
  );
}

/**
 * Quick quote without execution
 */
export async function getDFlowQuote(
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  walletAddress: string,
  slippageBps?: number
): Promise<QuoteResult> {
  const executor = getDFlowExecutor();
  return executor.getQuote(
    { market, side, amountUsdc, slippageBps },
    walletAddress
  );
}

/**
 * Fast trade execution with connection pooling and JITO
 * Target: Millisecond execution times
 */
export async function executeFastDFlowTrade(
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  keypair: Keypair,
  options?: {
    slippageBps?: number;
    useJito?: boolean;
    jitoTipLamports?: number;
  }
): Promise<FastExecutionResult> {
  const executor = getDFlowExecutor();
  return executor.executeFast(
    {
      market,
      side,
      amountUsdc,
      slippageBps: options?.slippageBps,
    },
    keypair,
    {
      useJito: options?.useJito,
      jitoTipLamports: options?.jitoTipLamports,
      trackLatency: true,
    }
  );
}

// =============================================================================
// SMART ROUTING INTEGRATION
// =============================================================================

import { SmartOrderRouter, RoutingResult, RoutingOptions, RouteVenue } from './router';

export interface SmartExecutionResult extends ExecutionResult {
  route?: RouteVenue;
  routingInfo?: RoutingResult;
}

/**
 * Execute trade with smart routing (compares DFlow direct vs Jupiter)
 *
 * This function:
 * 1. Gets quotes from both DFlow and Jupiter
 * 2. Compares prices and selects best route
 * 3. Executes via the optimal path
 */
export async function executeSmartTrade(
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  keypair: Keypair,
  options?: {
    slippageBps?: number;
    rpcUrl?: string;
    useSmartRouting?: boolean;  // Default true
    preferVenue?: RouteVenue;   // Force specific venue
    includeJupiter?: boolean;   // Include Jupiter comparison (default true)
  }
): Promise<SmartExecutionResult> {
  const useSmartRouting = options?.useSmartRouting ?? true;

  // If smart routing disabled, use direct DFlow
  if (!useSmartRouting) {
    const result = await executeDFlowTrade(market, side, amountUsdc, keypair, options);
    return {
      ...result,
      route: 'dflow',
    };
  }

  // Use smart router
  const executor = getDFlowExecutor(options?.rpcUrl ? { rpcUrl: options.rpcUrl } : undefined);
  const connection = executor.getConnection();
  const router = new SmartOrderRouter(connection);

  const routingOptions: RoutingOptions = {
    slippageBps: options?.slippageBps,
    preferVenue: options?.preferVenue,
    includeJupiter: options?.includeJupiter ?? true,
  };

  try {
    // Get best route
    const routingResult = await router.getBestRoute(
      market,
      side,
      amountUsdc,
      keypair.publicKey.toBase58(),
      routingOptions
    );

    console.log(`[SmartExecution] Route: ${routingResult.recommended} - ${routingResult.reason}`);

    // Execute via best route
    const execResult = await router.executeViaBestRoute(
      market,
      side,
      amountUsdc,
      keypair,
      routingOptions
    );

    return {
      success: execResult.success,
      signature: execResult.signature,
      error: execResult.error,
      route: execResult.route,
      routingInfo: routingResult,
      details: execResult.quote ? {
        inputAmount: execResult.quote.inputAmount.toString(),
        outputAmount: execResult.quote.outputAmount.toString(),
        priceImpact: (execResult.quote.priceImpact * 100).toFixed(2) + '%',
        executionMode: `smart:${execResult.route}`,
        confirmedAt: execResult.success ? new Date() : undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('[SmartExecution] Failed:', error);

    // Fallback to direct DFlow
    console.log('[SmartExecution] Falling back to direct DFlow');
    const result = await executeDFlowTrade(market, side, amountUsdc, keypair, options);
    return {
      ...result,
      route: 'dflow',
    };
  }
}

/**
 * Get routing comparison without executing
 */
export async function getSmartQuote(
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  walletAddress: string,
  options?: {
    slippageBps?: number;
    rpcUrl?: string;
    includeJupiter?: boolean;
  }
): Promise<RoutingResult> {
  const executor = getDFlowExecutor(options?.rpcUrl ? { rpcUrl: options.rpcUrl } : undefined);
  const connection = executor.getConnection();
  const router = new SmartOrderRouter(connection);

  return router.getBestRoute(
    market,
    side,
    amountUsdc,
    walletAddress,
    {
      slippageBps: options?.slippageBps,
      includeJupiter: options?.includeJupiter ?? true,
    }
  );
}
