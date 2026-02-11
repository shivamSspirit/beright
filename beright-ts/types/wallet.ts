/**
 * Wallet & Trading Types for BeRight Protocol
 * Solana wallet and position tracking
 */

export interface Position {
  id: string;
  market: string;
  platform: string;
  direction: 'YES' | 'NO';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  txSignature: string;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  market: string;
  platform: string;
  direction: 'YES' | 'NO';
  size: number;
  price: number;
  totalUsd: number;
  fee: number;
  slippage: number;
  txSignature: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface WalletBalance {
  sol: number;
  usdc: number;
  totalUsd: number;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
}

export interface KnownWhale {
  address: string;
  name: string;
  accuracy: number;
  notes?: string;
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  fee: number;
  description?: string;
  tokenTransfers: TokenTransfer[];
  nativeTransfers: NativeTransfer[];
}

export interface TokenTransfer {
  mint: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
}

export interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

// Trading configuration
export interface TradingConfig {
  maxPositionUsd: number;
  maxPortfolioUsd: number;
  defaultSlippage: number;
  maxSlippage: number;
  kellyMultiplier: number;  // Half-Kelly = 0.5
  autoExecute: boolean;
}
