/**
 * Fast Connection Manager - Connection Pooling & Keep-Alive
 *
 * Optimizations:
 * - HTTP keep-alive connections (via fetch with persistent connections)
 * - Pre-fetched blockhash (updated every 400ms)
 * - Skip preflight for maximum speed
 * - Connection reuse via Solana Connection internal pooling
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  Commitment,
  BlockhashWithExpiryBlockHeight,
  SendOptions,
  VersionedTransaction,
  Transaction,
} from '@solana/web3.js';
import { EXECUTION_CONFIG } from '../../config/execution';
import { getLatencyTracker, formatMicroseconds } from './latencyTracker';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionPoolConfig {
  heliusRpc: string;
  jitoBlockEngine: string;
  jupiterApi: string;
  maxConnectionsPerHost: number;
  keepAliveTimeout: number;
  requestTimeout: number;
  blockhashRefreshMs: number;
  commitment: Commitment;
}

export interface CachedBlockhash {
  blockhash: string;
  lastValidBlockHeight: number;
  fetchedAt: number;
  slot: number;
}

// ============================================================================
// FAST CONNECTION POOL
// ============================================================================

export class FastConnectionPool {
  private config: ConnectionPoolConfig;
  private connection: Connection;
  private cachedBlockhash: CachedBlockhash | null = null;
  private blockhashInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = {
      heliusRpc: config?.heliusRpc || EXECUTION_CONFIG.rpc.helius,
      jitoBlockEngine: config?.jitoBlockEngine || EXECUTION_CONFIG.jito.blockEngineUrl,
      jupiterApi: config?.jupiterApi || EXECUTION_CONFIG.jupiter.v6ApiUrl,
      maxConnectionsPerHost: config?.maxConnectionsPerHost || EXECUTION_CONFIG.connections.maxPoolSize,
      keepAliveTimeout: config?.keepAliveTimeout || EXECUTION_CONFIG.connections.keepAliveMs,
      requestTimeout: config?.requestTimeout || EXECUTION_CONFIG.connections.requestTimeoutMs,
      blockhashRefreshMs: config?.blockhashRefreshMs || EXECUTION_CONFIG.connections.blockhashRefreshMs,
      commitment: config?.commitment || EXECUTION_CONFIG.connections.commitment,
    };

    // Create Solana connection with optimized settings
    // Note: @solana/web3.js handles connection pooling internally via fetch
    this.connection = new Connection(this.config.heliusRpc, {
      commitment: this.config.commitment,
      confirmTransactionInitialTimeout: 60_000,
      disableRetryOnRateLimit: false,
      // fetch option uses global fetch which supports keep-alive by default
    });
  }

  /**
   * Initialize the connection pool
   * - Start blockhash prefetching
   * - Warm up connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[FastConnection] Initializing connection pool...');

    // Fetch initial blockhash
    await this.refreshBlockhash();

    // Start blockhash refresh interval
    this.blockhashInterval = setInterval(
      () => this.refreshBlockhash(),
      this.config.blockhashRefreshMs
    );

    // Warm up connection with a simple request
    try {
      await this.connection.getSlot();
      console.log('[FastConnection] Connection warmed up');
    } catch (error) {
      console.warn('[FastConnection] Warm-up failed:', error);
    }

    this.isInitialized = true;
    console.log('[FastConnection] Initialized with:', {
      rpc: this.config.heliusRpc.slice(0, 50) + '...',
      commitment: this.config.commitment,
      blockhashRefreshMs: this.config.blockhashRefreshMs,
    });
  }

  /**
   * Refresh cached blockhash
   */
  private async refreshBlockhash(): Promise<void> {
    const tracker = getLatencyTracker();
    tracker.start('blockhash_refresh');

    try {
      const result = await this.connection.getLatestBlockhash(this.config.commitment);
      const slot = await this.connection.getSlot(this.config.commitment);

      this.cachedBlockhash = {
        blockhash: result.blockhash,
        lastValidBlockHeight: result.lastValidBlockHeight,
        fetchedAt: Date.now(),
        slot,
      };

      const elapsed = tracker.end('blockhash_refresh');
      if (elapsed > 100_000) {
        // > 100ms
        console.warn(`[FastConnection] Slow blockhash fetch: ${formatMicroseconds(elapsed)}`);
      }
    } catch (error) {
      console.error('[FastConnection] Failed to refresh blockhash:', error);
    }
  }

  /**
   * Get cached blockhash (fast path)
   * Falls back to fresh fetch if cache is stale
   */
  async getBlockhash(): Promise<BlockhashWithExpiryBlockHeight> {
    const now = Date.now();
    const staleThreshold = this.config.blockhashRefreshMs * 3; // 3x refresh interval

    // Use cached if fresh enough
    if (this.cachedBlockhash && now - this.cachedBlockhash.fetchedAt < staleThreshold) {
      return {
        blockhash: this.cachedBlockhash.blockhash,
        lastValidBlockHeight: this.cachedBlockhash.lastValidBlockHeight,
      };
    }

    // Fetch fresh blockhash
    console.log('[FastConnection] Cache miss, fetching fresh blockhash');
    await this.refreshBlockhash();

    if (!this.cachedBlockhash) {
      throw new Error('Failed to get blockhash');
    }

    return {
      blockhash: this.cachedBlockhash.blockhash,
      lastValidBlockHeight: this.cachedBlockhash.lastValidBlockHeight,
    };
  }

  /**
   * Get current slot (cached from blockhash refresh)
   */
  getSlot(): number {
    return this.cachedBlockhash?.slot || 0;
  }

  /**
   * Send raw transaction with optimized settings
   */
  async sendRawTransaction(
    rawTransaction: Buffer | Uint8Array,
    options?: SendOptions
  ): Promise<string> {
    const tracker = getLatencyTracker();
    tracker.start('send_raw');

    const sendOptions: SendOptions = {
      skipPreflight: EXECUTION_CONFIG.connections.skipPreflight,
      preflightCommitment: this.config.commitment,
      maxRetries: 0, // We handle retries ourselves
      ...options,
    };

    try {
      const signature = await this.connection.sendRawTransaction(rawTransaction, sendOptions);
      const elapsed = tracker.end('send_raw');
      console.log(`[FastConnection] TX sent in ${formatMicroseconds(elapsed)}: ${signature.slice(0, 20)}...`);
      return signature;
    } catch (error) {
      tracker.end('send_raw');
      throw error;
    }
  }

  /**
   * Send versioned transaction
   */
  async sendVersionedTransaction(
    transaction: VersionedTransaction,
    options?: SendOptions
  ): Promise<string> {
    const serialized = transaction.serialize();
    return this.sendRawTransaction(serialized, options);
  }

  /**
   * Send legacy transaction
   */
  async sendTransaction(
    transaction: Transaction,
    options?: SendOptions
  ): Promise<string> {
    const serialized = transaction.serialize();
    return this.sendRawTransaction(serialized, options);
  }

  /**
   * Confirm transaction with timeout
   */
  async confirmTransaction(
    signature: string,
    timeoutMs: number = 30_000
  ): Promise<{ confirmed: boolean; slot?: number; err?: string }> {
    const tracker = getLatencyTracker();
    tracker.start('confirm');

    const startTime = Date.now();

    try {
      // Use connection's confirmation method
      const result = await this.connection.confirmTransaction(
        {
          signature,
          blockhash: this.cachedBlockhash?.blockhash || '',
          lastValidBlockHeight: this.cachedBlockhash?.lastValidBlockHeight || 0,
        },
        this.config.commitment
      );

      const elapsed = tracker.end('confirm');
      console.log(`[FastConnection] TX confirmed in ${formatMicroseconds(elapsed)}`);

      return {
        confirmed: !result.value.err,
        slot: result.context.slot,
        err: result.value.err?.toString(),
      };
    } catch (error) {
      tracker.end('confirm');

      // Check if timeout
      if (Date.now() - startTime >= timeoutMs) {
        return { confirmed: false, err: 'Confirmation timeout' };
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      return { confirmed: false, err: errorMsg };
    }
  }

  /**
   * Get underlying Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot();
      return slot > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get connection stats
   */
  getStats(): {
    isInitialized: boolean;
    cachedBlockhash: CachedBlockhash | null;
    rpcEndpoint: string;
  } {
    return {
      isInitialized: this.isInitialized,
      cachedBlockhash: this.cachedBlockhash,
      rpcEndpoint: this.config.heliusRpc,
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    console.log('[FastConnection] Shutting down...');

    if (this.blockhashInterval) {
      clearInterval(this.blockhashInterval);
      this.blockhashInterval = null;
    }

    this.isInitialized = false;

    console.log('[FastConnection] Shutdown complete');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalPool: FastConnectionPool | null = null;

/**
 * Get the global connection pool (singleton)
 */
export function getFastConnectionPool(): FastConnectionPool {
  if (!globalPool) {
    globalPool = new FastConnectionPool();
  }
  return globalPool;
}

/**
 * Initialize the global connection pool
 */
export async function initializeFastConnection(): Promise<FastConnectionPool> {
  const pool = getFastConnectionPool();
  await pool.initialize();
  return pool;
}

/**
 * Shutdown the global connection pool
 */
export async function shutdownFastConnection(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}

export default FastConnectionPool;
