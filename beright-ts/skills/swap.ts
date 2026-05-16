/**
 * Jupiter Swap Skill for BeRight Protocol
 * On-chain token swaps via Jupiter V6 API
 */

import { SkillResponse, Trade } from '../types/index';
import { SOLANA, TOKENS } from '../config/platforms';
import { formatUsd, timestamp } from './utils';
import * as fs from 'fs';
import * as path from 'path';

// Jupiter API endpoints (using lite API - no auth required)
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_API = 'https://lite-api.jup.ag/swap/v1/swap';

// Common token mints
const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

interface SwapResult {
  success: boolean;
  txSignature?: string;
  inputAmount: number;
  outputAmount: number;
  inputToken: string;
  outputToken: string;
  priceImpact: number;
  error?: string;
}

/**
 * Resolve token symbol to mint address
 */
function resolveToken(token: string): string {
  const upper = token.toUpperCase();
  return TOKEN_MINTS[upper] || token;
}

/**
 * Get decimals for common tokens
 */
function getDecimals(mint: string): number {
  if (mint === TOKEN_MINTS.SOL) return 9;
  if (mint === TOKEN_MINTS.USDC || mint === TOKEN_MINTS.USDT) return 6;
  if (mint === TOKEN_MINTS.BONK) return 5;
  return 9; // Default to 9 decimals
}

/**
 * Get a quote from Jupiter
 */
export async function getQuote(
  inputToken: string,
  outputToken: string,
  amount: number,
  slippageBps = 50 // 0.5% default
): Promise<JupiterQuote | null> {
  const inputMint = resolveToken(inputToken);
  const outputMint = resolveToken(outputToken);
  const decimals = getDecimals(inputMint);
  const amountLamports = Math.floor(amount * Math.pow(10, decimals));

  const url = new URL(JUPITER_QUOTE_API);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', amountLamports.toString());
  url.searchParams.set('slippageBps', slippageBps.toString());

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`Jupiter quote error: ${response.status}`);
      return null;
    }
    return await response.json() as JupiterQuote;
  } catch (error) {
    console.error('Jupiter quote fetch error:', error);
    return null;
  }
}

/**
 * Format quote for display
 */
function formatQuote(
  quote: JupiterQuote,
  inputToken: string,
  outputToken: string
): string {
  const inputDecimals = getDecimals(quote.inputMint);
  const outputDecimals = getDecimals(quote.outputMint);

  const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
  const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
  const priceImpact = parseFloat(quote.priceImpactPct);
  const rate = outputAmount / inputAmount;

  return `
💱 SWAP QUOTE
${'='.repeat(40)}

FROM: ${inputAmount.toFixed(6)} ${inputToken.toUpperCase()}
TO:   ${outputAmount.toFixed(6)} ${outputToken.toUpperCase()}

RATE: 1 ${inputToken.toUpperCase()} = ${rate.toFixed(6)} ${outputToken.toUpperCase()}
PRICE IMPACT: ${(priceImpact * 100).toFixed(3)}%
ROUTE STEPS: ${quote.routePlan?.length || 1}

${priceImpact > 0.01 ? '⚠️ High price impact! Consider smaller trade.' : '✅ Price impact acceptable'}
`;
}

/**
 * Execute a swap (requires wallet private key)
 * NOTE: This is a simulation - actual execution requires signing
 */
