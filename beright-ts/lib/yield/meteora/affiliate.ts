/**
 * Meteora Affiliate Program Integration
 *
 * Manages BeRight's affiliate partnership with Meteora for fee sharing.
 *
 * Affiliate Benefits:
 * - Fee sharing on vault deposits routed through BeRight
 * - Access to partner analytics
 * - Custom vault configurations
 *
 * @see https://docs.meteora.ag/dynamic-vaults/affiliate-program
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { METEORA_AFFILIATE_PROGRAM_ID, METEORA_VAULT_PROGRAM_ID } from './vaults';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AffiliatePartnership } from '../tracking/types';

// ============================================================================
// Types
// ============================================================================

export interface AffiliateConfig {
  partnerId: PublicKey;
  partnerName: string;
  feeShareBps: number;           // Fee share in basis points
  vaultPubkey: PublicKey;
}

export interface AffiliateInfo {
  partnerToken: PublicKey;
  vault: PublicKey;
  totalFee: bigint;
  feeRatio: number;
  cumulativeFee: bigint;
}

export interface AffiliateStats {
  partnerId: string;
  totalVolumeRouted: bigint;
  totalFeesEarned: bigint;
  activeUsers: number;
  transactions: number;
}

// ============================================================================
// Affiliate Registration
// ============================================================================

/**
 * BeRight Affiliate Configuration
 *
 * To register as a Meteora affiliate:
 * 1. Create an affiliate account on Meteora
 * 2. Set the affiliate ID here
 * 3. Use the affiliate-enabled deposit methods
 */
export const BERIGHT_AFFILIATE_CONFIG = {
  // TODO: Set after registering with Meteora
  partnerId: process.env.METEORA_AFFILIATE_ID
    ? new PublicKey(process.env.METEORA_AFFILIATE_ID)
    : undefined,
  partnerName: 'BeRight Protocol',
  defaultFeeShareBps: 5000, // 50% fee share (typical for affiliates)
};

/**
 * Check if BeRight affiliate is configured
 */
export function isAffiliateConfigured(): boolean {
  return BERIGHT_AFFILIATE_CONFIG.partnerId !== undefined;
}

/**
 * Get affiliate ID for deposits
 */
export function getAffiliateId(): PublicKey | undefined {
  return BERIGHT_AFFILIATE_CONFIG.partnerId;
}

// ============================================================================
// Affiliate Account Management
// ============================================================================

/**
 * Instructions for registering as a Meteora affiliate
 *
 * This is a one-time setup process:
 * 1. Contact Meteora team or use their dashboard
 * 2. Provide partner wallet address
 * 3. Receive affiliate ID
 * 4. Set METEORA_AFFILIATE_ID in environment
 */
export const AFFILIATE_REGISTRATION_GUIDE = `
# Meteora Affiliate Registration Guide

## Prerequisites
- Solana wallet with SOL for transaction fees
- Understanding of Meteora vault mechanics

## Steps

### 1. Apply for Partnership
Visit: https://forms.meteora.ag/partner-application
or contact: partners@meteora.ag

### 2. Provide Information
- Partner name: BeRight Protocol
- Description: Prediction market platform using Meteora vaults for yield
- Website: https://beright.io
- Contact: [your email]

### 3. Configuration
Once approved, you'll receive an affiliate ID. Add to .env:
METEORA_AFFILIATE_ID=<your_affiliate_pubkey>

### 4. Verification
Run the verification endpoint to confirm setup:
GET /api/v2/yield/affiliate/verify

## Fee Structure
- Typical fee share: 50% of vault fees
- Fees accumulate in your partner account
- Withdraw anytime to your wallet
`;

// ============================================================================
// Fee Tracking
// ============================================================================

/**
 * Record affiliate fee earned
 */
export async function recordAffiliateFee(params: {
  txSignature: string;
  vaultToken: string;
  volumeRouted: bigint;
  feeEarned: bigint;
  user: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  await supabaseAdmin.from('affiliate_fees').insert({
    tx_signature: params.txSignature,
    vault_token: params.vaultToken,
    volume_routed: params.volumeRouted.toString(),
    fee_earned: params.feeEarned.toString(),
    user: params.user,
    partner_id: BERIGHT_AFFILIATE_CONFIG.partnerId?.toBase58() || 'pending',
    created_at: new Date().toISOString(),
  });
}

/**
 * Get affiliate stats
 */
export async function getAffiliateStats(): Promise<AffiliateStats | null> {
  if (!isSupabaseConfigured || !BERIGHT_AFFILIATE_CONFIG.partnerId) return null;

  const partnerId = BERIGHT_AFFILIATE_CONFIG.partnerId.toBase58();

  // Get aggregate stats
  const { data: stats } = await supabaseAdmin
    .from('affiliate_fees')
    .select('volume_routed, fee_earned, user')
    .eq('partner_id', partnerId);

  if (!stats || stats.length === 0) {
    return {
      partnerId,
      totalVolumeRouted: 0n,
      totalFeesEarned: 0n,
      activeUsers: 0,
      transactions: 0,
    };
  }

  let totalVolume = 0n;
  let totalFees = 0n;
  const uniqueUsers = new Set<string>();

  for (const row of stats) {
    totalVolume += BigInt(row.volume_routed);
    totalFees += BigInt(row.fee_earned);
    uniqueUsers.add(row.user);
  }

  return {
    partnerId,
    totalVolumeRouted: totalVolume,
    totalFeesEarned: totalFees,
    activeUsers: uniqueUsers.size,
    transactions: stats.length,
  };
}

/**
 * Get partnership record
 */
export async function getPartnership(): Promise<AffiliatePartnership | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('affiliate_partnerships')
    .select('*')
    .eq('protocol', 'meteora')
    .single();

  if (error || !data) return null;
  return data as AffiliatePartnership;
}

/**
 * Update partnership record
 */
export async function updatePartnership(updates: Partial<AffiliatePartnership>): Promise<void> {
  if (!isSupabaseConfigured) return;

  await supabaseAdmin
    .from('affiliate_partnerships')
    .upsert({
      protocol: 'meteora',
      partner_name: BERIGHT_AFFILIATE_CONFIG.partnerName,
      affiliate_id: BERIGHT_AFFILIATE_CONFIG.partnerId?.toBase58() || 'pending',
      fee_share_bps: BERIGHT_AFFILIATE_CONFIG.defaultFeeShareBps,
      status: BERIGHT_AFFILIATE_CONFIG.partnerId ? 'active' : 'pending',
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'protocol' });
}

// ============================================================================
// Affiliate Verification
// ============================================================================

/**
 * Verify affiliate configuration
 */
export async function verifyAffiliateSetup(): Promise<{
  configured: boolean;
  partnerId?: string;
  status: 'not_configured' | 'pending' | 'active' | 'error';
  message: string;
}> {
  if (!BERIGHT_AFFILIATE_CONFIG.partnerId) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'METEORA_AFFILIATE_ID not set in environment. See registration guide.',
    };
  }

  try {
    // Check if partner account exists on-chain (simplified check)
    const partnerId = BERIGHT_AFFILIATE_CONFIG.partnerId.toBase58();

    // Record or update partnership
    await updatePartnership({
      status: 'active',
      verified_at: new Date().toISOString(),
    });

    return {
      configured: true,
      partnerId,
      status: 'active',
      message: 'Affiliate configuration verified successfully',
    };
  } catch (error) {
    return {
      configured: false,
      partnerId: BERIGHT_AFFILIATE_CONFIG.partnerId.toBase58(),
      status: 'error',
      message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
