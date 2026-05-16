/**
 * Whale Tracking Skill for BeRight Protocol
 * Monitor large wallet movements on Solana
 */

// Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { SkillResponse, WhaleAlert, KnownWhale, HeliusTransaction } from '../types/index';
import { WHALE } from '../config/thresholds';
import { TOKENS } from '../config/platforms';
import { formatUsd, confidenceEmoji, timestamp } from './utils';
import { getSolPrice } from './prices';
import * as fs from 'fs';

// Cached SOL price for the current scan cycle
let cachedSolPrice: number | null = null;

// Read at runtime, not module load time
function getHeliusApiKey(): string | undefined {
  return process.env.HELIUS_API_KEY;
}

/**
 * Load known whales from memory file
 */
function loadWhales(): KnownWhale[] {
  try {
    const whalesFile = path.join(process.cwd(), 'memory', 'whales.json');
    if (fs.existsSync(whalesFile)) {
      const data = fs.readFileSync(whalesFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Could not load whales:', error);
  }
  return [];
}

/**
 * Save whales to memory file
 */
function saveWhales(whales: KnownWhale[]): void {
  try {
    const whalesFile = path.join(process.cwd(), 'memory', 'whales.json');
    fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  } catch (error) {
    console.error('Could not save whales:', error);
  }
}

/**
 * Get transactions for a wallet using Helius API
 */
async function getWalletTransactions(address: string, limit = 20): Promise<HeliusTransaction[]> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) {
    console.warn('HELIUS_API_KEY not set');
    return [];
  }

  try {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Helius API error: ${response.status}`);
      return [];
    }

    return await response.json() as HeliusTransaction[];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

/**
 * Get wallet balance using Helius API
 */
async function getWalletBalance(address: string): Promise<{ sol: number; usdc: number } | null> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as any;

    let sol = 0;
    let usdc = 0;

    if (data.nativeBalance) {
      sol = data.nativeBalance / 1e9;
    }

    for (const token of data.tokens || []) {
      if (token.mint === TOKENS.USDC) {
        usdc = token.amount / 1e6;
      }
    }

    return { sol, usdc };
  } catch (error) {
    console.error('Error fetching balance:', error);
    return null;
  }
}

/**
 * Analyze a transaction for whale activity
 */
function analyzeTransaction(tx: HeliusTransaction): WhaleAlert | null {
  try {
    let totalUsd = 0;

    // Check token transfers (USDC)
    for (const transfer of tx.tokenTransfers || []) {
      if (transfer.mint === TOKENS.USDC) {
        totalUsd += transfer.tokenAmount;
      }
    }

    // Check native transfers (SOL) — uses real price from Pyth/Jupiter/DeFi Llama
    for (const transfer of tx.nativeTransfers || []) {
      const sol = transfer.amount / 1e9;
      const solPrice = cachedSolPrice ?? 0;
      totalUsd += sol * solPrice;
    }

    if (totalUsd < WHALE.minTradeUsd) {
      return null;
    }

    return {
      wallet: '',  // Will be filled by caller
      whaleName: '',
      whaleAccuracy: 0.5,
      signature: tx.signature,
      timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null,
      type: tx.type,
      totalUsd,
      fee: tx.fee,
      description: tx.description || '',
    };
  } catch {
    return null;
  }
}

/**
 * Scan all known whales for recent activity
 */
async function scanWhales(): Promise<WhaleAlert[]> {
  // Fetch real SOL price once for the entire scan cycle
  cachedSolPrice = await getSolPrice();

  const whales = loadWhales();
  const alerts: WhaleAlert[] = [];

  for (const whale of whales) {
    const txs = await getWalletTransactions(whale.address, 10);

    for (const tx of txs) {
      const alert = analyzeTransaction(tx);
      if (alert) {
        alert.wallet = whale.address;
        alert.whaleName = whale.name;
        alert.whaleAccuracy = whale.accuracy;
        alerts.push(alert);
      }
    }
  }

  return alerts.sort((a, b) => b.totalUsd - a.totalUsd);
}

/**
 * Add a whale to tracking list
 */
export function addWhale(address: string, name = 'Unknown', accuracy = 0.5): void {
  const whales = loadWhales();

  // Check if already exists
  if (whales.some(w => w.address === address)) {
    console.log('Whale already tracked');
    return;
  }

  whales.push({ address, name, accuracy });
  saveWhales(whales);
}

/**
 * Format whale alert
 */
function formatWhaleAlert(alert: WhaleAlert): string {
  const emoji = confidenceEmoji(alert.whaleAccuracy);

  return `
🐋 WHALE ALERT

Wallet: ${alert.whaleName}
Address: ${alert.wallet.slice(0, 20)}...
Historical Accuracy: ${emoji} ${(alert.whaleAccuracy * 100).toFixed(0)}%

TRANSACTION
• Size: ${formatUsd(alert.totalUsd)}
• Type: ${alert.type}
• Time: ${alert.timestamp || 'Unknown'}

${alert.description}

TX: ${alert.signature.slice(0, 30)}...
`;
}

/**
 * Format whale report
 */
function formatWhaleReport(alerts: WhaleAlert[]): string {
  const whales = loadWhales();

  if (!alerts.length) {
    return `
🐋 WHALE SCAN COMPLETE

No significant whale activity detected.

Monitoring:
• Minimum trade size: ${formatUsd(WHALE.minTradeUsd)}
• Known whale wallets: ${whales.length}

Add whales to track with /track_whale <address>
`;
  }

  let report = `
🐋 WHALE ACTIVITY REPORT
${timestamp().slice(0, 19)}
${'='.repeat(40)}

Found ${alerts.length} significant transactions:
`;

  for (let i = 0; i < Math.min(alerts.length, 5); i++) {
    const alert = alerts[i];
    report += `\n${i + 1}. ${alert.whaleName} - ${formatUsd(alert.totalUsd)}`;
    report += `\n   ${alert.type} @ ${alert.timestamp || 'Unknown'}`;
  }

  report += `

💡 WHALE TRACKING TIP
Smart money often moves 6-12 hours before news.
Use whale signals as ONE input, not the only one.
`;

  return report;
}

/**
 * Main whale watch skill
 */
export async function whaleWatch(): Promise<SkillResponse> {
  try {
    const alerts = await scanWhales();
    return {
      text: formatWhaleReport(alerts),
      mood: alerts.length > 0 ? 'ALERT' : 'NEUTRAL',
      data: alerts,
    };
  } catch (error) {
    return {
      text: `Whale scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Check specific wallet
 */
export async function checkWallet(address: string): Promise<SkillResponse> {
  try {
    const [txs, balance] = await Promise.all([
      getWalletTransactions(address, 10),
      getWalletBalance(address),
    ]);

    let output = `
🔍 WALLET CHECK: ${address.slice(0, 20)}...

`;

    if (balance) {
      output += `BALANCE\n`;
      output += `• SOL: ${balance.sol.toFixed(4)}\n`;
      output += `• USDC: ${formatUsd(balance.usdc)}\n\n`;
    }

    output += `RECENT TRANSACTIONS (${txs.length})\n`;

    for (const tx of txs.slice(0, 5)) {
      const alert = analyzeTransaction(tx);
      if (alert) {
        output += `• ${formatUsd(alert.totalUsd)} - ${alert.type}\n`;
      }
    }

    return { text: output, mood: 'NEUTRAL', data: { txs, balance } };
  } catch (error) {
    return {
      text: `Wallet check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('whale.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'scan') {
      console.log('🐋 Scanning whale activity...');
      const result = await whaleWatch();
      console.log(result.text);
    } else if (command === 'check' && args[1]) {
      console.log(`🐋 Checking wallet: ${args[1].slice(0, 20)}...`);
      const result = await checkWallet(args[1]);
      console.log(result.text);
    } else if (command === 'add' && args[1]) {
      const name = args[2] || 'Unknown';
      addWhale(args[1], name);
      console.log(`✅ Added whale: ${args[1].slice(0, 20)}... (${name})`);
    } else if (command === 'list') {
      const whales = loadWhales();
      console.log('🐋 Tracked Whales:');
      whales.forEach(w => console.log(`  ${w.name}: ${w.address.slice(0, 30)}... (${(w.accuracy * 100).toFixed(0)}%)`));
    } else {
      console.log('Usage:');
      console.log('  ts-node whale.ts scan');
      console.log('  ts-node whale.ts check <address>');
      console.log('  ts-node whale.ts add <address> [name]');
      console.log('  ts-node whale.ts list');
    }
  })();
}
