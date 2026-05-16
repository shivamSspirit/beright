/**
 * Smart Order Router for DFlow
 *
 * Compares execution options between:
 * - DFlow direct (via Quote API)
 * - Jupiter aggregator
 *
 * Returns the best route based on price, slippage, and fees.
 *
 * @author BeRight Protocol
 */

import { Connection, Keypair } from '@solana/web3.js';
import { DFlowMarket, getDFlowClient, USDC_MINT } from '../dflow';
import { JupiterClient, JupiterQuote } from './jupiter';

// =============================================================================
// TYPES
// =============================================================================

export type RouteVenue = 'dflow' | 'jupiter';

export interface RouteQuote {
  venue: RouteVenue;
  inputAmount: number;      // USDC amount
  outputAmount: number;     // Outcome tokens received
  effectivePrice: number;   // Price per token
  slippage: number;         // Estimated slippage
  fees: number;             // Total fees
  priceImpact: number;      // Market impact
  route: string[];          // Route path labels
  transaction?: string;     // Base64 encoded tx (if available)
  confidence: number;       // 0-1 confidence in quote
}

export interface RoutingResult {
  recommended: RouteVenue;
  quotes: {
    dflow?: RouteQuote;
    jupiter?: RouteQuote;
  };
  savings: number;          // Savings vs worst option
  savingsPct: number;       // Savings as percentage
  reason: string;           // Why this route was chosen
}

export interface RoutingOptions {
  slippageBps?: number;     // Max slippage (default 50 = 0.5%)
  preferVenue?: RouteVenue; // Force a specific venue
  includeJupiter?: boolean; // Include Jupiter quotes (default true)
  minSavings?: number;      // Min savings to switch from default (default 0.01)
}

// =============================================================================
// SMART ORDER ROUTER
// =============================================================================

export class SmartOrderRouter {
  private connection: Connection;
  private jupiterClient: JupiterClient;

  constructor(connection: Connection) {
    this.connection = connection;
    this.jupiterClient = new JupiterClient(connection);
  }

  /**
   * Get best route for a prediction market trade
   */
  async getBestRoute(
    market: DFlowMarket,
    side: 'YES' | 'NO',
    amountUsdc: number,
    userPublicKey: string,
    options: RoutingOptions = {}
  ): Promise<RoutingResult> {
    const {
      slippageBps = 50,
      preferVenue,
      includeJupiter = true,
      minSavings = 0.01,
    } = options;

    // Get mint addresses
    const usdcAccount = market.accounts?.[USDC_MINT];
    if (!usdcAccount) {
      throw new Error('Market does not have USDC accounts configured');
    }

    const outputMint = side === 'YES' ? usdcAccount.yesMint : usdcAccount.noMint;
    const amountLamports = Math.floor(amountUsdc * 1_000_000); // USDC has 6 decimals

    // Get quotes in parallel
    const [dflowQuote, jupiterQuote] = await Promise.all([
      this.getDFlowQuote(market, side, amountUsdc, userPublicKey, slippageBps),
      includeJupiter
        ? this.getJupiterQuote(outputMint, amountLamports, userPublicKey, slippageBps)
        : Promise.resolve(null),
    ]);

    // Determine best route
    const quotes: RoutingResult['quotes'] = {};
    if (dflowQuote) quotes.dflow = dflowQuote;
    if (jupiterQuote) quotes.jupiter = jupiterQuote;

    // If venue is forced, use it
    if (preferVenue) {
      const forced = quotes[preferVenue];
      if (!forced) {
        throw new Error(`Preferred venue ${preferVenue} not available`);
      }
      return {
        recommended: preferVenue,
        quotes,
        savings: 0,
        savingsPct: 0,
        reason: `User preferred ${preferVenue}`,
      };
    }

    // Compare quotes
    return this.compareQuotes(quotes, minSavings);
  }

