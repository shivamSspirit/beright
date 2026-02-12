/**
 * DFlow Trading Skill for Telegram
 * Allows users to trade DFlow markets directly from Telegram
 *
 * Features:
 * - /wallet - Create or view wallet
 * - /dflow <query> - Search DFlow markets
 * - /trade <ticker> <YES|NO> <amount> - Place a trade
 * - /positions - View current positions
 */

import { Keypair, Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
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
import { formatUsd, formatPct } from './utils';

// Memory directory for wallet storage
const MEMORY_DIR = path.join(process.cwd(), 'memory');
const WALLETS_FILE = path.join(MEMORY_DIR, 'telegram_wallets.json');

// Solana RPC
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// ============================================
// WALLET MANAGEMENT
// ============================================

interface TelegramWallet {
  telegramId: string;
  publicKey: string;
  encryptedSecretKey: string; // Base58 encoded
  createdAt: string;
}

function loadWallets(): Record<string, TelegramWallet> {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      return JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading wallets:', error);
  }
  return {};
}

function saveWallets(wallets: Record<string, TelegramWallet>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
  } catch (error) {
    console.error('Error saving wallets:', error);
  }
}

/**
 * Get or create wallet for Telegram user
 */
export function getOrCreateWallet(telegramId: string): { publicKey: string; isNew: boolean } {
  const wallets = loadWallets();

  // Check if wallet exists
  if (wallets[telegramId]) {
    return { publicKey: wallets[telegramId].publicKey, isNew: false };
  }

  // Generate new keypair
  const keypair = Keypair.generate();
  const wallet: TelegramWallet = {
    telegramId,
    publicKey: keypair.publicKey.toBase58(),
    encryptedSecretKey: bs58.encode(keypair.secretKey),
    createdAt: new Date().toISOString(),
  };

  wallets[telegramId] = wallet;
  saveWallets(wallets);

  console.log(`Created new wallet for Telegram user ${telegramId}: ${wallet.publicKey}`);
  return { publicKey: wallet.publicKey, isNew: true };
}

/**
 * Get keypair for signing transactions
 */
function getKeypair(telegramId: string): Keypair | null {
  const wallets = loadWallets();
  const wallet = wallets[telegramId];

  if (!wallet) return null;

  try {
    const secretKey = bs58.decode(wallet.encryptedSecretKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error decoding wallet:', error);
    return null;
  }
}

/**
 * Get wallet balance
 */
async function getWalletBalance(publicKey: string): Promise<{ sol: number; usdc: number }> {
  try {
    const connection = new Connection(SOLANA_RPC);
    const pubkey = new PublicKey(publicKey);

    // Get SOL balance
    const solBalance = await connection.getBalance(pubkey);

    // Get USDC balance (simplified - would need token account lookup)
    // For now return 0, full implementation would use getTokenAccountsByOwner

    return {
      sol: solBalance / 1e9,
      usdc: 0, // TODO: Implement USDC balance lookup
    };
  } catch (error) {
    console.error('Error getting balance:', error);
    return { sol: 0, usdc: 0 };
  }
}

// ============================================
// TELEGRAM COMMAND HANDLERS
// ============================================

/**
 * Handle /wallet command
 */
export async function handleWallet(telegramId: string): Promise<SkillResponse> {
  const { publicKey, isNew } = getOrCreateWallet(telegramId);
  const balance = await getWalletBalance(publicKey);

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
 * Handle /trade command - Place a DFlow trade
 */
export async function handleTrade(
  telegramId: string,
  ticker: string,
  side: 'YES' | 'NO',
  amountUsd: number
): Promise<SkillResponse> {
  try {
    // Get user wallet
    const keypair = getKeypair(telegramId);
    if (!keypair) {
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

    // Get token mints
    const usdcAccount = market.accounts?.[USDC_MINT];
    if (!usdcAccount?.yesMint || !usdcAccount?.noMint) {
      return {
        text: `Market ${ticker} is not initialized for trading yet.`,
        mood: 'ERROR',
      };
    }

    const outputMint = side === 'YES' ? usdcAccount.yesMint : usdcAccount.noMint;
    const amountLamports = Math.floor(amountUsd * 1e6); // USDC has 6 decimals

    // Get order transaction from DFlow
    const client = getDFlowClient();
    const orderResponse = await client.getOrder({
      inputMint: USDC_MINT,
      outputMint,
      amount: amountLamports,
      userPublicKey: keypair.publicKey.toBase58(),
      slippageBps: 100, // 1% slippage
    });

    if (!orderResponse.transaction) {
      return {
        text: `Failed to get trade transaction. Please try again.`,
        mood: 'ERROR',
      };
    }

    // Decode and sign transaction
    const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([keypair]);

    // Send transaction
    const connection = new Connection(SOLANA_RPC);
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Calculate expected output
    const expectedTokens = parseInt(orderResponse.outAmount) / 1e6;
    const effectivePrice = amountUsd / expectedTokens;

    return {
      text: `
✅ *TRADE SUBMITTED*
${'─'.repeat(35)}

*Market:* ${market.title.slice(0, 40)}
*Side:* ${side}
*Amount:* $${amountUsd.toFixed(2)} USDC
*Expected:* ~${expectedTokens.toFixed(2)} ${side} tokens
*Price:* $${effectivePrice.toFixed(4)}/token

*Transaction:*
\`${signature.slice(0, 20)}...\`

[View on Solscan](https://solscan.io/tx/${signature})

/positions - Check your positions
`,
      mood: 'BULLISH',
      data: { signature, orderResponse },
    };
  } catch (error: any) {
    console.error('Trade error:', error);

    // Handle specific errors
    if (error.message?.includes('insufficient')) {
      return {
        text: `Insufficient balance. Please fund your wallet first:\n/wallet`,
        mood: 'ERROR',
      };
    }

    return {
      text: `Trade failed: ${error.message || error}\n\nMake sure you have enough USDC in your wallet.`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /positions command - View DFlow positions
 */
export async function handlePositions(telegramId: string): Promise<SkillResponse> {
  const { publicKey, isNew } = getOrCreateWallet(telegramId);

  if (isNew) {
    return {
      text: `New wallet created! You don't have any positions yet.\n\n/dflow - Search markets\n/trade <ticker> YES|NO <amount> - Place trade`,
      mood: 'NEUTRAL',
    };
  }

  // TODO: Implement position fetching using DFlow API
  // Would need to scan wallet for outcome tokens and match to markets

  return {
    text: `
📊 *YOUR POSITIONS*
${'─'.repeat(35)}

Wallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-4)}\`

*Coming soon:* Position tracking and P&L

For now, use /wallet to check balances
`,
    mood: 'NEUTRAL',
  };
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
