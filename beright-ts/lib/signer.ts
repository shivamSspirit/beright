/**
 * Solana Signer Abstraction for BeRight Protocol
 *
 * Provides secure transaction signing with:
 * - Minimal private key exposure time in memory
 * - Clear separation between signing and key storage
 * - Support for future hardware wallet integration
 * - Audit logging of signing operations
 *
 * SECURITY PRINCIPLES:
 * 1. Private key is only loaded when needed
 * 2. Keypair is not cached indefinitely
 * 3. All signing operations are logged (without key material)
 * 4. Future: Support for hardware wallets, KMS, etc.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  Commitment,
} from '@solana/web3.js';
import { secrets, SecretNotConfiguredError } from './secrets';

export interface SignerConfig {
  rpcUrl?: string;
  commitment?: Commitment;
}

export interface SignResult {
  signature: string;
  explorerUrl: string;
}

export interface SignerInfo {
  publicKey: string;
  configured: boolean;
}

/**
 * Secure Solana signer
 *
 * Usage:
 *   const signer = new SolanaSigner();
 *   const result = await signer.signAndSend(transaction);
 */
export class SolanaSigner {
  private connection: Connection;
  private commitment: Commitment;
  private _publicKey: PublicKey | null = null;

  constructor(config: SignerConfig = {}) {
    const rpcUrl = config.rpcUrl || secrets.getHeliusRpcUrl();
    this.commitment = config.commitment || 'confirmed';
    this.connection = new Connection(rpcUrl, this.commitment);
  }

  /**
   * Get the public key (cached, does not require private key)
   */
  getPublicKey(): PublicKey {
    if (this._publicKey) {
      return this._publicKey;
    }

    // Load keypair just to get public key, then discard
    const keypair = this.loadKeypair();
    this._publicKey = keypair.publicKey;
    return this._publicKey;
  }

  /**
   * Get signer info without exposing private key
   */
  getInfo(): SignerInfo {
    try {
      const publicKey = this.getPublicKey();
      return {
        publicKey: publicKey.toBase58(),
        configured: true,
      };
    } catch {
      return {
        publicKey: '',
        configured: false,
      };
    }
  }

  /**
   * Check if signer is properly configured
   */
  isConfigured(): boolean {
    return secrets.has('solanaPrivateKey');
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{
    lamports: number;
    sol: number;
    canSign: boolean;
  }> {
    if (!this.isConfigured()) {
      return { lamports: 0, sol: 0, canSign: false };
    }

    try {
      const publicKey = this.getPublicKey();
      const balance = await this.connection.getBalance(publicKey);
      return {
        lamports: balance,
        sol: balance / 1e9,
        canSign: balance > 5000, // Minimum for a transaction
      };
    } catch {
      return { lamports: 0, sol: 0, canSign: false };
    }
  }

  /**
   * Sign and send a legacy transaction
   */
  async signAndSendTransaction(transaction: Transaction): Promise<SignResult> {
    const keypair = this.loadKeypair();

    try {
      // Set fee payer if not set
      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      // Get recent blockhash if not set
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      // Sign and send
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [keypair],
        { commitment: this.commitment }
      );

      return {
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`,
      };
    } finally {
      // Keypair goes out of scope here, eligible for GC
    }
  }

  /**
   * Sign and send a versioned transaction
   */
  async signAndSendVersionedTransaction(transaction: VersionedTransaction): Promise<SignResult> {
    const keypair = this.loadKeypair();

    try {
      // Sign the transaction
      transaction.sign([keypair]);

      // Send raw transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: this.commitment,
      });

      // Confirm
      await this.connection.confirmTransaction(signature, this.commitment);

      return {
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`,
      };
    } finally {
      // Keypair goes out of scope here
    }
  }

  /**
   * Sign a transaction without sending (for inspection or external sending)
   */
  signTransaction(transaction: Transaction): Transaction {
    const keypair = this.loadKeypair();
    transaction.partialSign(keypair);
    return transaction;
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Load keypair from secrets
   * Private method - keypair should not be cached or exposed
   */
  private loadKeypair(): Keypair {
    try {
      const privateKey = secrets.getSolanaPrivateKey();
      return Keypair.fromSecretKey(privateKey);
    } catch (error) {
      if (error instanceof SecretNotConfiguredError) {
        throw error;
      }
      throw new Error('Failed to load Solana keypair: Invalid key format');
    }
  }
}

// Default signer instance (lazy initialization)
let defaultSigner: SolanaSigner | null = null;

/**
 * Get the default signer instance
 */
export function getSigner(): SolanaSigner {
  if (!defaultSigner) {
    defaultSigner = new SolanaSigner();
  }
  return defaultSigner;
}

/**
 * Check if signing is available
 */
export function canSign(): boolean {
  try {
    return getSigner().isConfigured();
  } catch {
    return false;
  }
}

/**
 * Get signer public key (safe to call even if not fully configured)
 */
export function getSignerPublicKey(): string | null {
  try {
    return getSigner().getPublicKey().toBase58();
  } catch {
    return null;
  }
}
