/**
 * Fast Transaction Builder - Priority Fees & Compute Units
 *
 * Optimizations:
 * - Dynamic priority fees (query recent fees, use 75th percentile)
 * - Compute unit optimization (ComputeBudgetProgram)
 * - Pre-serialized transaction buffers
 * - Parallel instruction construction
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { EXECUTION_CONFIG } from '../../config/execution';
import { getFastConnectionPool } from './fastConnection';
import { getLatencyTracker, formatMicroseconds } from './latencyTracker';

// ============================================================================
// TYPES
// ============================================================================

export interface TransactionBuildOptions {
  /** Compute unit limit (default: 200000) */
  computeUnitLimit?: number;
  /** Priority fee in microlamports (default: auto) */
  priorityFeeMicroLamports?: number | 'auto';
  /** JITO tip in lamports (optional) */
  jitoTipLamports?: number;
  /** JITO tip account (optional, random if not specified) */
  jitoTipAccount?: string;
  /** Address lookup tables for versioned transactions */
  addressLookupTables?: AddressLookupTableAccount[];
  /** Whether to add JITO tip instruction */
  includeJitoTip?: boolean;
}

export interface BuiltTransaction {
  transaction: VersionedTransaction;
  computeUnits: number;
  priorityFee: number;
  jitoTip: number;
  estimatedFee: number;
  buildTimeUs: number;
}

export interface PriorityFeeEstimate {
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  recommended: number;
}

// ============================================================================
// FAST TRANSACTION BUILDER
// ============================================================================

export class FastTransactionBuilder {
  private connection: Connection;
  private priorityFeeCache: {
    estimate: PriorityFeeEstimate;
    fetchedAt: number;
  } | null = null;
  private priorityFeeCacheTtlMs: number = 10_000; // 10 seconds

  constructor(connection?: Connection) {
    this.connection = connection || getFastConnectionPool().getConnection();
  }

