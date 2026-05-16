/**
 * DFlow Wallet Abstraction
 *
 * Unified wallet interface for different wallet types:
 * - Keypair (server-side, bots, agents)
 * - Privy (embedded wallets for web)
 * - Phantom/Solflare (browser extensions)
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

// Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// =============================================================================
// CONFIGURATION
// =============================================================================

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const WALLETS_FILE = path.join(MEMORY_DIR, 'telegram_wallets.json');

// =============================================================================
// TYPES
// =============================================================================

export interface WalletProvider {
  type: 'keypair' | 'privy' | 'phantom' | 'adapter';
  publicKey: PublicKey;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
  signAllTransactions?(txs: VersionedTransaction[]): Promise<VersionedTransaction[]>;
}

export interface WalletBalance {
  sol: number;
  usdc: number;
  updatedAt: Date;
}

export interface StoredWallet {
  id: string; // Telegram ID or user identifier
  publicKey: string;
  encryptedSecretKey: string; // Base58 encoded
  createdAt: string;
  lastUsed?: string;
}

// =============================================================================
// KEYPAIR WALLET PROVIDER
// =============================================================================

export class KeypairWallet implements WalletProvider {
  type: 'keypair' = 'keypair';
  publicKey: PublicKey;
  private keypair: Keypair;

  constructor(keypair: Keypair) {
    this.keypair = keypair;
    this.publicKey = keypair.publicKey;
  }

  async signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> {
    tx.sign([this.keypair]);
    return tx;
  }

  async signAllTransactions(txs: VersionedTransaction[]): Promise<VersionedTransaction[]> {
    for (const tx of txs) {
      tx.sign([this.keypair]);
    }
    return txs;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  /**
   * Create from environment variable
   */
  static fromEnv(envKey: string = 'SOLANA_PRIVATE_KEY'): KeypairWallet | null {
    const privateKey = process.env[envKey];
    if (!privateKey) {
      return null;
    }

    try {
      // Support both base58 and JSON array format
      let secretKey: Uint8Array;

      if (privateKey.startsWith('[')) {
        // JSON array format
        secretKey = Uint8Array.from(JSON.parse(privateKey));
      } else {
        // Base58 format
        secretKey = bs58.decode(privateKey);
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      return new KeypairWallet(keypair);
    } catch (error) {
      console.error('[KeypairWallet] Failed to load from env:', error);
      return null;
    }
  }

  /**
   * Create from base58 encoded secret key
   */
  static fromBase58(secretKeyBase58: string): KeypairWallet {
    const secretKey = bs58.decode(secretKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    return new KeypairWallet(keypair);
  }

  /**
   * Generate a new random keypair
   */
  static generate(): KeypairWallet {
    const keypair = Keypair.generate();
    return new KeypairWallet(keypair);
  }
}

// =============================================================================
// ADAPTER WALLET PROVIDER (for browser wallets)
// =============================================================================

export interface WalletAdapterInterface {
  publicKey: PublicKey | null;
  signTransaction<T extends VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions?<T extends VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export class AdapterWallet implements WalletProvider {
  type: 'adapter' = 'adapter';
  publicKey: PublicKey;
  private adapter: WalletAdapterInterface;

  constructor(adapter: WalletAdapterInterface) {
    if (!adapter.publicKey) {
      throw new Error('Wallet not connected');
    }
    this.adapter = adapter;
    this.publicKey = adapter.publicKey;
  }

  async signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> {
    return this.adapter.signTransaction(tx);
  }

  async signAllTransactions(txs: VersionedTransaction[]): Promise<VersionedTransaction[]> {
    if (this.adapter.signAllTransactions) {
      return this.adapter.signAllTransactions(txs);
    }
    // Fallback to signing one by one
    return Promise.all(txs.map(tx => this.adapter.signTransaction(tx)));
  }
}

// =============================================================================
// TELEGRAM WALLET STORAGE
// =============================================================================

export class TelegramWalletStore {
  private wallets: Map<string, StoredWallet> = new Map();

  constructor() {
    this.load();
  }

  /**
   * Load wallets from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(WALLETS_FILE)) {
        const data = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf-8'));
        for (const [id, wallet] of Object.entries(data)) {
          this.wallets.set(id, wallet as StoredWallet);
        }
        console.log(`[TelegramWalletStore] Loaded ${this.wallets.size} wallets`);
      }
    } catch (error) {
      console.error('[TelegramWalletStore] Failed to load wallets:', error);
    }
  }

  /**
   * Save wallets to disk
   */
  private save(): void {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }

      const data: Record<string, StoredWallet> = {};
      this.wallets.forEach((wallet, id) => {
        data[id] = wallet;
      });

      fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[TelegramWalletStore] Failed to save wallets:', error);
    }
  }

  /**
   * Get or create wallet for a user
   */
  getOrCreate(userId: string): { wallet: KeypairWallet; isNew: boolean } {
    const existing = this.wallets.get(userId);

    if (existing) {
      try {
        const secretKey = bs58.decode(existing.encryptedSecretKey);
        const keypair = Keypair.fromSecretKey(secretKey);

        // Update last used
        existing.lastUsed = new Date().toISOString();
        this.save();

        return {
          wallet: new KeypairWallet(keypair),
          isNew: false,
        };
      } catch (error) {
        console.error(`[TelegramWalletStore] Failed to load wallet for ${userId}:`, error);
      }
    }

    // Create new wallet
    const keypair = Keypair.generate();
    const stored: StoredWallet = {
      id: userId,
      publicKey: keypair.publicKey.toBase58(),
      encryptedSecretKey: bs58.encode(keypair.secretKey),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    this.wallets.set(userId, stored);
    this.save();

    console.log(`[TelegramWalletStore] Created new wallet for ${userId}: ${stored.publicKey}`);

    return {
      wallet: new KeypairWallet(keypair),
      isNew: true,
    };
  }

  /**
   * Get wallet if exists
   */
  get(userId: string): KeypairWallet | null {
    const stored = this.wallets.get(userId);
    if (!stored) return null;

    try {
      const secretKey = bs58.decode(stored.encryptedSecretKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      return new KeypairWallet(keypair);
    } catch {
      return null;
    }
  }

  /**
   * Get public key for a user (doesn't require decryption)
   */
  getPublicKey(userId: string): string | null {
    const stored = this.wallets.get(userId);
    return stored?.publicKey || null;
  }

  /**
   * Check if user has a wallet
   */
  exists(userId: string): boolean {
    return this.wallets.has(userId);
  }

  /**
   * Get all wallet public keys
   */
  getAllPublicKeys(): string[] {
    const keys: string[] = [];
    this.wallets.forEach(w => keys.push(w.publicKey));
    return keys;
  }
}

// =============================================================================
// BALANCE UTILITIES
// =============================================================================

/**
 * Derive associated token address (without spl-token dependency)
 */
function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

/**
 * Get SOL and USDC balance for a wallet
 */
export async function getWalletBalance(
  connection: Connection,
  publicKey: PublicKey | string
): Promise<WalletBalance> {
  const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;

  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(pubkey);

    // Get USDC balance using parsed account
    let usdcBalance = 0;
    try {
      const usdcMint = new PublicKey(USDC_MINT);
      const tokenAccount = getAssociatedTokenAddress(usdcMint, pubkey);

      const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
      if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
        const parsed = accountInfo.value.data.parsed;
        if (parsed.info?.tokenAmount?.uiAmount) {
          usdcBalance = parsed.info.tokenAmount.uiAmount;
        }
      }
    } catch (error) {
      // Token account doesn't exist = 0 balance
      console.debug('[getWalletBalance] USDC account not found (0 balance)');
    }

    return {
      sol: solBalance / LAMPORTS_PER_SOL,
      usdc: usdcBalance,
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('[getWalletBalance] Failed:', error);
    return {
      sol: 0,
      usdc: 0,
      updatedAt: new Date(),
    };
  }
}

/**
 * Get balance for any SPL token
 */
export async function getTokenBalance(
  connection: Connection,
  publicKey: PublicKey | string,
  tokenMint: PublicKey | string
): Promise<number> {
  const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
  const mint = typeof tokenMint === 'string' ? new PublicKey(tokenMint) : tokenMint;

  try {
    const tokenAccount = getAssociatedTokenAddress(mint, pubkey);
    const accountInfo = await connection.getParsedAccountInfo(tokenAccount);

    if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
      const parsed = accountInfo.value.data.parsed;
      return parsed.info?.tokenAmount?.uiAmount || 0;
    }

    return 0;
  } catch (error) {
    console.debug('[getTokenBalance] Token account not found');
    return 0;
  }
}

/**
 * Get all token accounts for a wallet
 */
export async function getAllTokenAccounts(
  connection: Connection,
  publicKey: PublicKey | string
): Promise<Array<{ mint: string; balance: number; decimals: number }>> {
  const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;

  try {
    const response = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    return response.value.map(account => {
      const parsed = account.account.data.parsed.info;
      return {
        mint: parsed.mint,
        balance: parsed.tokenAmount.uiAmount || 0,
        decimals: parsed.tokenAmount.decimals,
      };
    });
  } catch (error) {
    console.error('[getAllTokenAccounts] Failed:', error);
    return [];
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

let telegramWalletStore: TelegramWalletStore | null = null;

export function getTelegramWalletStore(): TelegramWalletStore {
  if (!telegramWalletStore) {
    telegramWalletStore = new TelegramWalletStore();
  }
  return telegramWalletStore;
}

/**
 * Get the default trading wallet (from env)
 */
export function getDefaultTradingWallet(): KeypairWallet | null {
  return KeypairWallet.fromEnv('SOLANA_PRIVATE_KEY');
}
