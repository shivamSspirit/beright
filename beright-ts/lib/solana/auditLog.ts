/**
 * Solana Transaction Audit Logger
 *
 * Comprehensive audit trail for all Solana transactions.
 * Logs to:
 * 1. Console (development)
 * 2. Supabase transaction_audits table (production)
 * 3. Telegram alerts (critical/high-value)
 *
 * Usage:
 *   import { TxAudit, startTxAudit, completeTxAudit, failTxAudit } from '@/lib/solana/auditLog';
 *
 *   // Start audit before transaction
 *   const audit = await startTxAudit({
 *     txType: 'swap',
 *     fromWallet: wallet.publicKey.toBase58(),
 *     amountLamports: 1000000000,
 *     programId: 'JUP4...',
 *   });
 *
 *   // Complete after success
 *   await completeTxAudit(audit.id, { signature: 'abc123...', status: 'confirmed' });
 *
 *   // Or fail if error
 *   await failTxAudit(audit.id, 'Insufficient balance');
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secrets } from '../secrets';
import { isProduction } from '../config/env';
import { logSecurityEvent, logCriticalSecurityEvent } from '../middleware/securityLogger';

// ============================================
// TYPES
// ============================================

export type TxType =
  | 'sign'      // Transaction signed but not sent
  | 'send'      // Transaction sent to network
  | 'confirm'   // Transaction confirmed
  | 'swap'      // Token swap (Jupiter, etc.)
  | 'transfer'  // SOL or SPL token transfer
  | 'stake'     // Staking operation
  | 'unstake'   // Unstaking operation
  | 'trade';    // Prediction market trade

export type TxStatus =
  | 'pending'   // Created, not yet signed
  | 'signed'    // Signed, not yet sent
  | 'sent'      // Sent to network
  | 'confirmed' // Confirmed on-chain
  | 'failed'    // Transaction failed
  | 'timeout';  // Confirmation timed out

export interface TxAuditCreate {
  txType: TxType;
  fromWallet: string;
  toWallet?: string;
  amountLamports?: number;
  amountUsd?: number;
  programId?: string;
  instructionName?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TxAudit extends TxAuditCreate {
  id: string;
  status: TxStatus;
  signature?: string;
  errorMessage?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

export interface TxAuditUpdate {
  signature?: string;
  status?: TxStatus;
  errorMessage?: string;
  confirmedAt?: Date;
}

// ============================================
// CONFIGURATION
// ============================================

// Threshold for high-value transaction alerts (in lamports)
// 1 SOL = 1,000,000,000 lamports
const HIGH_VALUE_THRESHOLD_LAMPORTS = 10_000_000_000; // 10 SOL

// Threshold for USD alerts
const HIGH_VALUE_THRESHOLD_USD = 1000; // $1000

// Super admin Telegram ID for alerts
const SUPER_ADMIN_TELEGRAM_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

// ============================================
// SUPABASE CLIENT
// ============================================

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const creds = secrets.getSupabaseCredentials();
  if (!creds?.serviceRoleKey) {
    return null;
  }

  supabaseClient = createClient(creds.url, creds.serviceRoleKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

// ============================================
// IN-MEMORY AUDIT STORE (Development)
// ============================================

const memoryAuditStore = new Map<string, TxAudit>();

function generateAuditId(): string {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Start a new transaction audit
 * Call this BEFORE signing/sending the transaction
 */