  /**
   * Get quote from DFlow direct
   */
  private async getDFlowQuote(
    market: DFlowMarket,
    side: 'YES' | 'NO',
    amountUsdc: number,
    userPublicKey: string,
    slippageBps: number
  ): Promise<RouteQuote | null> {
    try {
      // Get the output mint for the side
      const usdcAccount = market.accounts?.[USDC_MINT];
      if (!usdcAccount) {
        return null;
      }

      const outputMint = side === 'YES' ? usdcAccount.yesMint : usdcAccount.noMint;
      const amountLamports = Math.floor(amountUsdc * 1_000_000);

      // Get quote from DFlow
      const client = getDFlowClient();
      const result = await client.getOrder({
        inputMint: USDC_MINT,
        outputMint,
        amount: amountLamports,
        userPublicKey,
        slippageBps,
      });

      if (!result.transaction) {
        return null;
      }

      // Parse expected output from DFlow quote
      const outputAmount = parseInt(result.outAmount) / 1_000_000;
      const inputAmount = parseInt(result.inAmount) / 1_000_000;
      const effectivePrice = inputAmount / outputAmount;
      const priceImpact = parseFloat(result.priceImpactPct || '0');

      return {
        venue: 'dflow',
        inputAmount,
        outputAmount,
        effectivePrice,
        slippage: slippageBps / 10000,
        fees: 0, // DFlow fees are built into the quote
        priceImpact,
        route: ['DFlow Direct'],
        transaction: result.transaction,
        confidence: 0.95, // DFlow direct is highly reliable
      };
    } catch (error) {
      console.error('[SmartRouter] DFlow quote failed:', error);
      return null;
    }
  }

  /**
   * Get quote from Jupiter
   */
  private async getJupiterQuote(
    outputMint: string,
    amountLamports: number,
    userPublicKey: string,
    slippageBps: number
  ): Promise<RouteQuote | null> {
    try {
      const quote = await this.jupiterClient.getQuote({
        inputMint: USDC_MINT,
        outputMint,
        amount: amountLamports,
        slippageBps,
      });

      if (!quote) {
        return null;
      }

      const inputAmount = parseInt(quote.inAmount) / 1_000_000;
      const outputAmount = parseInt(quote.outAmount);
      const effectivePrice = inputAmount / outputAmount;

      // Get swap transaction
      const swapResponse = await this.jupiterClient.getSwapTransaction(
        quote,
        userPublicKey,
        { prioritizationFeeLamports: 'auto' }
      );

      return {
        venue: 'jupiter',
        inputAmount,
        outputAmount,
        effectivePrice,
        slippage: slippageBps / 10000,
        fees: 0, // Jupiter fees are built into the quote
        priceImpact: parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(r => r.swapInfo.label),
        transaction: swapResponse?.swapTransaction,
        confidence: 0.9, // Slightly lower due to multi-hop complexity
      };
    } catch (error) {
      console.error('[SmartRouter] Jupiter quote failed:', error);
      return null;
    }
  }

  /**
   * Compare quotes and select best route
   */
  private compareQuotes(
    quotes: RoutingResult['quotes'],
    minSavings: number
  ): RoutingResult {
    const dflow = quotes.dflow;
    const jupiter = quotes.jupiter;

    // If only one is available, use it
    if (!dflow && !jupiter) {
      throw new Error('No routes available');
    }

    if (!dflow) {
      return {
        recommended: 'jupiter',
        quotes,
        savings: 0,
        savingsPct: 0,
        reason: 'DFlow quote unavailable',
      };
    }

    if (!jupiter) {
      return {
        recommended: 'dflow',
        quotes,
        savings: 0,
        savingsPct: 0,
        reason: 'Jupiter quote unavailable',
      };
    }

    // Compare effective prices (lower is better for buyer)
    const dflowCost = dflow.inputAmount + dflow.fees;
    const jupiterCost = jupiter.inputAmount + jupiter.fees;

    const dflowValue = dflow.outputAmount;
    const jupiterValue = jupiter.outputAmount;

    // Calculate value per dollar spent
    const dflowEfficiency = dflowValue / dflowCost;
    const jupiterEfficiency = jupiterValue / jupiterCost;

    const savings = Math.abs(dflowEfficiency - jupiterEfficiency) * dflow.inputAmount;
    const savingsPct = Math.abs(dflowEfficiency - jupiterEfficiency) / Math.min(dflowEfficiency, jupiterEfficiency);

    // DFlow is default - only switch if savings are significant
    if (jupiterEfficiency > dflowEfficiency && savingsPct >= minSavings) {
      return {
        recommended: 'jupiter',
        quotes,
        savings,
        savingsPct,
        reason: `Jupiter offers ${(savingsPct * 100).toFixed(2)}% better execution`,
      };
    }

    // If DFlow is better or difference is negligible, use DFlow
    if (dflowEfficiency >= jupiterEfficiency) {
      return {
        recommended: 'dflow',
        quotes,
        savings: savingsPct >= minSavings ? savings : 0,
        savingsPct: savingsPct >= minSavings ? savingsPct : 0,
        reason: dflowEfficiency > jupiterEfficiency
          ? `DFlow offers ${(savingsPct * 100).toFixed(2)}% better execution`
          : 'DFlow matches Jupiter - using direct route',
      };
    }

    // Default to DFlow (lower complexity, more reliable)
    return {
      recommended: 'dflow',
      quotes,
      savings: 0,
      savingsPct: 0,
      reason: 'DFlow direct route preferred (savings below threshold)',
    };
  }

