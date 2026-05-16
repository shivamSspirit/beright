/**
 * Jupiter Integration for DFlow
 *
 * Smart routing through Jupiter for prediction market trades.
 * Compares Jupiter vs DFlow direct to find best execution.
 *
 * Features:
 * - Jupiter V6 Quote API
 * - Price comparison
 * - Jito MEV protection (optional)
 * - Route optimization
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from '@solana/web3.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Jupiter API endpoints
const JUPITER_QUOTE_API = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = `${JUPITER_QUOTE_API}/swap`;
const JUPITER_PRICE_API = 'https://price.jup.ag/v6';

// Jito MEV protection (optional)
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// Common token mints
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// =============================================================================
// TYPES
// =============================================================================

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlan[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterRoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

export interface JupiterPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;           // In atomic units (lamports)
  slippageBps?: number;     // Default 50 (0.5%)
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
  // MEV protection
  useJito?: boolean;
  jitoTipLamports?: number;
}

export interface JupiterSwapParams extends JupiterQuoteParams {
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  computeUnitPriceMicroLamports?: number | 'auto';
  prioritizationFeeLamports?: number | 'auto';
  dynamicComputeUnitLimit?: boolean;
}

export interface JupiterExecutionResult {
  success: boolean;
  signature?: string;
  error?: string;
  quote?: JupiterQuote;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  route: string[];
}

// =============================================================================
// JUPITER CLIENT
// =============================================================================

export class JupiterClient {
  private connection: Connection;
  private referralAccount?: string;
  private feeBps: number;

  constructor(connection: Connection, options?: {
    referralAccount?: string;
    feeBps?: number;
  }) {
    this.connection = connection;
    this.referralAccount = options?.referralAccount || process.env.JUPITER_REFERRAL_ACCOUNT;
    this.feeBps = options?.feeBps || parseInt(process.env.JUPITER_FEE_BPS || '0');
  }

  /**
   * Get a quote from Jupiter
   */
  async getQuote(params: JupiterQuoteParams): Promise<JupiterQuote | null> {
    try {
      const url = new URL(`${JUPITER_QUOTE_API}/quote`);
      url.searchParams.set('inputMint', params.inputMint);
      url.searchParams.set('outputMint', params.outputMint);
      url.searchParams.set('amount', params.amount.toString());
      url.searchParams.set('slippageBps', (params.slippageBps || 50).toString());

      if (params.onlyDirectRoutes) {
        url.searchParams.set('onlyDirectRoutes', 'true');
      }
      if (params.maxAccounts) {
        url.searchParams.set('maxAccounts', params.maxAccounts.toString());
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.text();
        console.error('[Jupiter] Quote error:', error);
        return null;
      }

      return await response.json() as JupiterQuote;
    } catch (error) {
      console.error('[Jupiter] Quote fetch failed:', error);
      return null;
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    options?: {
      wrapAndUnwrapSol?: boolean;
      computeUnitPriceMicroLamports?: number | 'auto';
      prioritizationFeeLamports?: number | 'auto';
      dynamicComputeUnitLimit?: boolean;
      useJito?: boolean;
      jitoTipLamports?: number;
    }
  ): Promise<JupiterSwapResponse | null> {
    try {
      const body: any = {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: options?.wrapAndUnwrapSol ?? true,
        dynamicComputeUnitLimit: options?.dynamicComputeUnitLimit ?? true,
      };

      // Add priority fee
      if (options?.prioritizationFeeLamports) {
        body.prioritizationFeeLamports = options.prioritizationFeeLamports;
      } else if (options?.computeUnitPriceMicroLamports) {
        body.computeUnitPriceMicroLamports = options.computeUnitPriceMicroLamports;
      }

      // Add referral if configured
      if (this.referralAccount && this.feeBps > 0) {
        body.feeAccount = this.referralAccount;
      }

      const response = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Jupiter] Swap transaction error:', error);
        return null;
      }

      const result = await response.json() as JupiterSwapResponse;

      return result;
    } catch (error) {
      console.error('[Jupiter] Swap transaction failed:', error);
      return null;
    }
  }

  /**
   * Execute a swap with signing
   */
  async executeSwap(
    params: JupiterSwapParams,
    keypair: Keypair
  ): Promise<JupiterExecutionResult> {
    try {
      // Get quote
      const quote = await this.getQuote(params);
      if (!quote) {
        return {
          success: false,
          error: 'Failed to get Jupiter quote',
          inputAmount: params.amount,
          outputAmount: 0,
          priceImpact: 0,
          route: [],
        };
      }

      // Get swap transaction
      const swapResponse = await this.getSwapTransaction(quote, params.userPublicKey, {
        wrapAndUnwrapSol: params.wrapAndUnwrapSol,
        computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
        prioritizationFeeLamports: params.prioritizationFeeLamports,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit,
        useJito: params.useJito,
        jitoTipLamports: params.jitoTipLamports,
      });

      if (!swapResponse) {
        return {
          success: false,
          error: 'Failed to get swap transaction',
          quote,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          route: quote.routePlan.map(r => r.swapInfo.label),
        };
      }

      // Decode and sign transaction
      const txBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([keypair]);

      // Submit transaction
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      // Wait for confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash();
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        return {
          success: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          signature,
          quote,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          route: quote.routePlan.map(r => r.swapInfo.label),
        };
      }

      return {
        success: true,
        signature,
        quote,
        inputAmount: parseInt(quote.inAmount),
        outputAmount: parseInt(quote.outAmount),
        priceImpact: parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(r => r.swapInfo.label),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        inputAmount: params.amount,
        outputAmount: 0,
        priceImpact: 0,
        route: [],
      };
    }
  }

  /**
   * Get token price from Jupiter Price API
   */
  async getPrice(tokenMint: string, vsToken: string = USDC_MINT): Promise<number | null> {
    try {
      const url = `${JUPITER_PRICE_API}/price?ids=${tokenMint}&vsToken=${vsToken}`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data?.[tokenMint]?.price || null;
    } catch (error) {
      console.error('[Jupiter] Price fetch failed:', error);
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(tokenMints: string[], vsToken: string = USDC_MINT): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      const ids = tokenMints.join(',');
      const url = `${JUPITER_PRICE_API}/price?ids=${ids}&vsToken=${vsToken}`;
      const response = await fetch(url);

      if (!response.ok) {
        return prices;
      }

      const data = await response.json();
      for (const mint of tokenMints) {
        if (data.data?.[mint]?.price) {
          prices.set(mint, data.data[mint].price);
        }
      }
    } catch (error) {
      console.error('[Jupiter] Prices fetch failed:', error);
    }

    return prices;
  }

  /**
   * Compare execution prices between input/output
   */
  calculateEffectivePrice(quote: JupiterQuote, inputDecimals: number = 6, outputDecimals: number = 6): {
    inputAmount: number;
    outputAmount: number;
    effectivePrice: number;
    priceImpact: number;
  } {
    const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
    const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
    const effectivePrice = inputAmount / outputAmount;
    const priceImpact = parseFloat(quote.priceImpactPct);

    return {
      inputAmount,
      outputAmount,
      effectivePrice,
      priceImpact,
    };
  }

  /**
   * Execute swap with Jito MEV protection
   * Sends transaction via Jito bundle for front-running protection
   */
  async executeWithJito(
    params: JupiterSwapParams,
    keypair: Keypair,
    jitoTipLamports: number = 10000 // 0.00001 SOL default tip
  ): Promise<JupiterExecutionResult> {
    try {
      // Get quote
      const quote = await this.getQuote(params);
      if (!quote) {
        return {
          success: false,
          error: 'Failed to get Jupiter quote',
          inputAmount: params.amount,
          outputAmount: 0,
          priceImpact: 0,
          route: [],
        };
      }

      // Get swap transaction
      const swapResponse = await this.getSwapTransaction(quote, params.userPublicKey, {
        wrapAndUnwrapSol: params.wrapAndUnwrapSol,
        computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
        prioritizationFeeLamports: params.prioritizationFeeLamports,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit,
      });

      if (!swapResponse) {
        return {
          success: false,
          error: 'Failed to get swap transaction',
          quote,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          route: quote.routePlan.map(r => r.swapInfo.label),
        };
      }

      // Decode and sign transaction
      const txBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([keypair]);

      // Send via Jito bundle
      const signature = await this.sendJitoBundle(transaction, jitoTipLamports, keypair);

      if (!signature) {
        // Fallback to regular submission
        console.log('[Jupiter] Jito bundle failed, falling back to regular submission');
        return this.executeSwap(params, keypair);
      }

      // Wait for confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash();
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        return {
          success: false,
          error: `Jito transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          signature,
          quote,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          route: quote.routePlan.map(r => r.swapInfo.label),
        };
      }

      return {
        success: true,
        signature,
        quote,
        inputAmount: parseInt(quote.inAmount),
        outputAmount: parseInt(quote.outAmount),
        priceImpact: parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(r => r.swapInfo.label),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Jito execution failed',
        inputAmount: params.amount,
        outputAmount: 0,
        priceImpact: 0,
        route: [],
      };
    }
  }

  /**
   * Send transaction via Jito bundle
   */
  private async sendJitoBundle(
    transaction: VersionedTransaction,
    tipLamports: number,
    keypair: Keypair
  ): Promise<string | null> {
    try {
      // Get a random Jito tip account
      const tipAccount = getRandomJitoTipAccount();

      // Create tip instruction
      const { SystemProgram, TransactionMessage, VersionedTransaction: VTx } = await import('@solana/web3.js');

      const tipInstruction = SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: tipAccount,
        lamports: tipLamports,
      });

      // Get recent blockhash
      const latestBlockhash = await this.connection.getLatestBlockhash();

      // Create tip transaction
      const tipMessage = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [tipInstruction],
      }).compileToV0Message();

      const tipTx = new VTx(tipMessage);
      tipTx.sign([keypair]);

      // Serialize both transactions for bundle
      const mainTxBase64 = Buffer.from(transaction.serialize()).toString('base64');
      const tipTxBase64 = Buffer.from(tipTx.serialize()).toString('base64');

      // Send to Jito block engine
      const jitoEndpoints = [
        'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
        'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
        'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
        'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
        'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
      ];

      // Try each endpoint
      for (const endpoint of jitoEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sendBundle',
              params: [[mainTxBase64, tipTxBase64]],
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.result) {
              console.log(`[Jupiter] Jito bundle accepted: ${result.result}`);

              // Get the main transaction signature
              const txSignatures = transaction.signatures;
              if (txSignatures.length > 0) {
                const signature = Buffer.from(txSignatures[0]).toString('base64');
                // Convert to base58 for standard signature format
                const bs58 = await import('bs58');
                return bs58.encode(txSignatures[0]);
              }
            }
          }
        } catch (e) {
          console.debug(`[Jupiter] Jito endpoint ${endpoint} failed:`, e);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('[Jupiter] Jito bundle creation failed:', error);
      return null;
    }
  }
}

// =============================================================================
// SINGLETON & HELPERS
// =============================================================================

let jupiterClient: JupiterClient | null = null;

export function getJupiterClient(connection?: Connection): JupiterClient {
  if (!jupiterClient && connection) {
    jupiterClient = new JupiterClient(connection);
  }
  if (!jupiterClient) {
    throw new Error('JupiterClient not initialized. Provide a Connection.');
  }
  return jupiterClient;
}

/**
 * Quick quote helper
 */
export async function getJupiterQuote(
  connection: Connection,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50
): Promise<JupiterQuote | null> {
  const client = new JupiterClient(connection);
  return client.getQuote({
    inputMint,
    outputMint,
    amount: amountLamports,
    slippageBps,
  });
}

/**
 * Get random Jito tip account
 */
export function getRandomJitoTipAccount(): PublicKey {
  const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return new PublicKey(JITO_TIP_ACCOUNTS[index]);
}