export async function startTxAudit(params: TxAuditCreate): Promise<TxAudit> {
  const audit: TxAudit = {
    ...params,
    id: generateAuditId(),
    status: 'pending',
    createdAt: new Date(),
  };

  // Log to console
  console.log(`[TxAudit] START ${audit.txType} | ${shortenWallet(audit.fromWallet)} | ${formatAmount(audit.amountLamports)}`);

  // Check for high-value transaction
  const isHighValue = isHighValueTransaction(audit.amountLamports, audit.amountUsd);
  if (isHighValue) {
    await logSecurityEvent({
      eventType: 'transaction_sign',
      action: 'high_value_tx_started',
      severity: 'warning',
      walletAddress: audit.fromWallet,
      details: {
        txType: audit.txType,
        amountLamports: audit.amountLamports,
        amountUsd: audit.amountUsd,
        toWallet: audit.toWallet,
        programId: audit.programId,
      },
    });
  }

  // Store in memory for development
  memoryAuditStore.set(audit.id, audit);

  // Store in database for production
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transaction_audits')
        .insert({
          tx_type: audit.txType,
          from_wallet: audit.fromWallet,
          to_wallet: audit.toWallet,
          amount_lamports: audit.amountLamports,
          amount_usd: audit.amountUsd,
          program_id: audit.programId,
          instruction_name: audit.instructionName,
          status: audit.status,
          user_id: audit.userId,
          session_id: audit.sessionId,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[TxAudit] Database insert error:', error.message);
      } else if (data) {
        // Update audit with database ID
        audit.id = data.id;
        memoryAuditStore.set(audit.id, audit);
      }
    } catch (err) {
      console.error('[TxAudit] Database error:', err);
    }
  }

  return audit;
}

/**
 * Update transaction audit status
 * Call this as the transaction progresses
 */
export async function updateTxAudit(auditId: string, update: TxAuditUpdate): Promise<boolean> {
  // Update memory store
  const audit = memoryAuditStore.get(auditId);
  if (audit) {
    if (update.signature) audit.signature = update.signature;
    if (update.status) audit.status = update.status;
    if (update.errorMessage) audit.errorMessage = update.errorMessage;
    if (update.confirmedAt) audit.confirmedAt = update.confirmedAt;
    memoryAuditStore.set(auditId, audit);
  }

  // Log status change
  console.log(`[TxAudit] UPDATE ${auditId.slice(0, 12)}... | Status: ${update.status || 'unchanged'}`);

  // Update database
  const supabase = getSupabase();
  if (supabase) {
    try {
      const updateData: Record<string, unknown> = {};
      if (update.signature) updateData.signature = update.signature;
      if (update.status) updateData.status = update.status;
      if (update.errorMessage) updateData.error_message = update.errorMessage;
      if (update.confirmedAt) updateData.confirmed_at = update.confirmedAt.toISOString();

      const { error } = await supabase
        .from('transaction_audits')
        .update(updateData)
        .eq('id', auditId);

      if (error) {
        console.error('[TxAudit] Database update error:', error.message);
        return false;
      }
    } catch (err) {
      console.error('[TxAudit] Database error:', err);
      return false;
    }
  }

  return true;
}

/**
 * Complete a transaction audit (success)
 */
export async function completeTxAudit(
  auditId: string,
  signature: string,
  confirmedAt?: Date
): Promise<boolean> {
  const audit = memoryAuditStore.get(auditId);

  console.log(`[TxAudit] COMPLETE ${auditId.slice(0, 12)}... | Signature: ${signature.slice(0, 16)}...`);

  // Log security event
  await logSecurityEvent({
    eventType: 'transaction_send',
    action: 'tx_confirmed',
    severity: 'info',
    walletAddress: audit?.fromWallet,
    details: {
      auditId,
      signature,
      txType: audit?.txType,
      amountLamports: audit?.amountLamports,
    },
    success: true,
  });

  // Check for high-value and alert
  if (audit && isHighValueTransaction(audit.amountLamports, audit.amountUsd)) {
    await alertHighValueTransaction(audit, signature);
  }

  return updateTxAudit(auditId, {
    signature,
    status: 'confirmed',
    confirmedAt: confirmedAt || new Date(),
  });
}

/**
 * Fail a transaction audit (error)
 */