export async function executeSwap(
  inputToken: string,
  outputToken: string,
  amount: number,
  slippageBps = 50,
  walletAddress?: string
): Promise<SwapResult> {
  // Get quote first
  const quote = await getQuote(inputToken, outputToken, amount, slippageBps);

  if (!quote) {
    return {
      success: false,
      inputAmount: amount,
      outputAmount: 0,
      inputToken,
      outputToken,
      priceImpact: 0,
      error: 'Failed to get quote from Jupiter',
    };
  }

  const inputDecimals = getDecimals(quote.inputMint);
  const outputDecimals = getDecimals(quote.outputMint);
  const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
  const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
  const priceImpact = parseFloat(quote.priceImpactPct);

  // Check if we have a wallet configured
  const privateKey = process.env.SOLANA_PRIVATE_KEY;

  if (!privateKey) {
    // Quote-only mode — no wallet configured for execution
    // Log the quote as a pending trade for tracking
    const trade: Trade = {
      id: `quote_${Date.now()}`,
      type: 'BUY',
      market: `${inputToken}/${outputToken}`,
      platform: 'jupiter',
      direction: 'YES',
      size: outputAmount,
      price: inputAmount / outputAmount,
      totalUsd: inputAmount,
      fee: inputAmount * 0.0025,
      slippage: priceImpact,
      txSignature: 'QUOTE_ONLY',
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    logTrade(trade);

    return {
      success: true,
      txSignature: 'QUOTE_ONLY',
      inputAmount,
      outputAmount,
      inputToken,
      outputToken,
      priceImpact,
    };
  }

  // Execute real swap with wallet signing
  try {
    const { Keypair, Transaction, VersionedTransaction, Connection } = await import('@solana/web3.js');

    const wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(privateKey))
    );

    // Get swap transaction from Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapResponse.ok) {
      return {
        success: false,
        inputAmount,
        outputAmount,
        inputToken,
        outputToken,
        priceImpact,
        error: `Jupiter swap API error: ${swapResponse.status}`,
      };
    }

    const swapData = await swapResponse.json() as any;
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    const connection = new Connection(
      process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    transaction.sign([wallet]);
    const txSignature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(txSignature, 'confirmed');

    // Log the real trade
    const trade: Trade = {
      id: `tx_${Date.now()}`,
      type: 'BUY',
      market: `${inputToken}/${outputToken}`,
      platform: 'jupiter',
      direction: 'YES',
      size: outputAmount,
      price: inputAmount / outputAmount,
      totalUsd: inputAmount,
      fee: inputAmount * 0.0025,
      slippage: priceImpact,
      txSignature,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    logTrade(trade);

    return {
      success: true,
      txSignature,
      inputAmount,
      outputAmount,
      inputToken,
      outputToken,
      priceImpact,
    };
  } catch (error) {
    return {
      success: false,
      inputAmount,
      outputAmount,
      inputToken,
      outputToken,
      priceImpact,
      error: `Swap execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Log trade to memory file
 */
function logTrade(trade: Trade): void {
  try {
    const tradesFile = path.join(process.cwd(), 'memory', 'trades.json');
    let trades: Trade[] = [];

    if (fs.existsSync(tradesFile)) {
      trades = JSON.parse(fs.readFileSync(tradesFile, 'utf-8'));
    }

    trades.push(trade);
    fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
  } catch (error) {
    console.error('Failed to log trade:', error);
  }
}

/**
 * Get trade history
 */
export function getTradeHistory(): Trade[] {
  try {
    const tradesFile = path.join(process.cwd(), 'memory', 'trades.json');
    if (fs.existsSync(tradesFile)) {
      return JSON.parse(fs.readFileSync(tradesFile, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load trade history:', error);
  }
  return [];
}

/**
 * Main swap skill function - get quote only
 */
export async function swap(
  inputToken: string,
  outputToken: string,
  amount: number
): Promise<SkillResponse> {
  try {
    const quote = await getQuote(inputToken, outputToken, amount);

    if (!quote) {
      return {
        text: `
❌ SWAP FAILED

Could not get quote for ${inputToken} → ${outputToken}

Possible reasons:
• Invalid token symbol
• Insufficient liquidity
• Jupiter API unavailable

Try again with common tokens: SOL, USDC, BONK, JUP, WIF
`,
        mood: 'ERROR',
      };
    }

    const text = formatQuote(quote, inputToken, outputToken);

    return {
      text: text + `
💡 TO EXECUTE:
Run with --execute flag or call executeSwap()
Requires SOLANA_PRIVATE_KEY in .env
`,
      mood: 'NEUTRAL',
      data: quote,
    };
  } catch (error) {
    return {
      text: `Swap error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Execute swap skill function
 */
export async function swapExecute(
  inputToken: string,
  outputToken: string,
  amount: number
): Promise<SkillResponse> {
  try {
    const result = await executeSwap(inputToken, outputToken, amount);

    if (!result.success) {
      return {
        text: `
❌ SWAP EXECUTION FAILED

${result.error}

Input: ${result.inputAmount} ${inputToken}
`,
        mood: 'ERROR',
        data: result,
      };
    }

    return {
      text: `
✅ SWAP ${result.txSignature === 'QUOTE_ONLY' ? 'QUOTED' : 'EXECUTED'}
${'='.repeat(40)}

FROM: ${result.inputAmount.toFixed(6)} ${inputToken.toUpperCase()}
TO:   ${result.outputAmount.toFixed(6)} ${outputToken.toUpperCase()}

PRICE IMPACT: ${(result.priceImpact * 100).toFixed(3)}%
TX: ${result.txSignature}

${result.txSignature === 'QUOTE_ONLY'
  ? '⚠️ This was a simulation. Set SOLANA_PRIVATE_KEY to execute real trades.'
  : '🔗 View on Solscan: https://solscan.io/tx/' + result.txSignature}
`,
      mood: result.txSignature === 'QUOTE_ONLY' ? 'NEUTRAL' : 'BULLISH',
      data: result,
    };
  } catch (error) {
    return {
      text: `Swap execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('swap.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'quote' && args[1] && args[2] && args[3]) {
      const [, inputToken, outputToken, amount] = args;
      console.log(`Getting quote: ${amount} ${inputToken} → ${outputToken}`);
      const result = await swap(inputToken, outputToken, parseFloat(amount));
      console.log(result.text);
    } else if (command === 'execute' && args[1] && args[2] && args[3]) {
      const [, inputToken, outputToken, amount] = args;
      console.log(`Executing swap: ${amount} ${inputToken} → ${outputToken}`);
      const result = await swapExecute(inputToken, outputToken, parseFloat(amount));
      console.log(result.text);
    } else if (command === 'history') {
      const trades = getTradeHistory();
      console.log('Trade History:');
      trades.forEach((t, i) => {
        console.log(`${i + 1}. ${t.timestamp} | ${t.market} | ${t.size} @ ${t.price} | ${t.status}`);
      });
    } else {
      console.log('Usage:');
      console.log('  npx ts-node swap.ts quote <inputToken> <outputToken> <amount>');
      console.log('  npx ts-node swap.ts execute <inputToken> <outputToken> <amount>');
      console.log('  npx ts-node swap.ts history');
      console.log('');
      console.log('Examples:');
      console.log('  npx ts-node swap.ts quote SOL USDC 1');
      console.log('  npx ts-node swap.ts quote USDC BONK 100');
    }
  })();
}
