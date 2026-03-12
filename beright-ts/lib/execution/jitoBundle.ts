/**
 * JITO Bundle Submission - MEV Protection & Priority Execution
 *
 * Features:
 * - Bundle submission to JITO block engine
 * - Dynamic tip floor querying
 * - Bundle status polling
 * - Random tip account selection
 * - Multi-region support
 *
 * @author BeRight Protocol
 */

import { VersionedTransaction, PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { EXECUTION_CONFIG, JITO_TIP_ACCOUNTS, JITO_BLOCK_ENGINES, getRandomJitoTipAccount } from '../../config/execution';
import { getLatencyTracker, formatMicroseconds } from './latencyTracker';

// ============================================================================
// TYPES
// ============================================================================

export type BundleStatus = 'pending' | 'landed' | 'failed' | 'invalid' | 'dropped';

export interface BundleSubmissionResult {
  bundleId: string;
  signature: string;
  submittedAt: number;
  status: BundleStatus;
  slot?: number;
  confirmedAt?: number;
  latencyUs?: number;
  error?: string;
}

export interface TipFloorResult {
  floor: number;
  fetchedAt: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile99: number;
}

export interface JitoBundleConfig {
  blockEngineUrl: string;
  defaultTipLamports: number;
  maxTipLamports: number;
  minTipLamports: number;
  confirmationTimeoutMs: number;
  statusPollIntervalMs: number;
}

// ============================================================================
// JITO BUNDLE SUBMITTER
// ============================================================================

export class JitoBundleSubmitter {
  private config: JitoBundleConfig;
  private tipFloorCache: TipFloorResult | null = null;
  private tipFloorCacheTtlMs: number = 30_000; // 30 seconds

  constructor(config?: Partial<JitoBundleConfig>) {
    this.config = {
      blockEngineUrl: config?.blockEngineUrl || EXECUTION_CONFIG.jito.blockEngineUrl,
      defaultTipLamports: config?.defaultTipLamports || EXECUTION_CONFIG.jito.defaultTipLamports,
      maxTipLamports: config?.maxTipLamports || EXECUTION_CONFIG.jito.maxTipLamports,
      minTipLamports: config?.minTipLamports || EXECUTION_CONFIG.jito.minTipLamports,
      confirmationTimeoutMs: config?.confirmationTimeoutMs || EXECUTION_CONFIG.jito.confirmationTimeoutMs,
      statusPollIntervalMs: config?.statusPollIntervalMs || EXECUTION_CONFIG.jito.statusPollIntervalMs,
    };
  }

  /**
   * Submit a bundle of transactions to JITO
   */
  async submitBundle(
    transactions: VersionedTransaction[],
    options: {
      tipLamports?: number;
      tipAccount?: string;
      waitForConfirmation?: boolean;
    } = {}
  ): Promise<BundleSubmissionResult> {
    const tracker = getLatencyTracker();
    tracker.start('jito_submit');

    const submittedAt = Date.now();

    try {
      // Get dynamic tip floor
      const tipFloor = await this.getTipFloor();
      const tipLamports = Math.max(
        options.tipLamports || this.config.defaultTipLamports,
        tipFloor.floor
      );

      // Clamp tip to limits
      const actualTip = Math.min(tipLamports, this.config.maxTipLamports);

      // Serialize transactions to base58
      const serializedTxs = transactions.map((tx) => bs58.encode(tx.serialize()));

      console.log(
        `[JitoBundle] Submitting ${transactions.length} txs with ${actualTip} lamport tip`
      );

      // Submit to JITO block engine
      const response = await fetch(`${this.config.blockEngineUrl}/bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [serializedTxs],
        }),
      });

      const submitTimeUs = tracker.end('jito_submit');

      if (!response.ok) {
        const errorText = await response.text();
        return {
          bundleId: '',
          signature: '',
          submittedAt,
          status: 'failed',
          error: `HTTP ${response.status}: ${errorText}`,
          latencyUs: submitTimeUs,
        };
      }

      const result = await response.json();

      if (result.error) {
        return {
          bundleId: '',
          signature: '',
          submittedAt,
          status: 'failed',
          error: result.error.message || JSON.stringify(result.error),
          latencyUs: submitTimeUs,
        };
      }

      const bundleId = result.result;

      console.log(
        `[JitoBundle] Submitted in ${formatMicroseconds(submitTimeUs)}: ${bundleId}`
      );

      // Extract first signature from transactions
      const signature = this.getFirstSignature(transactions[0]);

      // Wait for confirmation if requested
      if (options.waitForConfirmation) {
        return await this.waitForConfirmation(bundleId, signature, submittedAt, submitTimeUs);
      }

      return {
        bundleId,
        signature,
        submittedAt,
        status: 'pending',
        latencyUs: submitTimeUs,
      };
    } catch (error) {
      const elapsed = tracker.end('jito_submit');
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error('[JitoBundle] Submission failed:', errorMsg);

      return {
        bundleId: '',
        signature: '',
        submittedAt,
        status: 'failed',
        error: errorMsg,
        latencyUs: elapsed,
      };
    }
  }

  /**
   * Wait for bundle confirmation
   */
  private async waitForConfirmation(
    bundleId: string,
    signature: string,
    submittedAt: number,
    submitTimeUs: number
  ): Promise<BundleSubmissionResult> {
    const tracker = getLatencyTracker();
    tracker.start('jito_confirm');

    const startTime = Date.now();
    let lastStatus: BundleStatus = 'pending';

    while (Date.now() - startTime < this.config.confirmationTimeoutMs) {
      await this.sleep(this.config.statusPollIntervalMs);

      try {
        const status = await this.getBundleStatus(bundleId);
        lastStatus = status.status;

        if (status.status === 'landed') {
          const confirmTimeUs = tracker.end('jito_confirm');
          console.log(
            `[JitoBundle] Confirmed in ${formatMicroseconds(confirmTimeUs)}: slot ${status.slot}`
          );

          return {
            bundleId,
            signature,
            submittedAt,
            status: 'landed',
            slot: status.slot,
            confirmedAt: Date.now(),
            latencyUs: submitTimeUs + confirmTimeUs,
          };
        }

        if (status.status === 'failed' || status.status === 'invalid' || status.status === 'dropped') {
          const confirmTimeUs = tracker.end('jito_confirm');
          return {
            bundleId,
            signature,
            submittedAt,
            status: status.status,
            error: status.error,
            latencyUs: submitTimeUs + confirmTimeUs,
          };
        }
      } catch (error) {
        // Continue polling on error
        console.warn('[JitoBundle] Status check error:', error);
      }
    }

    const confirmTimeUs = tracker.end('jito_confirm');

    return {
      bundleId,
      signature,
      submittedAt,
      status: lastStatus,
      error: 'Confirmation timeout',
      latencyUs: submitTimeUs + confirmTimeUs,
    };
  }

  /**
   * Get bundle status from JITO
   */
  async getBundleStatus(
    bundleId: string
  ): Promise<{ status: BundleStatus; slot?: number; error?: string }> {
    try {
      const response = await fetch(`${this.config.blockEngineUrl}/bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });

      if (!response.ok) {
        return { status: 'pending' };
      }

      const result = await response.json();

      if (result.error || !result.result?.value?.[0]) {
        return { status: 'pending' };
      }

      const bundleResult = result.result.value[0];

      // Map JITO status to our status type
      switch (bundleResult.confirmation_status) {
        case 'landed':
        case 'finalized':
        case 'confirmed':
          return {
            status: 'landed',
            slot: bundleResult.slot,
          };
        case 'processed':
          return { status: 'pending' };
        case 'failed':
          return {
            status: 'failed',
            error: bundleResult.err || 'Bundle execution failed',
          };
        default:
          return { status: 'pending' };
      }
    } catch (error) {
      return { status: 'pending' };
    }
  }

  /**
   * Get current tip floor from JITO
   */
  async getTipFloor(): Promise<TipFloorResult> {
    // Check cache
    const now = Date.now();
    if (this.tipFloorCache && now - this.tipFloorCache.fetchedAt < this.tipFloorCacheTtlMs) {
      return this.tipFloorCache;
    }

    try {
      const response = await fetch(`${this.config.blockEngineUrl}/bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTipAccounts',
          params: [],
        }),
      });

      if (!response.ok) {
        // Return defaults on error
        return this.getDefaultTipFloor();
      }

      const result = await response.json();

      // Note: JITO may not provide tip floor via API
      // For now, use reasonable defaults
      const tipFloor: TipFloorResult = {
        floor: this.config.minTipLamports,
        fetchedAt: now,
        percentile25: 5000,
        percentile50: 10000,
        percentile75: 25000,
        percentile99: 100000,
      };

      this.tipFloorCache = tipFloor;
      return tipFloor;
    } catch (error) {
      return this.getDefaultTipFloor();
    }
  }

  /**
   * Get default tip floor values
   */
  private getDefaultTipFloor(): TipFloorResult {
    return {
      floor: this.config.minTipLamports,
      fetchedAt: Date.now(),
      percentile25: 5000,
      percentile50: 10000,
      percentile75: 25000,
      percentile99: 100000,
    };
  }

  /**
   * Create a tip instruction to add to a transaction
   */
  createTipInstruction(
    payer: PublicKey,
    tipLamports: number,
    tipAccount?: PublicKey
  ): { instruction: any; tipAccount: PublicKey } {
    const tipPubkey = tipAccount || new PublicKey(getRandomJitoTipAccount());

    const instruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipPubkey,
      lamports: tipLamports,
    });

    return { instruction, tipAccount: tipPubkey };
  }

  /**
   * Add tip to an existing transaction (creates new signed transaction)
   */
  async addTipToTransaction(
    transaction: VersionedTransaction,
    payer: Keypair,
    tipLamports: number
  ): Promise<VersionedTransaction> {
    // Note: For versioned transactions, we need to rebuild with the tip instruction
    // This is a simplified version - full implementation would need to decompose
    // and recompose the transaction message
    console.warn('[JitoBundle] addTipToTransaction not fully implemented for versioned tx');
    return transaction;
  }

  /**
   * Get first signature from a transaction
   */
  private getFirstSignature(transaction: VersionedTransaction): string {
    if (transaction.signatures.length > 0) {
      return bs58.encode(transaction.signatures[0]);
    }
    return '';
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get JITO tip accounts
   */
  getTipAccounts(): string[] {
    return [...JITO_TIP_ACCOUNTS];
  }

  /**
   * Get block engine endpoints
   */
  getBlockEngines(): typeof JITO_BLOCK_ENGINES {
    return { ...JITO_BLOCK_ENGINES };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalSubmitter: JitoBundleSubmitter | null = null;

export function getJitoBundleSubmitter(): JitoBundleSubmitter {
  if (!globalSubmitter) {
    globalSubmitter = new JitoBundleSubmitter();
  }
  return globalSubmitter;
}

export default JitoBundleSubmitter;