export async function failTxAudit(auditId: string, errorMessage: string): Promise<boolean> {
  const audit = memoryAuditStore.get(auditId);

  console.error(`[TxAudit] FAILED ${auditId.slice(0, 12)}... | Error: ${errorMessage}`);

  // Log security event
  await logSecurityEvent({
    eventType: 'transaction_send',
    action: 'tx_failed',
    severity: 'warning',
    walletAddress: audit?.fromWallet,
    details: {
      auditId,
      txType: audit?.txType,
      amountLamports: audit?.amountLamports,
      error: errorMessage,
    },
    success: false,
    errorMessage,
  });

  // Alert on high-value failures
  if (audit && isHighValueTransaction(audit.amountLamports, audit.amountUsd)) {
    await alertHighValueFailure(audit, errorMessage);
  }

  return updateTxAudit(auditId, {
    status: 'failed',
    errorMessage,
  });
}

/**
 * Mark transaction as timed out
 */
export async function timeoutTxAudit(auditId: string): Promise<boolean> {
  console.warn(`[TxAudit] TIMEOUT ${auditId.slice(0, 12)}...`);

  return updateTxAudit(auditId, {
    status: 'timeout',
    errorMessage: 'Transaction confirmation timed out',
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get recent transaction audits
 */
export async function getRecentTxAudits(
  walletAddress?: string,
  limit = 50
): Promise<TxAudit[]> {
  const supabase = getSupabase();
  if (!supabase) {
    // Return from memory store
    const audits = Array.from(memoryAuditStore.values());
    const filtered = walletAddress
      ? audits.filter(a => a.fromWallet === walletAddress)
      : audits;
    return filtered.slice(-limit);
  }

  try {
    let query = supabase
      .from('transaction_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (walletAddress) {
      query = query.eq('from_wallet', walletAddress);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[TxAudit] Query error:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      txType: row.tx_type as TxType,
      fromWallet: row.from_wallet,
      toWallet: row.to_wallet,
      amountLamports: row.amount_lamports,
      amountUsd: row.amount_usd,
      programId: row.program_id,
      instructionName: row.instruction_name,
      status: row.status as TxStatus,
      signature: row.signature,
      errorMessage: row.error_message,
      userId: row.user_id,
      sessionId: row.session_id,
      createdAt: new Date(row.created_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    }));
  } catch (err) {
    console.error('[TxAudit] Query error:', err);
    return [];
  }
}

/**
 * Get transaction audit by signature
 */
export async function getTxAuditBySignature(signature: string): Promise<TxAudit | null> {
  const supabase = getSupabase();
  if (!supabase) {
    // Search memory store
    for (const audit of memoryAuditStore.values()) {
      if (audit.signature === signature) return audit;
    }
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('transaction_audits')
      .select('*')
      .eq('signature', signature)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      txType: data.tx_type as TxType,
      fromWallet: data.from_wallet,
      toWallet: data.to_wallet,
      amountLamports: data.amount_lamports,
      amountUsd: data.amount_usd,
      programId: data.program_id,
      instructionName: data.instruction_name,
      status: data.status as TxStatus,
      signature: data.signature,
      errorMessage: data.error_message,
      userId: data.user_id,
      sessionId: data.session_id,
      createdAt: new Date(data.created_at),
      confirmedAt: data.confirmed_at ? new Date(data.confirmed_at) : undefined,
    };
  } catch (err) {
    console.error('[TxAudit] Query error:', err);
    return null;
  }
}

/**
 * Get transaction stats for a wallet
 */
export async function getWalletTxStats(
  walletAddress: string,
  hours = 24
): Promise<{
  totalTx: number;
  successfulTx: number;
  failedTx: number;
  totalLamports: number;
  totalUsd: number;
}> {
  const supabase = getSupabase();
  const defaultStats = {
    totalTx: 0,
    successfulTx: 0,
    failedTx: 0,
    totalLamports: 0,
    totalUsd: 0,
  };

  if (!supabase) return defaultStats;

  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('transaction_audits')
      .select('status, amount_lamports, amount_usd')
      .eq('from_wallet', walletAddress)
      .gte('created_at', cutoff);

    if (error || !data) return defaultStats;

    return {
      totalTx: data.length,
      successfulTx: data.filter(d => d.status === 'confirmed').length,
      failedTx: data.filter(d => d.status === 'failed').length,
      totalLamports: data.reduce((sum, d) => sum + (d.amount_lamports || 0), 0),
      totalUsd: data.reduce((sum, d) => sum + (d.amount_usd || 0), 0),
    };
  } catch (err) {
    console.error('[TxAudit] Stats error:', err);
    return defaultStats;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isHighValueTransaction(lamports?: number, usd?: number): boolean {
  if (lamports && lamports >= HIGH_VALUE_THRESHOLD_LAMPORTS) return true;
  if (usd && usd >= HIGH_VALUE_THRESHOLD_USD) return true;
  return false;
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return wallet.slice(0, 6) + '...' + wallet.slice(-4);
}

function formatAmount(lamports?: number): string {
  if (!lamports) return '0 SOL';
  const sol = lamports / 1_000_000_000;
  return sol.toFixed(4) + ' SOL';
}

async function alertHighValueTransaction(audit: TxAudit, signature: string): Promise<void> {
  const message = [
    '🚨 HIGH VALUE TRANSACTION',
    '',
    `Type: ${audit.txType.toUpperCase()}`,
    `From: ${shortenWallet(audit.fromWallet)}`,
    audit.toWallet ? `To: ${shortenWallet(audit.toWallet)}` : null,
    `Amount: ${formatAmount(audit.amountLamports)}`,
    audit.amountUsd ? `USD: $${audit.amountUsd.toFixed(2)}` : null,
    '',
    `Signature: ${signature.slice(0, 16)}...`,
    `Explorer: https://solscan.io/tx/${signature}`,
  ].filter(Boolean).join('\n');

  await logCriticalSecurityEvent({
    eventType: 'transaction_send',
    action: 'high_value_tx_confirmed',
    severity: 'critical',
    walletAddress: audit.fromWallet,
    details: {
      signature,
      amountLamports: audit.amountLamports,
      amountUsd: audit.amountUsd,
      toWallet: audit.toWallet,
      message,
    },
  });

  // TODO: Send Telegram alert to SUPER_ADMIN_TELEGRAM_ID
  console.log('[TxAudit] HIGH VALUE ALERT:', message);
}

async function alertHighValueFailure(audit: TxAudit, error: string): Promise<void> {
  const message = [
    '⚠️ HIGH VALUE TX FAILED',
    '',
    `Type: ${audit.txType.toUpperCase()}`,
    `From: ${shortenWallet(audit.fromWallet)}`,
    `Amount: ${formatAmount(audit.amountLamports)}`,
    '',
    `Error: ${error}`,
  ].join('\n');

  await logCriticalSecurityEvent({
    eventType: 'transaction_send',
    action: 'high_value_tx_failed',
    severity: 'critical',
    walletAddress: audit.fromWallet,
    success: false,
    errorMessage: error,
    details: {
      amountLamports: audit.amountLamports,
      amountUsd: audit.amountUsd,
      message,
    },
  });

  // TODO: Send Telegram alert to SUPER_ADMIN_TELEGRAM_ID
  console.log('[TxAudit] HIGH VALUE FAILURE ALERT:', message);
}

// ============================================
// WRAPPER FOR TRANSACTION EXECUTION
// ============================================

/**
 * Wrap a transaction execution with full audit logging
 *
 * Usage:
 *   const result = await withTxAudit(
 *     { txType: 'swap', fromWallet: 'abc...', amountLamports: 1000000000 },
 *     async () => {
 *       // Execute transaction
 *       return { signature: 'xyz...' };
 *     }
 *   );
 */
export async function withTxAudit<T extends { signature?: string }>(
  params: TxAuditCreate,
  executor: () => Promise<T>
): Promise<T & { auditId: string }> {
  const audit = await startTxAudit(params);

  try {
    await updateTxAudit(audit.id, { status: 'signed' });

    const result = await executor();

    if (result.signature) {
      await completeTxAudit(audit.id, result.signature);
    } else {
      await updateTxAudit(audit.id, { status: 'sent' });
    }

    return { ...result, auditId: audit.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await failTxAudit(audit.id, errorMessage);
    throw error;
  }
}
