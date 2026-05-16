'use client';

import { createContext, ReactNode, useContext } from 'react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

export type BerightWalletProviderId = 'jupiter' | 'privy' | 'unknown';

export type BerightSignableTransaction =
  | Transaction
  | VersionedTransaction
  | Uint8Array;

export interface BerightWalletContextValue {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  walletName: string | null;
  provider: BerightWalletProviderId;
  signTransaction?: (tx: BerightSignableTransaction) => Promise<BerightSignableTransaction>;
  disconnect?: () => Promise<void>;
  login?: () => Promise<void>;
  logout?: () => Promise<void>;
}

const DEFAULT_WALLET_CONTEXT: BerightWalletContextValue = {
  connected: false,
  connecting: false,
  publicKey: null,
  walletName: null,
  provider: 'unknown',
};

const BerightWalletContext = createContext<BerightWalletContextValue>(DEFAULT_WALLET_CONTEXT);

export function BerightWalletProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BerightWalletContextValue;
}) {
  return (
    <BerightWalletContext.Provider value={value}>
      {children}
    </BerightWalletContext.Provider>
  );
}

export function useBerightWallet(): BerightWalletContextValue {
  return useContext(BerightWalletContext);
}
