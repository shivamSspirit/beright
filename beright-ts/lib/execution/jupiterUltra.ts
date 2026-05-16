/**
 * Jupiter Ultra API Client - Fastest Swap Execution
 *
 * Jupiter Ultra provides:
 * - Pre-computed optimal routes
 * - Built-in priority fee estimation
 * - Lower latency endpoints
 * - Fallback to standard V6 API
 *
 * @author BeRight Protocol
 */

import { VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';
import { EXECUTION_CONFIG } from '../../config/execution';
import { getLatencyTracker, formatMicroseconds } from './latencyTracker';
import { getFastConnectionPool } from './fastConnection';
import { getJitoBundleSubmitter } from './jitoBundle';
import bs58 from 'bs58';

// ============================================================================
// TYPES
// ============================================================================

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number;
  maxAccounts?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label?: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapParams {
  userPublicKey: string;
  quoteResponse: JupiterQuoteResponse;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number | 'auto';
  prioritizationFeeLamports?: number | 'auto';
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType?: {
    computeBudget?: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
}

export interface JupiterExecutionResult {
  success: boolean;
  signature?: string;
  inputAmount: number;
  outputAmount: number;
  priceImpactPct: number;
  fees: {
    priorityFeeLamports: number;
    platformFeeLamports: number;
    jitoTipLamports: number;
  };
  latency: {
    quoteUs: number;
    swapTxUs: number;
    submitUs: number;
    totalUs: number;
  };
  error?: string;
  route?: string;
}

// ============================================================================
// JUPITER ULTRA CLIENT
// ============================================================================

export class JupiterUltraClient {
  private v6ApiUrl: string;
  private ultraApiUrl: string;
  private preferUltra: boolean;
  private referralAccount?: string;
  private feeBps: number;

  constructor() {
    this.v6ApiUrl = EXECUTION_CONFIG.jupiter.v6ApiUrl;
    this.ultraApiUrl = EXECUTION_CONFIG.jupiter.ultraApiUrl;
    this.preferUltra = EXECUTION_CONFIG.jupiter.preferUltra;
    this.referralAccount = EXECUTION_CONFIG.jupiter.referralAccount;
    this.feeBps = EXECUTION_CONFIG.jupiter.feeBps;
  }

  /**
   * Get quote from Jupiter (tries Ultra first, falls back to V6)
   */
  async getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
    const tracker = getLatencyTracker();
    tracker.start('jupiter_quote');

    const slippageBps = params.slippageBps || EXECUTION_CONFIG.jupiter.defaultSlippageBps;

    // Build query params
    const queryParams = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    if (params.onlyDirectRoutes) {
      queryParams.set('onlyDirectRoutes', 'true');
    }
    if (params.platformFeeBps || this.feeBps) {
      queryParams.set('platformFeeBps', (params.platformFeeBps || this.feeBps).toString());
    }
    if (params.maxAccounts) {
      queryParams.set('maxAccounts', params.maxAccounts.toString());
    }

    // Try Ultra API first
    if (this.preferUltra) {
      try {
        const ultraResponse = await this.fetchWithTimeout(
          `${this.ultraApiUrl}/quote?${queryParams}`,
          { method: 'GET' },
          EXECUTION_CONFIG.jupiter.quoteTimeoutMs
        );

        if (ultraResponse.ok) {
          const quote = await ultraResponse.json();
          const elapsed = tracker.end('jupiter_quote');
          console.log(
            `[JupiterUltra] Quote in ${formatMicroseconds(elapsed)}: ` +
              `${params.inputMint.slice(0, 8)}→${params.outputMint.slice(0, 8)} ` +
              `impact=${quote.priceImpactPct}%`
          );
          return quote;
        }
      } catch (error) {
        console.warn('[JupiterUltra] Ultra API failed, falling back to V6:', error);
      }
    }

    // Fallback to V6 API
    const response = await this.fetchWithTimeout(
      `${this.v6ApiUrl}/quote?${queryParams}`,
      { method: 'GET' },
      EXECUTION_CONFIG.jupiter.quoteTimeoutMs
    );

    if (!response.ok) {
      tracker.end('jupiter_quote');
      const errorText = await response.text();
      throw new Error(`Jupiter quote failed: ${response.status} ${errorText}`);
    }

    const quote = await response.json();
    const elapsed = tracker.end('jupiter_quote');

    console.log(
      `[Jupiter V6] Quote in ${formatMicroseconds(elapsed)}: ` +
        `${params.inputMint.slice(0, 8)}→${params.outputMint.slice(0, 8)} ` +
        `impact=${quote.priceImpactPct}%`
    );

    return quote;
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getSwapTransaction(params: JupiterSwapParams): Promise<JupiterSwapResponse> {
    const tracker = getLatencyTracker();
    tracker.start('jupiter_swap_tx');

    const body = {
      userPublicKey: params.userPublicKey,
      quoteResponse: params.quoteResponse,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      useSharedAccounts: params.useSharedAccounts ?? true,
      dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
      skipUserAccountsRpcCalls: params.skipUserAccountsRpcCalls ?? true,
      prioritizationFeeLamports: params.prioritizationFeeLamports ?? 'auto',
    };

    if (this.referralAccount) {
      Object.assign(body, { feeAccount: this.referralAccount });
    }

    const response = await fetch(`${this.v6ApiUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      tracker.end('jupiter_swap_tx');
      const errorText = await response.text();
      throw new Error(`Jupiter swap tx failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const elapsed = tracker.end('jupiter_swap_tx');

    console.log(
      `[Jupiter] Swap TX built in ${formatMicroseconds(elapsed)}: ` +
        `CU=${result.computeUnitLimit}, priority=${result.prioritizationFeeLamports}L`
    );

    return result;
  }

  /**
   * Execute a swap (quote → swap tx → sign → submit)
   */
  async executeSwap(
    params: JupiterQuoteParams,
    signer: Keypair,
    options: {
      useJito?: boolean;
      jitoTipLamports?: number;
    } = {}
  ): Promise<JupiterExecutionResult> {
    const tracker = getLatencyTracker();
    tracker.start('jupiter_total');

    try {
      // 1. Get quote
      const { result: quote, microseconds: quoteUs } = await tracker.measure(
        'quote',
        () => this.getQuote(params)
      );

      // 2. Get swap transaction
      const { result: swapResponse, microseconds: swapTxUs } = await tracker.measure(
        'swap_tx',
        () =>
          this.getSwapTransaction({
            userPublicKey: signer.publicKey.toBase58(),
            quoteResponse: quote,
          })
      );

      // 3. Deserialize and sign transaction
      const swapTransaction = VersionedTransaction.deserialize(
        Buffer.from(swapResponse.swapTransaction, 'base64')
      );
      swapTransaction.sign([signer]);

      // 4. Submit transaction
      let submitUs: number;
      let signature: string;

      if (options.useJito) {
        // Submit via JITO bundle
        const jitoSubmitter = getJitoBundleSubmitter();
        const { result: bundleResult, microseconds } = await tracker.measure('submit', () =>
          jitoSubmitter.submitBundle([swapTransaction], {
            tipLamports: options.jitoTipLamports,
            waitForConfirmation: true,
          })
        );
        submitUs = microseconds;
        signature = bundleResult.signature;

        if (bundleResult.status === 'failed') {
          throw new Error(`JITO bundle failed: ${bundleResult.error}`);
        }
      } else {
        // Submit directly
        const pool = getFastConnectionPool();
        const { result: sig, microseconds } = await tracker.measure('submit', () =>
          pool.sendVersionedTransaction(swapTransaction)
        );
        submitUs = microseconds;
        signature = sig;
      }

      const totalUs = tracker.end('jupiter_total');

      console.log(
        `[Jupiter] Swap executed in ${formatMicroseconds(totalUs)}: ${signature.slice(0, 20)}...`
      );

      return {
        success: true,
        signature,
        inputAmount: parseInt(quote.inAmount),
        outputAmount: parseInt(quote.outAmount),
        priceImpactPct: parseFloat(quote.priceImpactPct),
        fees: {
          priorityFeeLamports: swapResponse.prioritizationFeeLamports,
          platformFeeLamports: quote.platformFee ? parseInt(quote.platformFee.amount) : 0,
          jitoTipLamports: options.jitoTipLamports || 0,
        },
        latency: {
          quoteUs,
          swapTxUs,
          submitUs,
          totalUs,
        },
        route: quote.routePlan.map((r) => r.swapInfo.label || r.swapInfo.ammKey.slice(0, 8)).join(' → '),
      };
    } catch (error) {
      const totalUs = tracker.end('jupiter_total');
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error('[Jupiter] Swap failed:', errorMsg);

      return {
        success: false,
        inputAmount: params.amount,
        outputAmount: 0,
        priceImpactPct: 0,
        fees: {
          priorityFeeLamports: 0,
          platformFeeLamports: 0,
          jitoTipLamports: 0,
        },
        latency: {
          quoteUs: 0,
          swapTxUs: 0,
          submitUs: 0,
          totalUs,
        },
        error: errorMsg,
      };
    }
  }

  /**
   * Get token price in USD
   */
  async getPrice(tokenMint: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.v6ApiUrl}/price?ids=${tokenMint}&vsToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` // gitleaks:allow public USDC mint
      );

      if (!response.ok) {
        return 0;
      }

      const result = await response.json();
      return result.data?.[tokenMint]?.price || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(tokenMints: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      const ids = tokenMints.join(',');
      const response = await fetch(
        `${this.v6ApiUrl}/price?ids=${ids}&vsToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` // gitleaks:allow public USDC mint
      );

      if (!response.ok) {
        return prices;
      }

      const result = await response.json();

      for (const mint of tokenMints) {
        prices.set(mint, result.data?.[mint]?.price || 0);
      }
    } catch {
      // Return empty map on error
    }

    return prices;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalClient: JupiterUltraClient | null = null;

export function getJupiterUltraClient(): JupiterUltraClient {
  if (!globalClient) {
    globalClient = new JupiterUltraClient();
  }
  return globalClient;
}

export default JupiterUltraClient;
