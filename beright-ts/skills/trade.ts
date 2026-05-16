/**
 * Prediction Market Trading Skill for BeRight Protocol
 * Trade tokenized Kalshi markets via Jupiter + DFlow
 * Includes Builder Code tracking for grant metrics
 */

import { SkillResponse, Market } from '../types/index';
import { SOLANA, TOKENS } from '../config/platforms';
import { formatUsd, formatPct, timestamp } from './utils';
import { getQuote, executeSwap } from './swap';
import { getSigner, canSign } from '../lib/signer';
import { secrets } from '../lib/secrets';
import * as fs from 'fs';
import * as path from 'path';

// DFlow API for market data
const DFLOW_API = 'https://dev-prediction-markets-api.dflow.net/api/v1';

// Jupiter Lite API (free, no auth)
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_API = 'https://lite-api.jup.ag/swap/v1/swap';

// USDC mint on Solana
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Builder Code for Kalshi grant tracking
const BUILDER_CODE = process.env.KALSHI_BUILDER_CODE || 'BERIGHT_PROTOCOL';

// ============================================
// TYPES
// ============================================

interface PredictionToken {
  ticker: string;
  title: string;
  yesMint: string | null;
  noMint: string | null;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  marketLedger: string | null;
}

interface TradeRecord {
  id: string;
  timestamp: string;
  builderCode: string;
  marketTicker: string;
  marketTitle: string;
  direction: 'YES' | 'NO';
  action: 'BUY' | 'SELL';
  inputToken: string;
  inputAmount: number;
  outputToken: string;
  outputAmount: number;
  priceImpact: number;
  txSignature: string;
  volumeUsd: number;
  status: 'pending' | 'confirmed' | 'failed';
}

interface VolumeMetrics {
  totalVolumeUsd: number;
  totalTrades: number;
  uniqueMarkets: number;
  byDay: Record<string, number>;
  byMarket: Record<string, number>;
}

// ============================================
// DFLOW MARKET DATA
// ============================================

/**
 * Get prediction token info from DFlow
 */
export async function getPredictionToken(marketTicker: string): Promise<PredictionToken | null> {
  try {
    const url = `${DFLOW_API}/events?limit=50&withNestedMarkets=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const data = await response.json() as { events: any[] };

    for (const event of data.events || []) {
      for (const market of event.markets || []) {
        if (market.ticker === marketTicker || market.eventTicker === marketTicker) {
          const accounts = market.accounts || {};
          const usdcAccount = accounts[USDC_MINT] || {};

          return {
            ticker: market.ticker,
            title: market.title || event.title,
            yesMint: usdcAccount.yesMint || null,
            noMint: usdcAccount.noMint || null,
            yesPrice: parseFloat(market.yesAsk) || 0,
            noPrice: parseFloat(market.noAsk) || 0,
            volume24h: event.volume24h || 0,
            marketLedger: usdcAccount.marketLedger || null,
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get prediction token:', error);
    return null;
  }
}

/**
 * Search for prediction tokens by keyword
 */
export async function searchPredictionTokens(query: string): Promise<PredictionToken[]> {
  try {
    const url = `${DFLOW_API}/events?limit=30&withNestedMarkets=true&sort=volume24h`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];

    const data = await response.json() as { events: any[] };
    const tokens: PredictionToken[] = [];
    const queryLower = query.toLowerCase();

    for (const event of data.events || []) {
      if (!(event.title || '').toLowerCase().includes(queryLower)) continue;

      for (const market of event.markets || []) {
        const accounts = market.accounts || {};
        const usdcAccount = accounts[USDC_MINT] || {};

        if (usdcAccount.yesMint) {
          tokens.push({
            ticker: market.ticker,
            title: market.title || event.title,
            yesMint: usdcAccount.yesMint,
            noMint: usdcAccount.noMint || null,
            yesPrice: parseFloat(market.yesAsk) || 0,
            noPrice: parseFloat(market.noAsk) || 0,
            volume24h: event.volume24h || 0,
            marketLedger: usdcAccount.marketLedger || null,
          });
        }
      }
    }

    return tokens.slice(0, 10);
  } catch (error) {
    console.error('Failed to search prediction tokens:', error);
    return [];
  }
}

// ============================================
// JUPITER TRADING
// ============================================

/**
 * Get quote for buying YES or NO tokens
 */
export async function getTradeQuote(
  marketTicker: string,
  direction: 'YES' | 'NO',
  usdcAmount: number
): Promise<{ quote: any; token: PredictionToken } | null> {
  const token = await getPredictionToken(marketTicker);
  if (!token) {
    console.error(`Market not found: ${marketTicker}`);
    return null;
  }

  const outputMint = direction === 'YES' ? token.yesMint : token.noMint;
  if (!outputMint) {
    console.error(`No ${direction} token mint for ${marketTicker}`);
    return null;
  }

  // Get Jupiter quote
  const amountLamports = Math.floor(usdcAmount * 1e6); // USDC has 6 decimals
  const url = `${JUPITER_QUOTE_API}?inputMint=${USDC_MINT}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      // Token might not have liquidity on Jupiter yet
      return { quote: null, token };
    }
    const quote = await response.json();
    return { quote, token };
  } catch (error) {
    console.error('Jupiter quote error:', error);
    return { quote: null, token };
  }
}

