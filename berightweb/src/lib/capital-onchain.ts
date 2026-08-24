'use client';

import { Connection, Transaction } from '@solana/web3.js';
import type { BerightSignableTransaction } from '@/context/BerightWalletContext';
import type { PreparedCapitalVaultTransaction } from '@/lib/api';

const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_CAPITAL_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';

export async function signAndSendCapitalTransaction(input: {
  prepared: PreparedCapitalVaultTransaction;
  signTransaction?: (transaction: BerightSignableTransaction) => Promise<BerightSignableTransaction>;
}): Promise<string> {
  if (!input.signTransaction) throw new Error('The connected wallet does not support transaction signing.');
  if (input.prepared.network !== 'devnet') throw new Error('Capital transactions are restricted to Solana devnet.');

  const transaction = Transaction.from(decodeBase64(input.prepared.transaction));
  const signed = await input.signTransaction(transaction);
  const signedTransaction = normalizeSignedTransaction(signed);
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const simulation = await connection.simulateTransaction(signedTransaction);
  if (simulation.value.err) {
    const detail = simulation.value.logs?.slice(-3).join(' · ');
    throw new Error(`Devnet simulation failed${detail ? `: ${detail}` : '.'}`);
  }
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    maxRetries: 3,
    skipPreflight: false,
  });
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: input.prepared.recentBlockhash,
    lastValidBlockHeight: input.prepared.lastValidBlockHeight,
  }, 'confirmed');
  if (confirmation.value.err) throw new Error('The devnet transaction failed during confirmation.');
  return signature;
}

function normalizeSignedTransaction(value: BerightSignableTransaction): Transaction {
  if (value instanceof Transaction) return value;
  if (value instanceof Uint8Array) return Transaction.from(value);
  throw new Error('Capital currently requires a wallet that signs legacy Solana transactions.');
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