  /**
   * Execute trade via best route
   */
  async executeViaBestRoute(
    market: DFlowMarket,
    side: 'YES' | 'NO',
    amountUsdc: number,
    keypair: Keypair,
    options: RoutingOptions = {}
  ): Promise<{
    success: boolean;
    signature?: string;
    route: RouteVenue;
    quote: RouteQuote;
    error?: string;
  }> {
    const userPublicKey = keypair.publicKey.toBase58();

    // Get best route
    const routing = await this.getBestRoute(
      market,
      side,
      amountUsdc,
      userPublicKey,
      options
    );

    const quote = routing.quotes[routing.recommended];
    if (!quote) {
      return {
        success: false,
        route: routing.recommended,
        quote: {} as RouteQuote,
        error: 'No quote available for recommended route',
      };
    }

    console.log(`[SmartRouter] Using ${routing.recommended}: ${routing.reason}`);

    try {
      if (routing.recommended === 'jupiter' && quote.transaction) {
        // Execute via Jupiter
        const { JupiterClient } = await import('./jupiter');
        const jupClient = new JupiterClient(this.connection);

        // Decode, sign, and submit
        const txBuffer = Buffer.from(quote.transaction, 'base64');
        const { VersionedTransaction } = await import('@solana/web3.js');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([keypair]);

        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        // Wait for confirmation
        const latestBlockhash = await this.connection.getLatestBlockhash();
        await this.connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 'confirmed');

        return {
          success: true,
          signature,
          route: 'jupiter',
          quote,
        };
      } else if (quote.transaction) {
        // Execute via DFlow
        const txBuffer = Buffer.from(quote.transaction, 'base64');
        const { VersionedTransaction } = await import('@solana/web3.js');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([keypair]);

        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        const latestBlockhash = await this.connection.getLatestBlockhash();
        await this.connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 'confirmed');

        return {
          success: true,
          signature,
          route: 'dflow',
          quote,
        };
      } else {
        return {
          success: false,
          route: routing.recommended,
          quote,
          error: 'No transaction available in quote',
        };
      }
    } catch (error) {
      return {
        success: false,
        route: routing.recommended,
        quote,
        error: error instanceof Error ? error.message : 'Unknown execution error',
      };
    }
  }
}

// =============================================================================
// SINGLETON & HELPERS
// =============================================================================

let routerInstance: SmartOrderRouter | null = null;

export function getSmartRouter(connection?: Connection): SmartOrderRouter {
  if (!routerInstance && connection) {
    routerInstance = new SmartOrderRouter(connection);
  }
  if (!routerInstance) {
    throw new Error('SmartOrderRouter not initialized. Provide a Connection.');
  }
  return routerInstance;
}

/**
 * Quick helper to get best route
 */
export async function findBestRoute(
  connection: Connection,
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  userPublicKey: string,
  options?: RoutingOptions
): Promise<RoutingResult> {
  const router = new SmartOrderRouter(connection);
  return router.getBestRoute(market, side, amountUsdc, userPublicKey, options);
}

/**
 * Quick helper to execute via best route
 */
export async function executeSmartTrade(
  connection: Connection,
  market: DFlowMarket,
  side: 'YES' | 'NO',
  amountUsdc: number,
  keypair: Keypair,
  options?: RoutingOptions
): Promise<{
  success: boolean;
  signature?: string;
  route: RouteVenue;
  error?: string;
}> {
  const router = new SmartOrderRouter(connection);
  const result = await router.executeViaBestRoute(market, side, amountUsdc, keypair, options);
  return {
    success: result.success,
    signature: result.signature,
    route: result.route,
    error: result.error,
  };
}