/**
 * Execute trade for prediction tokens
 */
export async function executePredictionTrade(
  marketTicker: string,
  direction: 'YES' | 'NO',
  usdcAmount: number,
  dryRun = true
): Promise<TradeRecord> {
  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const quoteResult = await getTradeQuote(marketTicker, direction, usdcAmount);

  if (!quoteResult) {
    return {
      id: tradeId,
      timestamp: timestamp(),
      builderCode: BUILDER_CODE,
      marketTicker,
      marketTitle: 'Unknown',
      direction,
      action: 'BUY',
      inputToken: 'USDC',
      inputAmount: usdcAmount,
      outputToken: `${marketTicker}-${direction}`,
      outputAmount: 0,
      priceImpact: 0,
      txSignature: '',
      volumeUsd: usdcAmount,
      status: 'failed',
    };
  }

  const { quote, token } = quoteResult;

  // If no Jupiter liquidity, calculate theoretical output based on price
  let outputAmount = 0;
  let priceImpact = 0;

  if (quote && quote.outAmount) {
    outputAmount = parseInt(quote.outAmount) / 1e6; // Assuming 6 decimals
    priceImpact = parseFloat(quote.priceImpactPct) || 0;
  } else {
    // Theoretical: USDC amount / token price
    const price = direction === 'YES' ? token.yesPrice : token.noPrice;
    outputAmount = price > 0 ? usdcAmount / price : 0;
  }

  const trade: TradeRecord = {
    id: tradeId,
    timestamp: timestamp(),
    builderCode: BUILDER_CODE,
    marketTicker: token.ticker,
    marketTitle: token.title,
    direction,
    action: 'BUY',
    inputToken: 'USDC',
    inputAmount: usdcAmount,
    outputToken: `${token.ticker}-${direction}`,
    outputAmount,
    priceImpact,
    txSignature: dryRun ? 'DRY_RUN' : '',
    volumeUsd: usdcAmount,
    status: dryRun ? 'pending' : 'pending',
  };

  // Log trade for Builder Code tracking
  logTradeRecord(trade);

  // Execute real trade if not dry run
  if (!dryRun && canSign() && quote) {
    try {
      // Execute via Jupiter using secure signer
      const { VersionedTransaction } = await import('@solana/web3.js');
      const signer = getSigner();
      const publicKey = signer.getPublicKey();

      const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });

      if (swapResponse.ok) {
        const swapData = await swapResponse.json() as any;
        const swapTxBuf = Buffer.from(swapData.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTxBuf);

        // Use signer abstraction for secure signing
        const result = await signer.signAndSendVersionedTransaction(transaction);

        trade.txSignature = result.signature;
        trade.status = 'confirmed';
        updateTradeRecord(trade);
      }
    } catch (error) {
      trade.status = 'failed';
      updateTradeRecord(trade);
      console.error('Trade execution failed:', error);
    }
  }

  return trade;
}

// ============================================
// BUILDER CODE TRACKING
// ============================================

const TRADES_FILE = path.join(process.cwd(), 'memory', 'prediction-trades.json');
const VOLUME_FILE = path.join(process.cwd(), 'memory', 'builder-volume.json');

