/**
 * DFlow Trading Skill
 *
 * Core trading functionality for DFlow prediction markets.
 * Gateway-agnostic: can be called from Telegram, Web, API, Discord, etc.
 *
 * Features:
 * - Wallet management (create, view, balance)
 * - Market search and discovery
 * - Trade execution with smart routing (DFlow vs Jupiter)
 * - Position tracking (on-chain)
 *
 * Smart Routing:
 * - Compares DFlow direct vs Jupiter aggregator
 * - Picks best execution price automatically
 * - Optional Jito MEV protection
 *
 * @author BeRight Protocol
 */

import { Connection } from '@solana/web3.js';
import { SkillResponse } from '../types/index';
import {
  getDFlowClient,
  getDFlowHotMarkets,
  searchDFlowMarkets,
  getDFlowMarket,
  USDC_MINT,
  DFlowEvent,
  DFlowMarket,
} from '../lib/dflow';
import {
  getDFlowExecutor,
  executeDFlowTrade,
  executeSmartTrade,
  getSmartQuote,
} from '../lib/dflow/executor';
import {
  getTelegramWalletStore,
  getWalletBalance as fetchWalletBalance,
  KeypairWallet,
} from '../lib/dflow/wallet';
import {
  getPositionSummary,
  formatPositionSummaryTelegram,
} from '../lib/dflow/positions';
import { formatUsd, formatPct } from './utils';

// ============================================
// WALLET MANAGEMENT
// ============================================

// Wallet store - persists wallets by user ID (works for any gateway)
const walletStore = getTelegramWalletStore();

/**
 * Get or create wallet for Telegram user
 */
export function getOrCreateWallet(telegramId: string): { publicKey: string; isNew: boolean } {
  const { wallet, isNew } = walletStore.getOrCreate(telegramId);
  return { publicKey: wallet.publicKey.toBase58(), isNew };
}

/**
 * Get keypair wallet for a user
 */
function getWallet(telegramId: string): KeypairWallet | null {
  return walletStore.get(telegramId);
}

/**
 * Get wallet balance (now uses real token lookup)
 */
async function getWalletBalanceForUser(publicKey: string): Promise<{ sol: number; usdc: number }> {
  const executor = getDFlowExecutor();
  const connection = executor.getConnection();
  const balance = await fetchWalletBalance(connection, publicKey);
  return { sol: balance.sol, usdc: balance.usdc };
}

// ============================================
// SKILL HANDLERS (Gateway-Agnostic)
// ============================================

/**
 * Handle /wallet command
 */
export async function handleWallet(telegramId: string): Promise<SkillResponse> {
  const { publicKey, isNew } = getOrCreateWallet(telegramId);
  const balance = await getWalletBalanceForUser(publicKey);

  if (isNew) {
    return {
      text: `
🔐 *NEW WALLET CREATED*
${'─'.repeat(35)}

Your BeRight trading wallet:
\`${publicKey}\`

📥 *Fund your wallet to trade:*
Send SOL or USDC to this address.

💡 This wallet is linked to your Telegram account.
You can trade DFlow markets directly from here!

*Next Steps:*
/dflow bitcoin - Search markets
/trade <ticker> YES 10 - Buy $10 of YES
`,
      mood: 'BULLISH',
    };
  }

  return {
    text: `
👛 *YOUR WALLET*
${'─'.repeat(35)}

Address: \`${publicKey}\`

*Balances:*
◎ SOL: ${balance.sol.toFixed(4)}
💵 USDC: ${balance.usdc.toFixed(2)}

*Commands:*
/dflow <query> - Search markets
/trade <ticker> YES|NO <amount> - Place trade
/positions - View positions
`,
    mood: 'NEUTRAL',
  };
}

/**
 * Handle /dflow command - Search DFlow markets
 */
