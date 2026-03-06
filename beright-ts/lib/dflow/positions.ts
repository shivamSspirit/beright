/**
 * DFlow Position Tracking
 *
 * Track on-chain positions by scanning wallet token accounts
 * and matching outcome tokens to DFlow markets.
 *
 * @author BeRight Protocol
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  getDFlowClient,
  filterDFlowOutcomeMints,
  batchGetDFlowMarkets,
  getDFlowMarketByMint,
  DFlowMarket,
  USDC_MINT,
} from '../dflow';
import { getAllTokenAccounts, getWalletBalance, WalletBalance } from './wallet';

// =============================================================================
// TYPES
// =============================================================================

export interface DFlowPosition {
  // Market info
  marketTicker: string;
  eventTicker: string;
  title: string;
  status: string;
  result?: string;

  // Position details
  side: 'YES' | 'NO';
  shares: number;           // Number of outcome tokens held
  mintAddress: string;      // The outcome token mint

  // Valuation
  currentPrice: number;     // Current market price (0-1)
  currentValue: number;     // shares * currentPrice (in USDC terms)
  costBasis?: number;       // What was paid (if tracked)
  unrealizedPnL?: number;   // currentValue - costBasis

  // Payout scenarios
  maxPayout: number;        // shares * 1 (if wins)
  maxLoss: number;          // costBasis or currentValue (if loses)

  // Metadata
  closeTime?: number;
  expirationTime?: number;
}

export interface PositionSummary {
  wallet: string;
  balance: WalletBalance;
  positions: DFlowPosition[];
  totalValue: number;       // Sum of all position values
  totalMaxPayout: number;   // Sum of max payouts
  positionCount: number;
  updatedAt: Date;
}

// =============================================================================
// POSITION TRACKING
// =============================================================================

/**
 * Get all DFlow positions for a wallet
 */
export async function getPositions(
  connection: Connection,
  walletAddress: string | PublicKey
): Promise<DFlowPosition[]> {
  const address = typeof walletAddress === 'string'
    ? walletAddress
    : walletAddress.toBase58();

  try {
    // Step 1: Get all token accounts
    const tokenAccounts = await getAllTokenAccounts(connection, address);

    if (tokenAccounts.length === 0) {
      return [];
    }

    // Step 2: Filter to find outcome tokens
    const allMints = tokenAccounts.map(t => t.mint);
    const outcomeMints = await filterDFlowOutcomeMints(allMints);

    if (outcomeMints.length === 0) {
      return [];
    }

    // Step 3: Batch fetch market details for outcome tokens
    const markets = await batchGetDFlowMarkets(outcomeMints);

    // Step 4: Build position objects
    const positions: DFlowPosition[] = [];

    for (const mint of outcomeMints) {
      // Find the token account for this mint
      const tokenAccount = tokenAccounts.find(t => t.mint === mint);
      if (!tokenAccount || tokenAccount.balance === 0) {
        continue;
      }

      // Find the market
      const market = markets.find(m => {
        const usdcAccount = m.accounts?.[USDC_MINT];
        return usdcAccount?.yesMint === mint || usdcAccount?.noMint === mint;
      });

      if (!market) {
        // Try individual lookup
        const singleMarket = await getDFlowMarketByMint(mint);
        if (singleMarket) {
          const position = buildPosition(singleMarket, mint, tokenAccount.balance);
          if (position) positions.push(position);
        }
        continue;
      }

      const position = buildPosition(market, mint, tokenAccount.balance);
      if (position) positions.push(position);
    }

    return positions;
  } catch (error) {
    console.error('[getPositions] Failed:', error);
    return [];
  }
}

/**
 * Build a position object from market data
 */
function buildPosition(
  market: DFlowMarket,
  mintAddress: string,
  shares: number
): DFlowPosition | null {
  const usdcAccount = market.accounts?.[USDC_MINT];
  if (!usdcAccount) return null;

  const side: 'YES' | 'NO' = usdcAccount.yesMint === mintAddress ? 'YES' : 'NO';

  // Parse prices
  const yesBid = parseFloat(market.yesBid || '0');
  const yesAsk = parseFloat(market.yesAsk || '0');
  const noBid = parseFloat(market.noBid || '0');
  const noAsk = parseFloat(market.noAsk || '0');

  // Calculate mid price
  let currentPrice: number;
  if (side === 'YES') {
    currentPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk || 0.5;
  } else {
    currentPrice = noBid > 0 && noAsk > 0 ? (noBid + noAsk) / 2 : noBid || noAsk || 0.5;
  }

  const currentValue = shares * currentPrice;
  const maxPayout = shares; // Each share pays $1 if wins

  return {
    marketTicker: market.ticker,
    eventTicker: market.eventTicker,
    title: market.title,
    status: market.status,
    result: market.result || undefined,

    side,
    shares,
    mintAddress,

    currentPrice,
    currentValue,
    maxPayout,
    maxLoss: currentValue, // Assuming current value is at risk

    closeTime: market.closeTime,
    expirationTime: market.expirationTime,
  };
}

/**
 * Get full position summary for a wallet
 */
