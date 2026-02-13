'use client';

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// USDC token mint on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// Token program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

interface WalletBalance {
  sol: number;
  usdc: number;
  isLoading: boolean;
  error: string | null;
  hasEnoughForTrade: boolean;
  refetch: () => Promise<void>;
}

// Minimum amounts for trading
const MIN_SOL_FOR_FEES = 0.01; // ~$2 for transaction fees
const MIN_USDC_FOR_TRADE = 1; // $1 minimum trade

export function useWalletBalance(walletAddress: string | null): WalletBalance {
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setSol(0);
      setUsdc(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const pubkey = new PublicKey(walletAddress);

      // Fetch SOL balance
      const solBalance = await connection.getBalance(pubkey);
      setSol(solBalance / LAMPORTS_PER_SOL);

      // Fetch USDC token account
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
          mint: USDC_MINT,
        });

        if (tokenAccounts.value.length > 0) {
          const usdcAccount = tokenAccounts.value[0];
          const usdcBalance = usdcAccount.account.data.parsed.info.tokenAmount.uiAmount;
          setUsdc(usdcBalance || 0);
        } else {
          setUsdc(0);
        }
      } catch {
        // No USDC account exists
        setUsdc(0);
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      setError('Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

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

  const hasEnoughForTrade = sol >= MIN_SOL_FOR_FEES && usdc >= MIN_USDC_FOR_TRADE;

  return {
    sol,
    usdc,
    isLoading,
    error,
    hasEnoughForTrade,
    refetch: fetchBalance,
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