export async function handleDFlowSearch(query: string): Promise<SkillResponse> {
  try {
    const events = query
      ? await searchDFlowMarkets(query, 10)
      : await getDFlowHotMarkets(10);

    if (!events.length) {
      return {
        text: `No DFlow markets found for: ${query || 'hot markets'}\n\nTry /dflow fed or /dflow trump`,
        mood: 'NEUTRAL',
      };
    }

    let text = `
🎯 *DFLOW MARKETS*${query ? ` - "${query}"` : ' - HOT'}
${'─'.repeat(35)}
`;

    let count = 0;
    for (const event of events) {
      if (count >= 10) break;

      // Try to get price from nested market first, then fall back to event-level estimates
      const market = event.markets?.[0];
      let yesPrice = 0;

      if (market) {
        const yesBid = parseFloat(market.yesBid || '0');
        const yesAsk = parseFloat(market.yesAsk || '0');
        yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;
      }

      count++;
      text += `
${count}. *${event.title.slice(0, 50)}*
   Ticker: \`${event.ticker}\`
   ${yesPrice > 0 ? `YES: ${formatPct(yesPrice)} | ` : ''}Vol: ${formatUsd(event.volume24h || event.volume || 0)}
`;
    }

    text += `
${'─'.repeat(35)}
/trade <ticker> YES|NO <amount> - Place trade
`;

    return {
      text,
      mood: 'NEUTRAL',
      data: events,
    };
  } catch (error) {
    return {
      text: `Error searching DFlow markets: ${error}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle trade - Place a DFlow trade with smart routing
 *
 * Smart routing compares:
 * - DFlow direct execution
 * - Jupiter aggregator
 *
 * Picks the best price automatically.
 *
 * @param userId - User identifier (Telegram ID, wallet address, etc.)
 * @param ticker - Market ticker
 * @param side - YES or NO
 * @param amountUsd - Amount in USD
 * @param options - Optional: useSmartRouting (default true), preferVenue
 */
export async function handleTrade(
  userId: string,
  ticker: string,
  side: 'YES' | 'NO',
  amountUsd: number,
  options?: {
    useSmartRouting?: boolean;
    preferVenue?: 'dflow' | 'jupiter';
  }
): Promise<SkillResponse> {
  try {
    // Get user wallet
    const wallet = getWallet(userId);
    if (!wallet) {
      return {
        text: `You don't have a wallet yet! Use /wallet to create one.`,
        mood: 'ERROR',
      };
    }

    // Get market details
    const market = await getDFlowMarket(ticker);
    if (!market) {
      return {
        text: `Market not found: ${ticker}\nUse /dflow <query> to search.`,
        mood: 'ERROR',
      };
    }

    // Check if market is initialized
    const usdcAccount = market.accounts?.[USDC_MINT];
    if (!usdcAccount?.yesMint || !usdcAccount?.noMint || !usdcAccount?.isInitialized) {
      return {
        text: `Market ${ticker} is not initialized for trading yet.`,
        mood: 'ERROR',
      };
    }

    // Execute trade with smart routing (DFlow vs Jupiter)
    const result = await executeSmartTrade(
      market,
      side,
      amountUsd,
      wallet.getKeypair(),
      {
        slippageBps: 100, // 1% slippage
        useSmartRouting: options?.useSmartRouting ?? true,
        preferVenue: options?.preferVenue,
        includeJupiter: true,
      }
    );

    if (!result.success) {
      // Handle specific errors
      if (result.error?.includes('insufficient')) {
        return {
          text: `Insufficient balance. Please fund your wallet first:\n/wallet`,
          mood: 'ERROR',
        };
      }

      return {
        text: `Trade failed: ${result.error}\n\nMake sure you have enough USDC in your wallet.`,
        mood: 'ERROR',
      };
    }

    // Calculate expected output from details
    const inputAmount = result.details?.inputAmount
      ? parseFloat(result.details.inputAmount)
      : amountUsd;
    const outputAmount = result.details?.outputAmount
      ? parseFloat(result.details.outputAmount)
      : amountUsd / 0.5; // Fallback estimate
    const effectivePrice = inputAmount / outputAmount;

    // Show routing info
    const routeInfo = result.route === 'jupiter'
      ? '🔀 Routed via Jupiter (better price)'
      : '⚡ Direct DFlow execution';

    const savingsInfo = result.routingInfo?.savingsPct && result.routingInfo.savingsPct > 0.001
      ? `\n*Savings:* ${(result.routingInfo.savingsPct * 100).toFixed(2)}% vs alternative`
      : '';

    return {
      text: `
✅ *TRADE EXECUTED*
${'─'.repeat(35)}

*Market:* ${market.title.slice(0, 40)}
*Side:* ${side}
*Amount:* $${amountUsd.toFixed(2)} USDC
*Received:* ~${outputAmount.toFixed(2)} ${side} tokens
*Price:* $${effectivePrice.toFixed(4)}/token

${routeInfo}${savingsInfo}

*Transaction:*
\`${result.signature?.slice(0, 20)}...\`

[View on Solscan](https://solscan.io/tx/${result.signature})

/positions - Check your positions
`,
      mood: 'BULLISH',
      data: {
        signature: result.signature,
        details: result.details,
        route: result.route,
        routingInfo: result.routingInfo,
      },
    };
  } catch (error: any) {
    console.error('Trade error:', error);

    return {
      text: `Trade failed: ${error.message || error}\n\nMake sure you have enough USDC in your wallet.`,
      mood: 'ERROR',
    };
  }
}

