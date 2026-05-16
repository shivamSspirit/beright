/**
 * Platform Import Module
 *
 * Cross-platform reputation aggregation for BeRight Forecaster Network.
 * Enables importing and verifying forecaster profiles from external platforms.
 *
 * Usage:
 *   import { fetchPlatformStats, verifyPlatformOwnership, calculateCompositeScore } from './lib/platformImport';
 *
 *   // Link and verify a platform
 *   const code = await createVerificationCode(pubkey, 'metaculus', 'username');
 *   // User adds code to their Metaculus bio...
 *   const result = await verifyPlatformOwnership('metaculus', 'username', proof);
 *
 *   // Fetch stats
 *   const stats = await fetchPlatformStats('metaculus', 'username');
 *
 *   // Calculate composite score
 *   const composite = await calculateAndStoreCompositeScore(pubkey);
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  ExternalPlatform,
  VerificationMethod,
  AuthMethod,
  ScoringType,
  ForecasterTier,
  CalibrationBucket,
  ImportedStats,
  ExternalPlatformLink,
  OwnershipProof,
  VerificationResult,
  VerificationCode,
  ScoreComponent,
  CompositeScoreResult,
  CompositeScoreInput,
  ForecasterProfileWithImports,
  PlatformConnector,
  LinkPlatformRequest,
  LinkPlatformResponse,
  GenerateCodeRequest,
  GenerateCodeResponse,
  CheckCodeRequest,
  CheckCodeResponse,
  CompositeScoreResponse,
  LinkedPlatformsResponse,
  LeaderboardEntry,
  LeaderboardResponse,
} from './types';

// =============================================================================
// REGISTRY
// =============================================================================

export {
  PLATFORM_WEIGHTS,
  BERIGHT_NATIVE_WEIGHT,
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
// COMPOSITE SCORING
// =============================================================================

export {
  calculateCompositeScore,
  calculateTier,
  calculateAndStoreCompositeScore,
  getCompositeScore,
  recalculateStaleScores,
} from './composite/scoreCalculator';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { supabaseAdmin } from '../supabase/client';
import { fetchPlatformStats } from './connectors';
import { createVerificationCode, markCodeUsed, verifyOwnership } from './verification';
import { calculateAndStoreCompositeScore } from './composite/scoreCalculator';
import { PLATFORM_WEIGHTS, getPlatformProfileUrl } from './registry';
import type { ExternalPlatform, OwnershipProof, ExternalPlatformLink } from './types';

/**
 * Link an external platform to a forecaster's BeRight account.
 * Full flow: verify ownership → fetch stats → store link → recalculate score.
 */
export async function linkPlatform(
  forecasterPubkey: string,
  platform: ExternalPlatform,
  platformUserId: string,
  proof: OwnershipProof
): Promise<{ success: boolean; link?: ExternalPlatformLink; error?: string }> {
  try {
    // Verify ownership
    const fetchBio = async (): Promise<string | null> => {
      const { getConnector } = await import('./connectors');
      const connector = getConnector(platform);
      if (!connector) return null;

      try {
        const stats = await connector.fetchStats(platformUserId);
        // Bio check is handled in verifyOwnership for profile_code
        return null;
      } catch {
        return null;
      }
    };

    const verificationResult = await verifyOwnership(
      platform,
      platformUserId,
      forecasterPubkey,
      proof,
      fetchBio
    );

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
          verification_proof: proof.type === 'wallet_signature' ? proof.data.signature : proof.data.code,
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

    // Recalculate composite score
    await calculateAndStoreCompositeScore(forecasterPubkey);

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

    // Recalculate composite score
    await calculateAndStoreCompositeScore(forecasterPubkey);

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

  // Recalculate composite score
  await calculateAndStoreCompositeScore(forecasterPubkey);

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
