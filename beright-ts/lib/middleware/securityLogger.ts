/**
 * Security Event Logger
 *
 * Logs security events to:
 * 1. Console (all environments)
 * 2. Supabase security_events table (production)
 *
 * Usage:
 *   import { logSecurityEvent } from '@/lib/middleware/securityLogger';
 *
 *   await logSecurityEvent({
 *     eventType: 'auth_failure',
 *     action: 'login_attempt',
 *     severity: 'warning',
 *     walletAddress: '...',
 *     details: { reason: 'invalid_token' },
 *   });
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secrets } from '../secrets';
import { isProduction } from '../config/env';

// ============================================
// TYPES
// ============================================

export type SecurityEventType =
  | 'auth_attempt'
  | 'auth_success'
  | 'auth_failure'
  | 'rate_limit'
  | 'injection_attempt'
  | 'secret_scrubbed'
  | 'admin_command'
  | 'transaction_sign'
  | 'transaction_send'
  | 'kill_switch'
  | 'config_change'
  | 'api_access'
  | 'suspicious_activity';

export type SecuritySeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface SecurityEvent {
  eventType: SecurityEventType;
  action: string;
  severity?: SecuritySeverity;

  // Actor identifiers
  walletAddress?: string;
  telegramId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;

  // Context
  resource?: string;
  details?: Record<string, unknown>;

  // Request context
  requestId?: string;
  sessionId?: string;

  // Outcome
  success?: boolean;
  errorMessage?: string;
}

interface TransactionAudit {
  txType: 'sign' | 'send' | 'confirm' | 'swap' | 'transfer' | 'stake' | 'unstake' | 'trade';
  signature?: string;
  fromWallet: string;
  toWallet?: string;
  amountLamports?: number;
  amountUsd?: number;
  programId?: string;
  instructionName?: string;
  status: 'pending' | 'signed' | 'sent' | 'confirmed' | 'failed' | 'timeout';
  errorMessage?: string;
  userId?: string;
  sessionId?: string;
}

// ============================================
// SUPABASE CLIENT (LAZY INIT)
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
// CONSOLE LOGGING
// ============================================

const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  warning: '\x1b[33m',  // Yellow
  error: '\x1b[31m',    // Red
  critical: '\x1b[35m', // Magenta
};

const RESET_COLOR = '\x1b[0m';

function logToConsole(event: SecurityEvent): void {
  const severity = event.severity || 'info';
  const color = SEVERITY_COLORS[severity];
  const timestamp = new Date().toISOString();

  const actor = event.walletAddress || event.telegramId || event.userId || event.ipAddress || 'anonymous';
  const actorShort = actor.length > 12 ? actor.slice(0, 6) + '...' + actor.slice(-4) : actor;

  const message = `[SECURITY] ${event.eventType}:${event.action} | ${actorShort} | ${event.success !== false ? 'OK' : 'FAIL'}`;

  if (severity === 'debug' && isProduction()) {
    // Skip debug logs in production console
    return;
  }

  const logFn = severity === 'error' || severity === 'critical' ? console.error :
                severity === 'warning' ? console.warn : console.log;

  logFn(`${color}${timestamp} ${message}${RESET_COLOR}`);

  // Log details for non-debug events
  if (severity !== 'debug' && event.details) {
    console.log('  Details:', JSON.stringify(event.details));
  }
}

// ============================================
// DATABASE LOGGING
// ============================================

async function logToDatabase(event: SecurityEvent): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    // No database connection, skip
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('security_events')
      .insert({
        event_type: event.eventType,
        severity: event.severity || 'info',
        wallet_address: event.walletAddress,
        telegram_id: event.telegramId,
        user_id: event.userId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        action: event.action,
        resource: event.resource,
        details: event.details || {},
        request_id: event.requestId,
        session_id: event.sessionId,
        success: event.success !== false,
        error_message: event.errorMessage,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SecurityLogger] Database insert error:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[SecurityLogger] Database error:', err);
    return null;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Log a security event
 * Logs to console immediately, database async
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<string | null> {
  // Always log to console
  logToConsole(event);

  // Log to database in production or if explicitly enabled
  if (isProduction() || process.env.LOG_SECURITY_TO_DB === 'true') {
    return logToDatabase(event);
  }

  return null;
}

/**
 * Log a transaction audit event
 */
export async function logTransactionAudit(audit: TransactionAudit): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log(`[TxAudit] ${audit.txType} | ${audit.fromWallet.slice(0, 8)}... | ${audit.status}`);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('transaction_audits')
      .insert({
        tx_type: audit.txType,
        signature: audit.signature,
        from_wallet: audit.fromWallet,
        to_wallet: audit.toWallet,
        amount_lamports: audit.amountLamports,
        amount_usd: audit.amountUsd,
        program_id: audit.programId,
        instruction_name: audit.instructionName,
        status: audit.status,
        error_message: audit.errorMessage,
        user_id: audit.userId,
        session_id: audit.sessionId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[TxAudit] Database insert error:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[TxAudit] Database error:', err);
    return null;
  }
}

/**
 * Update transaction audit status
 */
export async function updateTransactionAudit(
  id: string,
  updates: Partial<Pick<TransactionAudit, 'signature' | 'status' | 'errorMessage'>>
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const updateData: Record<string, unknown> = {};
    if (updates.signature) updateData.signature = updates.signature;
    if (updates.status) updateData.status = updates.status;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.status === 'confirmed') updateData.confirmed_at = new Date().toISOString();

    const { error } = await supabase
      .from('transaction_audits')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[TxAudit] Update error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TxAudit] Update error:', err);
    return false;
  }
}

/**
 * Log critical security event and send alert
 */
export async function logCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
  event.severity = 'critical';
  await logSecurityEvent(event);

  // TODO: Send Telegram alert to SUPER_ADMIN
  // TODO: Send to PagerDuty/Opsgenie if configured

  console.error('\x1b[35m[CRITICAL SECURITY EVENT]\x1b[0m', {
    eventType: event.eventType,
    action: event.action,
    actor: event.walletAddress || event.telegramId || event.userId,
    details: event.details,
  });
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Get recent security events (for admin dashboard)
 */
export async function getRecentSecurityEvents(
  hours = 24,
  options?: { severity?: SecuritySeverity; eventType?: SecurityEventType; limit?: number }
): Promise<SecurityEvent[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('security_events')
      .select('*')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }
    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SecurityLogger] Query error:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      eventType: row.event_type as SecurityEventType,
      action: row.action,
      severity: row.severity as SecuritySeverity,
      walletAddress: row.wallet_address,
      telegramId: row.telegram_id,
      userId: row.user_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      resource: row.resource,
      details: row.details,
      requestId: row.request_id,
      sessionId: row.session_id,
      success: row.success,
      errorMessage: row.error_message,
    }));
  } catch (err) {
    console.error('[SecurityLogger] Query error:', err);
    return [];
  }
}

/**
 * Get security stats (for admin dashboard)
 */
export async function getSecurityStats(hours = 24): Promise<Record<string, { total: number; success: number; failure: number }>> {
  const supabase = getSupabase();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase.rpc('get_security_stats', { p_hours: hours });

    if (error) {
      console.error('[SecurityLogger] Stats error:', error.message);
      return {};
    }

    const stats: Record<string, { total: number; success: number; failure: number }> = {};
    for (const row of data || []) {
      stats[row.event_type] = {
        total: row.total_count,
        success: row.success_count,
        failure: row.failure_count,
      };
    }

    return stats;
  } catch (err) {
    console.error('[SecurityLogger] Stats error:', err);
    return {};
  }
}