/**
 * Get trade quote with routing comparison (no execution)
 *
 * Shows user which route would be used and potential savings.
 */
export async function handleQuote(
  userId: string,
  ticker: string,
  side: 'YES' | 'NO',
  amountUsd: number
): Promise<SkillResponse> {
  try {
    const wallet = getWallet(userId);
    const walletAddress = wallet?.publicKey.toBase58() || 'simulation';

    const market = await getDFlowMarket(ticker);
    if (!market) {
      return {
        text: `Market not found: ${ticker}`,
        mood: 'ERROR',
      };
    }

    const routing = await getSmartQuote(market, side, amountUsd, walletAddress);

    const dflow = routing.quotes.dflow;
    const jupiter = routing.quotes.jupiter;

    let text = `
📊 *TRADE QUOTE*
${'─'.repeat(35)}

*Market:* ${market.title.slice(0, 40)}
*Side:* ${side}
*Amount:* $${amountUsd.toFixed(2)} USDC

`;

    if (dflow) {
      text += `*DFlow Direct:*
  Output: ${dflow.outputAmount.toFixed(2)} tokens
  Price: $${dflow.effectivePrice.toFixed(4)}/token
  Impact: ${(dflow.priceImpact * 100).toFixed(2)}%

`;
    }

    if (jupiter) {
      text += `*Jupiter Route:*
  Output: ${jupiter.outputAmount.toFixed(2)} tokens
  Price: $${jupiter.effectivePrice.toFixed(4)}/token
  Impact: ${(jupiter.priceImpact * 100).toFixed(2)}%
  Path: ${jupiter.route.join(' → ')}

`;
    }

    const recommended = routing.recommended === 'jupiter' ? '🔀 Jupiter' : '⚡ DFlow';
    text += `${'─'.repeat(35)}
*Recommended:* ${recommended}
*Reason:* ${routing.reason}
${routing.savingsPct > 0.001 ? `*Savings:* ${(routing.savingsPct * 100).toFixed(2)}%` : ''}

/trade ${ticker} ${side} ${amountUsd} - Execute trade
`;

    return {
      text,
      mood: 'NEUTRAL',
      data: routing,
    };
  } catch (error: any) {
    return {
      text: `Quote failed: ${error.message}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /positions command - View DFlow positions
 * Now uses lib/dflow/positions for real on-chain tracking
 */
export async function handlePositions(telegramId: string): Promise<SkillResponse> {
  const { publicKey, isNew } = getOrCreateWallet(telegramId);

  if (isNew) {
    return {
      text: `New wallet created! You don't have any positions yet.\n\n/dflow - Search markets\n/trade <ticker> YES|NO <amount> - Place trade`,
      mood: 'NEUTRAL',
    };
  }

  try {
    // Fetch real positions from on-chain
    const executor = getDFlowExecutor();
    const connection = executor.getConnection();
    const summary = await getPositionSummary(connection, publicKey);

    if (summary.positions.length === 0) {
      return {
        text: `
*YOUR POSITIONS*
${'─'.repeat(35)}

Wallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-4)}\`

*Balances:*
◎ SOL: ${summary.balance.sol.toFixed(4)}
💵 USDC: ${summary.balance.usdc.toFixed(2)}

No open positions found.

/dflow - Search markets
/trade <ticker> YES|NO <amount> - Place trade
`,
        mood: 'NEUTRAL',
      };
    }

    // Use the formatted summary from positions module
    return {
      text: formatPositionSummaryTelegram(summary),
      mood: summary.totalValue > 0 ? 'BULLISH' : 'NEUTRAL',
      data: summary,
    };
  } catch (error: any) {
    console.error('Position fetch error:', error);
    return {
      text: `Error fetching positions: ${error.message}\n\nWallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-4)}\``,
      mood: 'ERROR',
    };
  }
}

/**
 * Format market for display
 */
function formatMarketCard(event: DFlowEvent): string {
  const market = event.markets?.[0];
  if (!market) return '';

  const yesBid = parseFloat(market.yesBid || '0');
  const yesAsk = parseFloat(market.yesAsk || '0');
  const noBid = parseFloat(market.noBid || '0');
  const noAsk = parseFloat(market.noAsk || '0');

  const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;
  const noPrice = noBid > 0 && noAsk > 0 ? (noBid + noAsk) / 2 : noBid || noAsk;

  return `
*${event.title}*
Ticker: \`${event.ticker}\`
YES: ${formatPct(yesPrice)} (${formatPct(yesBid)}-${formatPct(yesAsk)})
NO: ${formatPct(noPrice)} (${formatPct(noBid)}-${formatPct(noAsk)})
24h Vol: ${formatUsd(event.volume24h || 0)}
`;
}