/**
 * Log trade record for Builder Code tracking
 */
function logTradeRecord(trade: TradeRecord): void {
  try {
    let trades: TradeRecord[] = [];
    if (fs.existsSync(TRADES_FILE)) {
      trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'));
    }
    trades.push(trade);
    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));

    // Update volume metrics
    updateVolumeMetrics(trade);
  } catch (error) {
    console.error('Failed to log trade:', error);
  }
}

/**
 * Update trade record
 */
function updateTradeRecord(trade: TradeRecord): void {
  try {
    let trades: TradeRecord[] = [];
    if (fs.existsSync(TRADES_FILE)) {
      trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'));
    }
    const index = trades.findIndex(t => t.id === trade.id);
    if (index >= 0) {
      trades[index] = trade;
      fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
    }
  } catch (error) {
    console.error('Failed to update trade:', error);
  }
}

/**
 * Update volume metrics for Builder Code
 */
function updateVolumeMetrics(trade: TradeRecord): void {
  try {
    let metrics: VolumeMetrics = {
      totalVolumeUsd: 0,
      totalTrades: 0,
      uniqueMarkets: 0,
      byDay: {},
      byMarket: {},
    };

    if (fs.existsSync(VOLUME_FILE)) {
      metrics = JSON.parse(fs.readFileSync(VOLUME_FILE, 'utf-8'));
    }

    // Update totals
    metrics.totalVolumeUsd += trade.volumeUsd;
    metrics.totalTrades += 1;

    // Update by day
    const day = trade.timestamp.slice(0, 10); // YYYY-MM-DD
    metrics.byDay[day] = (metrics.byDay[day] || 0) + trade.volumeUsd;

    // Update by market
    metrics.byMarket[trade.marketTicker] = (metrics.byMarket[trade.marketTicker] || 0) + trade.volumeUsd;
    metrics.uniqueMarkets = Object.keys(metrics.byMarket).length;

    fs.writeFileSync(VOLUME_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('Failed to update volume metrics:', error);
  }
}

/**
 * Get volume metrics for grant reporting
 */
export function getVolumeMetrics(): VolumeMetrics {
  try {
    if (fs.existsSync(VOLUME_FILE)) {
      return JSON.parse(fs.readFileSync(VOLUME_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to get volume metrics:', error);
  }
  return {
    totalVolumeUsd: 0,
    totalTrades: 0,
    uniqueMarkets: 0,
    byDay: {},
    byMarket: {},
  };
}

/**
 * Get all trade records
 */
export function getTradeRecords(): TradeRecord[] {
  try {
    if (fs.existsSync(TRADES_FILE)) {
      return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to get trades:', error);
  }
  return [];
}

// ============================================
// LP OPPORTUNITY DETECTION
// ============================================

interface LPOpportunity {
  market: string;
  title: string;
  yesMint: string;
  noMint: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  estimatedApy: number;
  pools: {
    dex: string;
    pair: string;
    tvl: number;
    apr: number;
  }[];
}

/**
 * Scan for LP opportunities on prediction tokens
 * Checks Raydium, Orca, and Meteora for existing pools
 */
export async function scanLPOpportunities(): Promise<LPOpportunity[]> {
  const opportunities: LPOpportunity[] = [];

  try {
    // Get more prediction tokens to find LP opportunities
    const url = `${DFLOW_API}/events?limit=50&withNestedMarkets=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const data = await response.json() as { events: any[] };

    for (const event of data.events || []) {
      for (const market of event.markets || []) {
        const accounts = market.accounts || {};
        const usdcAccount = accounts[USDC_MINT] || {};

        if (!usdcAccount.yesMint) continue;

        const yesBid = parseFloat(market.yesBid) || 0;
        const yesAsk = parseFloat(market.yesAsk) || 0;

        // Skip markets without active orderbook
        if (yesBid <= 0 || yesAsk <= 0) continue;

        const spread = yesAsk - yesBid;

        // Only consider markets with meaningful spread (LP opportunity)
        // Even small spreads can be profitable with volume
        if (spread < 0.005) continue;

        // Estimate APY from spread (simplified - actual depends on volume)
        // If spread is 1% and trades happen daily, that's ~365% APY
        // Adjust for realistic fill rate (~10% of spread captured)
        const estimatedApy = spread * 365 * 100 * 0.1;

        opportunities.push({
          market: market.ticker,
          title: market.title || event.title,
          yesMint: usdcAccount.yesMint,
          noMint: usdcAccount.noMint || '',
          yesPrice: (yesBid + yesAsk) / 2,
          noPrice: 1 - ((yesBid + yesAsk) / 2),
          spread,
          volume24h: event.volume24h || market.volume || 0,
          estimatedApy,
          pools: [], // Would be populated by checking DEX APIs
        });
      }
    }

    // Sort by estimated APY
    return opportunities.sort((a, b) => b.estimatedApy - a.estimatedApy).slice(0, 15);
  } catch (error) {
    console.error('Failed to scan LP opportunities:', error);
    return [];
  }
}

/**
 * Check for existing LP pools for a prediction token
 */
export async function checkExistingPools(tokenMint: string): Promise<any[]> {
  const pools: any[] = [];

  try {
    // Check Jupiter for routes (indicates liquidity exists)
    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${USDC_MINT}&outputMint=${tokenMint}&amount=1000000&slippageBps=100`;
    const response = await fetch(quoteUrl, { signal: AbortSignal.timeout(5000) });

    if (response.ok) {
      const quote = await response.json() as any;
      if (quote.routePlan) {
        for (const route of quote.routePlan) {
          pools.push({
            dex: route.swapInfo?.label || 'Unknown',
            ammKey: route.swapInfo?.ammKey,
            hasLiquidity: true,
          });
        }
      }
    }
  } catch (error) {
    // Token might not have liquidity yet
  }

  return pools;
}

// ============================================
// SKILL FUNCTIONS
// ============================================

/**
 * Trade prediction market tokens
 */
export async function tradePrediction(
  marketTicker: string,
  direction: 'YES' | 'NO',
  usdcAmount: number,
  execute = false
): Promise<SkillResponse> {
  const trade = await executePredictionTrade(marketTicker, direction, usdcAmount, !execute);

  if (trade.status === 'failed') {
    return {
      text: `
❌ TRADE FAILED

Market: ${marketTicker}
Direction: ${direction}
Amount: $${usdcAmount}

Could not find market or no liquidity available.
Use /markets search to find valid market tickers.
`,
      mood: 'ERROR',
      data: trade,
    };
  }

  const statusEmoji = trade.status === 'confirmed' ? '✅' : '📝';
  const statusText = trade.status === 'confirmed' ? 'EXECUTED' : 'QUOTE (DRY RUN)';

  return {
    text: `
${statusEmoji} PREDICTION TRADE ${statusText}
${'='.repeat(50)}

MARKET: ${trade.marketTitle}
TICKER: ${trade.marketTicker}
DIRECTION: ${trade.direction}

INPUT:  ${trade.inputAmount.toFixed(2)} USDC
OUTPUT: ${trade.outputAmount.toFixed(4)} ${trade.direction} tokens

PRICE IMPACT: ${(trade.priceImpact * 100).toFixed(2)}%
${trade.txSignature && trade.txSignature !== 'DRY_RUN'
  ? `TX: https://solscan.io/tx/${trade.txSignature}`
  : ''}

BUILDER CODE: ${BUILDER_CODE}
VOLUME TRACKED: $${trade.volumeUsd.toFixed(2)}

${trade.status !== 'confirmed' ? '⚠️ Run with --execute to submit real transaction' : ''}
`,
    mood: trade.status === 'confirmed' ? 'BULLISH' : 'NEUTRAL',
    data: trade,
  };
}

/**
 * Show volume metrics for grant reporting
 */
export async function showVolumeMetrics(): Promise<SkillResponse> {
  const metrics = getVolumeMetrics();
  const trades = getTradeRecords();

  // Recent trades (last 10)
  const recentTrades = trades.slice(-10).reverse();

  let tradesList = '';
  for (const t of recentTrades) {
    tradesList += `  ${t.timestamp.slice(0, 16)} | ${t.marketTicker.slice(0, 20).padEnd(20)} | ${t.direction} | $${t.volumeUsd.toFixed(0)}\n`;
  }

  return {
    text: `
📊 BUILDER CODE VOLUME METRICS
${'='.repeat(50)}

BUILDER CODE: ${BUILDER_CODE}

TOTALS
  Volume:  $${formatUsd(metrics.totalVolumeUsd)}
  Trades:  ${metrics.totalTrades}
  Markets: ${metrics.uniqueMarkets}

TOP MARKETS BY VOLUME
${Object.entries(metrics.byMarket)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([market, vol]) => `  ${market.slice(0, 30).padEnd(30)} $${formatUsd(vol)}`)
  .join('\n')}

RECENT TRADES
${tradesList || '  No trades yet'}

💡 This data is tracked for Kalshi's $2M Builder Grant program.
   Volume driven through BeRight = grant eligibility.
`,
    mood: 'EDUCATIONAL',
    data: metrics,
  };
}

/**
 * Show LP opportunities
 */
export async function showLPOpportunities(): Promise<SkillResponse> {
  const opportunities = await scanLPOpportunities();

  if (opportunities.length === 0) {
    return {
      text: `
📈 LP OPPORTUNITIES

No prediction token LP opportunities found.
This could mean:
• Tokens don't have DEX liquidity yet (opportunity to be first!)
• Markets are very efficient (low spread)
`,
      mood: 'NEUTRAL',
    };
  }

  let list = '';
  for (const opp of opportunities.slice(0, 8)) {
    list += `
${opp.title.slice(0, 50)}
  Spread: ${(opp.spread * 100).toFixed(1)}% | Est APY: ${opp.estimatedApy.toFixed(0)}%
  24h Vol: $${formatUsd(opp.volume24h)}
  YES Mint: ${opp.yesMint.slice(0, 20)}...
`;
  }

  return {
    text: `
📈 LP OPPORTUNITIES (Prediction Tokens)
${'='.repeat(50)}

TOP OPPORTUNITIES BY ESTIMATED APY:
${list}

💡 HOW TO LP:
1. These tokens are SPL tokens on Solana
2. Create pool on Raydium/Orca: TOKEN/USDC
3. Earn fees from spread + trading volume
4. Risk: Token goes to 0 or 1 on resolution

⚠️ RISKS:
• Impermanent loss on resolution
• Low liquidity (you ARE the liquidity)
• Market could resolve any time
`,
    mood: 'EDUCATIONAL',
    data: opportunities,
  };
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('trade.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'buy' && args[1] && args[2] && args[3]) {
      const [, ticker, direction, amount] = args;
      const execute = args.includes('--execute');
      const result = await tradePrediction(
        ticker,
        direction.toUpperCase() as 'YES' | 'NO',
        parseFloat(amount),
        execute
      );
      console.log(result.text);
    } else if (command === 'search' && args[1]) {
      const query = args.slice(1).join(' ');
      const tokens = await searchPredictionTokens(query);
      console.log('\nPrediction Tokens Found:\n');
      for (const t of tokens) {
        console.log(`${t.ticker}`);
        console.log(`  ${t.title.slice(0, 60)}`);
        console.log(`  YES: ${(t.yesPrice * 100).toFixed(1)}% | NO: ${(t.noPrice * 100).toFixed(1)}%`);
        console.log(`  24h Vol: $${formatUsd(t.volume24h)}`);
        console.log(`  YES Mint: ${t.yesMint || 'N/A'}`);
        console.log();
      }
    } else if (command === 'volume') {
      const result = await showVolumeMetrics();
      console.log(result.text);
    } else if (command === 'lp') {
      const result = await showLPOpportunities();
      console.log(result.text);
    } else {
      console.log(`
BeRight Prediction Market Trading

Usage:
  npx ts-node trade.ts buy <ticker> <YES|NO> <usdc_amount> [--execute]
  npx ts-node trade.ts search <query>
  npx ts-node trade.ts volume
  npx ts-node trade.ts lp

Examples:
  npx ts-node trade.ts search "president"
  npx ts-node trade.ts buy KXSB-26-NE YES 10
  npx ts-node trade.ts buy KXSB-26-NE YES 10 --execute
  npx ts-node trade.ts volume
  npx ts-node trade.ts lp

Builder Code: ${BUILDER_CODE}
`);
    }
  })();
}
