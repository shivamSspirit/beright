'use client';

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useMode } from '../context/ModeContext';

// Known USDC token mints (for reference, but we'll auto-detect from wallet)
const KNOWN_USDC_MINTS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC (one faucet)
  'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC (another faucet)
];

// RPC URLs
const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';

interface WalletBalance {
  sol: number;
  usdc: number;
  usdcMint: string | null; // The actual USDC mint found in wallet
  isLoading: boolean;
  error: string | null;
  hasEnoughForTrade: boolean;
  refetch: () => Promise<void>;
  network: 'devnet' | 'mainnet-beta';
}

// Minimum amounts for trading
const MIN_SOL_FOR_FEES = 0.01; // ~$2 for transaction fees
const MIN_USDC_FOR_TRADE = 1; // $1 minimum trade

export function useWalletBalance(walletAddress: string | null): WalletBalance {
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [usdcMint, setUsdcMint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDemo, network } = useMode();

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setSol(0);
      setUsdc(0);
      setUsdcMint(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use devnet in demo mode, mainnet in production
      const rpcUrl = isDemo ? DEVNET_RPC : MAINNET_RPC;

      const connection = new Connection(rpcUrl, 'confirmed');
      const pubkey = new PublicKey(walletAddress);

      // Fetch SOL balance
      const solBalance = await connection.getBalance(pubkey);
      setSol(solBalance / LAMPORTS_PER_SOL);

      // Fetch ALL token accounts and find USDC-like tokens (6 decimals with balance)
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });

        // Find USDC-like token: 6 decimals and has balance
        // Prioritize known USDC mints, then fall back to any 6-decimal token with balance
        let bestUsdcAccount: { mint: string; balance: number } | null = null;

        for (const account of tokenAccounts.value) {
          const parsed = account.account.data.parsed.info;
          const mint = parsed.mint as string;
          const decimals = parsed.tokenAmount.decimals as number;
          const balance = parsed.tokenAmount.uiAmount as number;

          // Look for 6-decimal tokens with balance (USDC-like)
          if (decimals === 6 && balance > 0) {
            const isKnownUsdc = KNOWN_USDC_MINTS.includes(mint);

            // Prefer known USDC mints, otherwise take highest balance
            if (!bestUsdcAccount || isKnownUsdc || balance > bestUsdcAccount.balance) {
              bestUsdcAccount = { mint, balance };
              // If it's a known USDC mint, stop searching
              if (isKnownUsdc) break;
            }
          }
        }

        if (bestUsdcAccount) {
          setUsdc(bestUsdcAccount.balance);
          setUsdcMint(bestUsdcAccount.mint);
          console.log(`[useWalletBalance] Found USDC: ${bestUsdcAccount.balance} (mint: ${bestUsdcAccount.mint.slice(0, 8)}...)`);
        } else {
          setUsdc(0);
          setUsdcMint(null);
        }
      } catch (err) {
        console.error('[useWalletBalance] Error fetching token accounts:', err);
        setUsdc(0);
        setUsdcMint(null);
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      setError('Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, isDemo]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!walletAddress) return;

    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress, fetchBalance]);

  // In demo mode, allow trading if user has any SOL (for gas)
  // In production, require both SOL for fees and USDC for trade
  const hasEnoughForTrade = isDemo
    ? sol >= MIN_SOL_FOR_FEES // Demo: just need SOL for gas
    : sol >= MIN_SOL_FOR_FEES && usdc >= MIN_USDC_FOR_TRADE;

  return {
    sol,
    usdc,
    usdcMint,
    isLoading,
    error,
    hasEnoughForTrade,
    refetch: fetchBalance,
    network,
  };
}

// Format balance for display
export function formatBalance(amount: number, decimals: number = 2): string {
  if (amount === 0) return '0';
  if (amount < 0.01) return '<0.01';
  return amount.toFixed(decimals);
}

// Format USD value
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