export async function getPositionSummary(
  connection: Connection,
  walletAddress: string | PublicKey
): Promise<PositionSummary> {
  const address = typeof walletAddress === 'string'
    ? walletAddress
    : walletAddress.toBase58();

  // Get balance and positions in parallel
  const [balance, positions] = await Promise.all([
    getWalletBalance(connection, address),
    getPositions(connection, address),
  ]);

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalMaxPayout = positions.reduce((sum, p) => sum + p.maxPayout, 0);

  return {
    wallet: address,
    balance,
    positions,
    totalValue,
    totalMaxPayout,
    positionCount: positions.length,
    updatedAt: new Date(),
  };
}

/**
 * Get positions grouped by market
 */
export async function getPositionsByMarket(
  connection: Connection,
  walletAddress: string | PublicKey
): Promise<Map<string, DFlowPosition[]>> {
  const positions = await getPositions(connection, walletAddress);

  const byMarket = new Map<string, DFlowPosition[]>();
  for (const position of positions) {
    const existing = byMarket.get(position.marketTicker) || [];
    existing.push(position);
    byMarket.set(position.marketTicker, existing);
  }

  return byMarket;
}

/**
 * Check if wallet has any positions in a specific market
 */
export async function hasPosition(
  connection: Connection,
  walletAddress: string | PublicKey,
  marketTicker: string
): Promise<DFlowPosition | null> {
  const positions = await getPositions(connection, walletAddress);
  return positions.find(p => p.marketTicker === marketTicker) || null;
}

/**
 * Calculate P&L for all positions (requires historical cost data)
 */
export function calculatePnL(
  positions: DFlowPosition[],
  costBasisByMint: Map<string, number>
): {
  totalCostBasis: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPct: number;
} {
  let totalCostBasis = 0;
  let totalCurrentValue = 0;

  for (const position of positions) {
    const costBasis = costBasisByMint.get(position.mintAddress) || position.currentValue;
    position.costBasis = costBasis;
    position.unrealizedPnL = position.currentValue - costBasis;

    totalCostBasis += costBasis;
    totalCurrentValue += position.currentValue;
  }

  const totalUnrealizedPnL = totalCurrentValue - totalCostBasis;
  const totalUnrealizedPnLPct = totalCostBasis > 0
    ? (totalUnrealizedPnL / totalCostBasis) * 100
    : 0;

  return {
    totalCostBasis,
    totalCurrentValue,
    totalUnrealizedPnL,
    totalUnrealizedPnLPct,
  };
}

/**
 * Get resolved positions (markets that have settled)
 */
export async function getResolvedPositions(
  connection: Connection,
  walletAddress: string | PublicKey
): Promise<{
  won: DFlowPosition[];
  lost: DFlowPosition[];
  pending: DFlowPosition[];
}> {
  const positions = await getPositions(connection, walletAddress);

  const won: DFlowPosition[] = [];
  const lost: DFlowPosition[] = [];
  const pending: DFlowPosition[] = [];

  for (const position of positions) {
    if (!position.result || position.result === '') {
      pending.push(position);
      continue;
    }

    const marketResult = position.result.toLowerCase() as 'yes' | 'no';
    const positionSide = position.side.toLowerCase() as 'yes' | 'no';

    if (marketResult === positionSide) {
      won.push(position);
    } else {
      lost.push(position);
    }
  }

  return { won, lost, pending };
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Format position for display
 */
export function formatPosition(position: DFlowPosition): string {
  const pricePct = (position.currentPrice * 100).toFixed(1);
  const valueFmt = position.currentValue.toFixed(2);
  const sharesFmt = position.shares.toFixed(2);

  let status = '';
  if (position.result) {
    const won = position.result.toLowerCase() === position.side.toLowerCase();
    status = won ? ' [WON]' : ' [LOST]';
  }

  return `${position.side} ${sharesFmt} @ ${pricePct}% = $${valueFmt}${status}`;
}

/**
 * Format position summary for Telegram
 */
export function formatPositionSummaryTelegram(summary: PositionSummary): string {
  let text = `
*PORTFOLIO SUMMARY*
${'─'.repeat(35)}

*Wallet:* \`${summary.wallet.slice(0, 8)}...${summary.wallet.slice(-4)}\`

*Balances:*
◎ SOL: ${summary.balance.sol.toFixed(4)}
💵 USDC: ${summary.balance.usdc.toFixed(2)}

*Positions:* ${summary.positionCount}
*Total Value:* $${summary.totalValue.toFixed(2)}
*Max Payout:* $${summary.totalMaxPayout.toFixed(2)}
`;

  if (summary.positions.length > 0) {
    text += `\n*Open Positions:*\n`;
    for (const pos of summary.positions.slice(0, 10)) {
      const pricePct = (pos.currentPrice * 100).toFixed(0);
      text += `\n• ${pos.side} ${pos.shares.toFixed(1)} @ ${pricePct}%`;
      text += `\n  ${pos.title.slice(0, 40)}...`;
    }

    if (summary.positions.length > 10) {
      text += `\n\n+${summary.positions.length - 10} more positions...`;
    }
  }

  return text;
}
