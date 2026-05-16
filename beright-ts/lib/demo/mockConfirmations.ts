/**
 * Demo Mode - Mock Transaction Confirmations
 *
 * Generates fake but realistic-looking transaction confirmations
 * for demo mode. All "transactions" are simulated - no real
 * blockchain interaction occurs.
 *
 * For VCs: Shows the full UX flow without real money risk.
 */

import { randomBytes } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface MockTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
  err: null;
  memo: string | null;
}

export interface MockPredictionCommit {
  signature: string;
  explorerUrl: string;
  network: 'devnet';
  slot: number;
  blockTime: number;
  commitment: {
    question: string;
    probability: number;
    direction: 'YES' | 'NO';
    timestamp: number;
  };
}

export interface MockTradeExecution {
  orderId: string;
  signature: string;
  explorerUrl: string;
  network: 'devnet';
  status: 'filled';
  market: {
    ticker: string;
    title: string;
  };
  side: 'YES' | 'NO';
  size: number;
  price: number;
  filledAt: number;
  fee: number;
}

// ============================================
// SIGNATURE GENERATION
// ============================================

/**
 * Generate a realistic-looking Solana transaction signature
 * Real signatures are 88 characters, base58 encoded
 */
export function generateMockSignature(): string {
  // Generate 64 random bytes and encode as base58-like string
  const bytes = randomBytes(64);
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';

  for (let i = 0; i < 88; i++) {
    signature += base58Chars[bytes[i % 64] % base58Chars.length];
  }

  return signature;
}

/**
 * Generate a mock order ID
 */
export function generateMockOrderId(): string {
  return `demo-order-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get current slot (simulated)
 */
function getCurrentSlot(): number {
  // Roughly 2.5 slots per second since genesis
  // Genesis was ~Oct 2020, so we're at ~250M+ slots
  const genesisTime = new Date('2020-03-16').getTime();
  const now = Date.now();
  const secondsElapsed = (now - genesisTime) / 1000;
  return Math.floor(secondsElapsed * 2.5);
}

// ============================================
// MOCK TRANSACTION GENERATION
// ============================================

/**
 * Generate a mock transaction confirmation
 */
export function generateMockTransaction(memo?: string): MockTransaction {
  const signature = generateMockSignature();
  const slot = getCurrentSlot();

  return {
    signature,
    slot,
    blockTime: Math.floor(Date.now() / 1000),
    confirmationStatus: 'finalized',
    err: null,
    memo: memo || null,
  };
}

/**
 * Generate a mock prediction commit (on-chain Brier)
 */
export function generateMockPredictionCommit(params: {
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
}): MockPredictionCommit {
  const signature = generateMockSignature();
  const slot = getCurrentSlot();

  return {
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    network: 'devnet',
    slot,
    blockTime: Math.floor(Date.now() / 1000),
    commitment: {
      question: params.question,
      probability: params.probability,
      direction: params.direction,
      timestamp: Date.now(),
    },
  };
}

/**
 * Generate a mock trade execution result
 */
export function generateMockTradeExecution(params: {
  market: { ticker: string; title: string };
  side: 'YES' | 'NO';
  size: number;
  price: number;
}): MockTradeExecution {
  const signature = generateMockSignature();
  const orderId = generateMockOrderId();

  return {
    orderId,
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    network: 'devnet',
    status: 'filled',
    market: params.market,
    side: params.side,
    size: params.size,
    price: params.price,
    filledAt: Date.now(),
    fee: params.size * params.price * 0.01, // 1% demo fee
  };
}

// ============================================
// CONFIRMATION SIMULATION
// ============================================

/**
 * Simulate transaction confirmation delay
 * Real Solana: ~400ms for confirmed, ~30s for finalized
 * Demo: Faster for better UX
 */
export async function simulateConfirmation(
  level: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
): Promise<void> {
  const delays = {
    processed: 100,   // 100ms
    confirmed: 500,   // 500ms
    finalized: 1500,  // 1.5s (much faster than real 30s)
  };

  await new Promise(resolve => setTimeout(resolve, delays[level]));
}

/**
 * Simulate a full transaction lifecycle with callbacks
 */
export async function simulateTransactionLifecycle(
  onStatus?: (status: string) => void
): Promise<MockTransaction> {
  const tx = generateMockTransaction();

  // Simulate processing
  if (onStatus) onStatus('processing');
  tx.confirmationStatus = 'processed';
  await simulateConfirmation('processed');

  // Simulate confirmation
  if (onStatus) onStatus('confirming');
  tx.confirmationStatus = 'confirmed';
  await simulateConfirmation('confirmed');

  // Simulate finalization
  if (onStatus) onStatus('finalizing');
  tx.confirmationStatus = 'finalized';
  await simulateConfirmation('finalized');

  if (onStatus) onStatus('complete');
  return tx;
}

// ============================================
// DEMO WALLET
// ============================================

/**
 * Demo wallet configuration
 * This is a devnet wallet with airdropped SOL/USDC
 */
export const DEMO_WALLET = {
  // Public key (devnet only - no real funds)
  publicKey: 'DemoWa11etBer1ghtPr0t0c01111111111111111111',

  // Simulated balances
  balances: {
    sol: 10.0,     // 10 SOL (devnet)
    usdc: 10000,   // $10,000 USDC (demo)
  },

  // Explorer URL
  explorerUrl: 'https://explorer.solana.com/address/DemoWa11etBer1ghtPr0t0c01111111111111111111?cluster=devnet',
};

/**
 * Get demo wallet balance
 */
export function getDemoWalletBalance(): {
  sol: number;
  usdc: number;
  totalUsd: number;
} {
  // In a real implementation, this would track demo trades
  // For now, return static balances
  return {
    sol: DEMO_WALLET.balances.sol,
    usdc: DEMO_WALLET.balances.usdc,
    totalUsd: DEMO_WALLET.balances.usdc + (DEMO_WALLET.balances.sol * 150), // ~$150/SOL
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if a signature is a demo signature
 * (Helps prevent confusion with real transactions)
 */
export function isDemoSignature(signature: string): boolean {
  // Demo signatures are generated randomly but we can't truly distinguish them
  // This is a placeholder - in production, we'd track demo sigs in a Set
  return signature.length === 88;
}

/**
 * Get explorer URL for a signature
 * Always returns devnet URL in demo mode
 */
export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