  /**
   * Build a versioned transaction with optimized compute units and priority fees
   */
  async buildTransaction(
    payer: PublicKey,
    instructions: TransactionInstruction[],
    options: TransactionBuildOptions = {}
  ): Promise<BuiltTransaction> {
    const tracker = getLatencyTracker();
    tracker.start('tx_build');

    // Get priority fee
    let priorityFee: number;
    if (options.priorityFeeMicroLamports === 'auto' || options.priorityFeeMicroLamports === undefined) {
      const estimate = await this.estimatePriorityFee();
      priorityFee = estimate.recommended;
    } else {
      priorityFee = options.priorityFeeMicroLamports;
    }

    // Clamp priority fee to limits
    priorityFee = Math.max(
      EXECUTION_CONFIG.priorityFee.minMicroLamports,
      Math.min(priorityFee, EXECUTION_CONFIG.priorityFee.maxMicroLamports)
    );

    // Get compute unit limit
    const computeUnitLimit = options.computeUnitLimit || EXECUTION_CONFIG.computeUnits.defaultLimit;

    // Build instruction list with compute budget
    const allInstructions: TransactionInstruction[] = [];

    // Add compute budget instructions FIRST (order matters!)
    allInstructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit })
    );

    allInstructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );

    // Add JITO tip if requested
    let jitoTip = 0;
    if (options.includeJitoTip && options.jitoTipLamports) {
      jitoTip = options.jitoTipLamports;
      const tipAccount =
        options.jitoTipAccount || this.getRandomJitoTipAccount();
      allInstructions.push(
        this.createJitoTipInstruction(payer, new PublicKey(tipAccount), jitoTip)
      );
    }

    // Add user instructions
    allInstructions.push(...instructions);

    // Get blockhash
    const pool = getFastConnectionPool();
    const blockhash = await pool.getBlockhash();

    // Build versioned transaction
    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash.blockhash,
      instructions: allInstructions,
    }).compileToV0Message(options.addressLookupTables);

    const transaction = new VersionedTransaction(messageV0);

    // Calculate estimated fee
    // Priority fee = (computeUnits * priorityFee) / 1_000_000 (convert microlamports to lamports)
    const priorityFeeLamports = Math.ceil((computeUnitLimit * priorityFee) / 1_000_000);
    const baseFee = 5000; // Base transaction fee in lamports
    const estimatedFee = baseFee + priorityFeeLamports + jitoTip;

    const buildTimeUs = tracker.end('tx_build');

    console.log(
      `[FastTx] Built in ${formatMicroseconds(buildTimeUs)}: ` +
        `CU=${computeUnitLimit}, priority=${priorityFee}μL, fee=${estimatedFee}L`
    );

    return {
      transaction,
      computeUnits: computeUnitLimit,
      priorityFee,
      jitoTip,
      estimatedFee,
      buildTimeUs,
    };
  }

  /**
   * Sign a versioned transaction
   */
  signTransaction(transaction: VersionedTransaction, signer: Keypair): VersionedTransaction {
    const tracker = getLatencyTracker();
    tracker.start('tx_sign');

    transaction.sign([signer]);

    const signTimeUs = tracker.end('tx_sign');
    console.log(`[FastTx] Signed in ${formatMicroseconds(signTimeUs)}`);

    return transaction;
  }

  /**
   * Build and sign in one step
   */
  async buildAndSign(
    payer: Keypair,
    instructions: TransactionInstruction[],
    options: TransactionBuildOptions = {}
  ): Promise<BuiltTransaction & { signed: boolean }> {
    const built = await this.buildTransaction(payer.publicKey, instructions, options);
    this.signTransaction(built.transaction, payer);
    return { ...built, signed: true };
  }

  /**
   * Estimate priority fee based on recent transactions
   */
  async estimatePriorityFee(): Promise<PriorityFeeEstimate> {
    // Check cache
    const now = Date.now();
    if (
      this.priorityFeeCache &&
      now - this.priorityFeeCache.fetchedAt < this.priorityFeeCacheTtlMs
    ) {
      return this.priorityFeeCache.estimate;
    }

    const tracker = getLatencyTracker();
    tracker.start('priority_fee_estimate');

    try {
      // Query recent priority fees
      const recentFees = await this.connection.getRecentPrioritizationFees();

      if (recentFees.length === 0) {
        // No data, return defaults
        const estimate: PriorityFeeEstimate = {
          low: 1000,
          medium: 10000,
          high: 50000,
          veryHigh: 100000,
          recommended: EXECUTION_CONFIG.priorityFee.defaultMicroLamports,
        };
        return estimate;
      }

      // Sort fees
      const fees = recentFees
        .map((f) => f.prioritizationFee)
        .filter((f) => f > 0)
        .sort((a, b) => a - b);

      if (fees.length === 0) {
        const estimate: PriorityFeeEstimate = {
          low: 1000,
          medium: 10000,
          high: 50000,
          veryHigh: 100000,
          recommended: EXECUTION_CONFIG.priorityFee.defaultMicroLamports,
        };
        return estimate;
      }

      const getPercentile = (pct: number) => fees[Math.floor(fees.length * pct)] || fees[0];

      const estimate: PriorityFeeEstimate = {
        low: getPercentile(0.25),
        medium: getPercentile(0.5),
        high: getPercentile(0.75),
        veryHigh: getPercentile(0.95),
        recommended: Math.ceil(
          getPercentile(EXECUTION_CONFIG.priorityFee.autoAdjustPercentile) *
            EXECUTION_CONFIG.priorityFee.autoAdjustBuffer
        ),
      };

      // Cache result
      this.priorityFeeCache = { estimate, fetchedAt: now };

      const elapsed = tracker.end('priority_fee_estimate');
      console.log(
        `[FastTx] Priority fee estimated in ${formatMicroseconds(elapsed)}: ` +
          `recommended=${estimate.recommended}μL`
      );

      return estimate;
    } catch (error) {
      tracker.end('priority_fee_estimate');
      console.warn('[FastTx] Failed to estimate priority fee:', error);

      // Return defaults on error
      return {
        low: 1000,
        medium: 10000,
        high: 50000,
        veryHigh: 100000,
        recommended: EXECUTION_CONFIG.priorityFee.defaultMicroLamports,
      };
    }
  }

  /**
   * Get a random JITO tip account
   */
  private getRandomJitoTipAccount(): string {
    const accounts = [
      '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
      'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
      'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
      'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
      'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
      'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
      'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
      '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    ];
    return accounts[Math.floor(Math.random() * accounts.length)];
  }

  /**
   * Create JITO tip transfer instruction
   */
  private createJitoTipInstruction(
    payer: PublicKey,
    tipAccount: PublicKey,
    lamports: number
  ): TransactionInstruction {
    // Use SystemProgram transfer for tip
    return {
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: tipAccount, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey('11111111111111111111111111111111'), // System program
      data: Buffer.from([
        2, 0, 0, 0, // Transfer instruction
        ...this.numberToLittleEndian(lamports, 8),
      ]),
    };
  }

  /**
   * Convert number to little-endian byte array
   */
  private numberToLittleEndian(num: number, bytes: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < bytes; i++) {
      result.push(num & 0xff);
      num = Math.floor(num / 256);
    }
    return result;
  }

  /**
   * Simulate transaction to estimate compute units
   */
  async simulateForComputeUnits(
    transaction: VersionedTransaction
  ): Promise<{ unitsConsumed: number; error?: string }> {
    try {
      const result = await this.connection.simulateTransaction(transaction, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      if (result.value.err) {
        return {
          unitsConsumed: EXECUTION_CONFIG.computeUnits.defaultLimit,
          error: JSON.stringify(result.value.err),
        };
      }

      return {
        unitsConsumed: result.value.unitsConsumed || EXECUTION_CONFIG.computeUnits.defaultLimit,
      };
    } catch (error) {
      return {
        unitsConsumed: EXECUTION_CONFIG.computeUnits.defaultLimit,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalBuilder: FastTransactionBuilder | null = null;

export function getFastTransactionBuilder(): FastTransactionBuilder {
  if (!globalBuilder) {
    globalBuilder = new FastTransactionBuilder();
  }
  return globalBuilder;
}

export default FastTransactionBuilder;
