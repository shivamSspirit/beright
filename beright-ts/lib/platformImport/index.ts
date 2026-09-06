/**
 * Platform Import Module
 *
 * Legacy account-linking utilities.
 * These connectors no longer calculate or publish reputation scores.
 *
 * Usage:
 *   import { fetchPlatformStats, verifyPlatformOwnership } from './lib/platformImport';
 *
 *   // Link and verify a platform
 *   const code = await createVerificationCode(pubkey, 'metaculus', 'username');
 *   // User adds code to their Metaculus bio...
 *   const result = await verifyPlatformOwnership('metaculus', 'username', proof);
 *
 *   // Fetch stats
 *   const stats = await fetchPlatformStats('metaculus', 'username');
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  ExternalPlatform,
  VerificationMethod,
  AuthMethod,
  ScoringType,
  CalibrationBucket,
  ImportedStats,
  ExternalPlatformLink,
  OwnershipProof,
  VerificationResult,
  VerificationCode,
  PlatformConnector,
  LinkPlatformRequest,
  LinkPlatformResponse,
  GenerateCodeRequest,
  GenerateCodeResponse,
  CheckCodeRequest,
  CheckCodeResponse,
  LinkedPlatformsResponse,
} from './types';

// =============================================================================
// REGISTRY
// =============================================================================

export {
  PLATFORM_REGISTRY,
  PLATFORM_DISPLAY_NAMES,
  getPlatformsByTier,
  getApiSupportedPlatforms,
  getAutoRefreshPlatforms,
  getPlatformDisplayName,
  getPlatformProfileUrl,
  supportsAuthMethod,
  isPlatformReputable,
} from './registry';

// =============================================================================
// VERIFICATION
// =============================================================================

export {
  generateVerificationCode,
  createVerificationCode,
  validateVerificationCode,
  markCodeUsed,
  verifyProfileCode,
  getWalletVerificationMessage,
  verifyEthereumSignature,
  verifySolanaSignature,
  verifyOwnership,
  cleanupExpiredCodes,
} from './verification';

// =============================================================================
// CONNECTORS
// =============================================================================

export {
  BasePlatformConnector,
  registerConnector,
  getConnector,
  getAllConnectors,
  hasConnector,
  fetchPlatformStats,
  verifyPlatformOwnership,
  userExistsOnPlatform,
  isPlatformSupported,
  getSupportedPlatforms,
  metaculusConnector,
  manifoldConnector,
  polymarketConnector,
} from './connectors';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { supabaseAdmin } from '../supabase/client';
import { fetchPlatformStats, getConnector } from './connectors';
import { createVerificationCode, markCodeUsed, verifyOwnership } from './verification';
import { hashCanonicalJson } from '@beright/forecaster-scoring-engine';
import { getPlatformProfileUrl } from './registry';
import type { ExternalPlatform, OwnershipProof, ExternalPlatformLink } from './types';

/**
 * Link an external platform to a forecaster's BeRight account.
 * Full flow: verify ownership → fetch stats → store link.
 */
export async function linkPlatform(
  forecasterPubkey: string,
  platform: ExternalPlatform,
  platformUserId: string,
  proof: OwnershipProof
): Promise<{ success: boolean; link?: ExternalPlatformLink; error?: string }> {
  try {
    // Verify ownership
    const connector = getConnector(platform);
    const verificationResult = proof.type === 'profile_code' && connector
      ? await connector.verifyOwnership(platformUserId, proof)
      : await verifyOwnership(platform, platformUserId, forecasterPubkey, proof);

    if (!verificationResult.verified) {
      return { success: false, error: verificationResult.error };
    }

    // Mark verification code as used (if applicable)
    if (proof.type === 'profile_code' && proof.data.code) {
      await markCodeUsed(forecasterPubkey, platform, platformUserId, proof.data.code);
    }

    // Fetch stats from platform
    const stats = await fetchPlatformStats(platform, platformUserId);

    // Store link in database
    const { data, error } = await supabaseAdmin
      .from('external_platform_links')
      .upsert(
        {
          forecaster_pubkey: forecasterPubkey,
          platform,
          platform_user_id: platformUserId,
          platform_profile_url: verificationResult.profileUrl || getPlatformProfileUrl(platform, platformUserId),
          verified_at: new Date().toISOString(),
          verification_method: proof.type,
          verification_proof: hashCanonicalJson({ proofType: proof.type, challengeMaterial: proof.data.message ?? proof.data.code ?? null }),
          imported_stats: stats,
          last_refreshed_at: new Date().toISOString(),
        },
        { onConflict: 'forecaster_pubkey,platform' }
      )
      .select()
      .single();

    if (error) {
      return { success: false, error: `Failed to store platform link: ${error.message}` };
    }

    return { success: true, link: data as unknown as ExternalPlatformLink };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh stats from a linked platform.
 */
export async function refreshPlatformStats(
  forecasterPubkey: string,
  platform: ExternalPlatform
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get existing link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('external_platform_links')
      .select('*')
      .eq('forecaster_pubkey', forecasterPubkey)
      .eq('platform', platform)
      .single();

    if (linkError || !link) {
      return { success: false, error: 'Platform link not found' };
    }

    // Fetch fresh stats
    const stats = await fetchPlatformStats(platform, link.platform_user_id);

    // Update link
    const { error: updateError } = await supabaseAdmin
      .from('external_platform_links')
      .update({
        imported_stats: stats,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('forecaster_pubkey', forecasterPubkey)
      .eq('platform', platform);

    if (updateError) {
      return { success: false, error: `Failed to update stats: ${updateError.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unlink a platform from a forecaster's account.
 */
export async function unlinkPlatform(
  forecasterPubkey: string,
  platform: ExternalPlatform
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('external_platform_links')
    .delete()
    .eq('forecaster_pubkey', forecasterPubkey)
    .eq('platform', platform);

  if (error) {
    return { success: false, error: `Failed to unlink platform: ${error.message}` };
  }

  return { success: true };
}

/**
 * Get all linked platforms for a forecaster.
 */
export async function getLinkedPlatforms(
  forecasterPubkey: string
): Promise<ExternalPlatformLink[]> {
  const { data, error } = await supabaseAdmin
    .from('external_platform_links')
    .select('*')
    .eq('forecaster_pubkey', forecasterPubkey)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch linked platforms: ${error.message}`);
  }

  return (data || []) as unknown as ExternalPlatformLink[];
}
