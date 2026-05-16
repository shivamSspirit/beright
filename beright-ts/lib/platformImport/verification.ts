/**
 * Verification System
 *
 * Handles verification code generation and validation for profile-based
 * verification, as well as wallet signature verification for on-chain platforms.
 */

import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '../supabase/client';
import { PLATFORM_REGISTRY, getPlatformProfileUrl } from './registry';
import type {
  ExternalPlatform,
  VerificationCode,
  VerificationResult,
  OwnershipProof,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERIFICATION_CODE_PREFIX = 'beright-verify-';
const CODE_EXPIRY_HOURS = 24;
const CODE_LENGTH = 8; // Characters after prefix

// =============================================================================
// CODE GENERATION
// =============================================================================

/**
 * Generate a unique verification code for profile-based verification.
 *
 * The code is deterministic based on forecaster + platform + timestamp,
 * but includes random salt to prevent prediction.
 */
export function generateVerificationCode(
  forecasterPubkey: string,
  platform: ExternalPlatform
): string {
  const salt = randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);

  const hash = createHash('sha256')
    .update(`beright:${forecasterPubkey}:${platform}:${timestamp}:${salt}`)
    .digest('hex')
    .slice(0, CODE_LENGTH);

  return `${VERIFICATION_CODE_PREFIX}${hash}`;
}

/**
 * Create and store a verification code in the database.
 * Returns the code and expiry time.
 */
export async function createVerificationCode(
  forecasterPubkey: string,
  platform: ExternalPlatform,
  platformUserId: string
): Promise<{ code: string; expiresAt: string; instructions: string }> {
  const code = generateVerificationCode(forecasterPubkey, platform);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_HOURS * 60 * 60 * 1000);

  // Upsert to replace any existing pending code for this forecaster+platform
  const { error } = await supabaseAdmin
    .from('verification_codes')
    .upsert(
      {
        forecaster_pubkey: forecasterPubkey,
        platform,
        platform_user_id: platformUserId,
        code,
        expires_at: expiresAt.toISOString(),
        used_at: null,
      },
      {
        onConflict: 'forecaster_pubkey,platform,platform_user_id',
      }
    );

  if (error) {
    throw new Error(`Failed to create verification code: ${error.message}`);
  }

  const platformConfig = PLATFORM_REGISTRY[platform];

  return {
    code,
    expiresAt: expiresAt.toISOString(),
    instructions: platformConfig.verificationInstructions,
  };
}

/**
 * Validate a verification code from the database.
 */
export async function validateVerificationCode(
  forecasterPubkey: string,
  platform: ExternalPlatform,
  platformUserId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('verification_codes')
    .select('*')
    .eq('forecaster_pubkey', forecasterPubkey)
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .eq('code', code)
    .is('used_at', null)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid or expired verification code' };
  }

  const codeData = data as VerificationCode;

  // Check expiry
  if (new Date(codeData.expiresAt) < new Date()) {
    return { valid: false, error: 'Verification code has expired' };
  }

  return { valid: true };
}

/**
 * Mark a verification code as used.
 */
export async function markCodeUsed(
  forecasterPubkey: string,
  platform: ExternalPlatform,
  platformUserId: string,
  code: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('verification_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('forecaster_pubkey', forecasterPubkey)
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .eq('code', code);

  if (error) {
    console.error('Failed to mark code as used:', error);
  }
}

// =============================================================================
// PROFILE CODE VERIFICATION
// =============================================================================

/**
 * Check if a verification code is present in the user's profile bio.
 * This is used for platforms that support profile code verification.
 */
export async function verifyProfileCode(
  platform: ExternalPlatform,
  platformUserId: string,
  code: string,
  fetchBio: () => Promise<string | null>
): Promise<VerificationResult> {
  try {
    const bio = await fetchBio();

    if (!bio) {
      return {
        verified: false,
        error: 'Could not fetch profile or profile has no bio',
      };
    }

    const codePresent = bio.includes(code);

    if (!codePresent) {
      return {
        verified: false,
        error: `Verification code "${code}" not found in profile bio`,
        profileUrl: getPlatformProfileUrl(platform, platformUserId),
      };
    }

    return {
      verified: true,
      profileUrl: getPlatformProfileUrl(platform, platformUserId),
    };
  } catch (error) {
    return {
      verified: false,
      error: `Failed to verify profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// =============================================================================
// WALLET SIGNATURE VERIFICATION
// =============================================================================

/**
 * Generate the message to be signed for wallet verification.
 */
export function getWalletVerificationMessage(
  berightWallet: string,
  externalWallet: string,
  platform: ExternalPlatform
): string {
  const date = new Date().toISOString().split('T')[0];

  return `I authorize linking my ${platform} wallet to BeRight.

BeRight wallet: ${berightWallet}
${platform} wallet: ${externalWallet}

This signature proves I own both wallets.
Date: ${date}`;
}

/**
 * Verify an Ethereum wallet signature (for Polymarket).
 */
export async function verifyEthereumSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<VerificationResult> {
  try {
    // Dynamic import to avoid build issues
    // Using Function constructor to avoid TypeScript module resolution
    const importEthers = new Function('return import("ethers")');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethers: any = await importEthers().catch(() => null);

    if (!ethers) {
      return {
        verified: false,
        error: 'ethers library not available - install with: npm install ethers',
      };
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    const verified =
      recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();

    return {
      verified,
      error: verified
        ? undefined
        : 'Signature does not match the expected wallet address',
      profileUrl: `https://polymarket.com/profile/${expectedAddress}`,
    };
  } catch (error) {
    return {
      verified: false,
      error: `Invalid signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify a Solana wallet signature.
 */
export async function verifySolanaSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<VerificationResult> {
  try {
    // Dynamic imports to avoid build issues
    // Using Function constructor to avoid TypeScript module resolution
    const importWeb3 = new Function('return import("@solana/web3.js")');
    const importNacl = new Function('return import("tweetnacl")');
    const importBs58 = new Function('return import("bs58")');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3js: any = await importWeb3().catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nacl: any = await importNacl().catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bs58Module: any = await importBs58().catch(() => null);

    if (!web3js || !nacl || !bs58Module) {
      return {
        verified: false,
        error: 'Required cryptographic libraries not available',
      };
    }

    const { PublicKey } = web3js;
    const bs58 = bs58Module.default || bs58Module;

    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKey = new PublicKey(expectedAddress);

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    return {
      verified,
      error: verified
        ? undefined
        : 'Signature does not match the expected wallet address',
    };
  } catch (error) {
    return {
      verified: false,
      error: `Invalid signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// =============================================================================
// UNIFIED VERIFICATION
// =============================================================================

/**
 * Unified verification dispatcher.
 * Routes to the appropriate verification method based on proof type.
 */
export async function verifyOwnership(
  platform: ExternalPlatform,
  platformUserId: string,
  berightWallet: string,
  proof: OwnershipProof,
  fetchBio?: () => Promise<string | null>
): Promise<VerificationResult> {
  switch (proof.type) {
    case 'profile_code':
      if (!proof.data.code) {
        return { verified: false, error: 'Missing verification code' };
      }
      if (!fetchBio) {
        return { verified: false, error: 'Profile code verification not supported' };
      }
      return verifyProfileCode(platform, platformUserId, proof.data.code, fetchBio);

    case 'wallet_signature':
      if (!proof.data.message || !proof.data.signature) {
        return { verified: false, error: 'Missing message or signature' };
      }

      const expectedMessage = getWalletVerificationMessage(
        berightWallet,
        platformUserId,
        platform
      );

      // Verify the message content matches
      if (proof.data.message !== expectedMessage) {
        return { verified: false, error: 'Message does not match expected format' };
      }

      if (proof.data.walletType === 'ethereum') {
        return verifyEthereumSignature(
          proof.data.message,
          proof.data.signature,
          platformUserId
        );
      } else if (proof.data.walletType === 'solana') {
        return verifySolanaSignature(
          proof.data.message,
          proof.data.signature,
          platformUserId
        );
      } else {
        return { verified: false, error: 'Unsupported wallet type' };
      }

    case 'api_key':
      // API key verification is handled by the platform connector
      return { verified: false, error: 'API key verification must be done by platform connector' };

    case 'oauth':
      // OAuth verification would be handled by OAuth flow
      return { verified: false, error: 'OAuth verification not yet implemented' };

    default:
      return { verified: false, error: 'Unknown verification method' };
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Delete expired verification codes.
 * Should be called periodically (e.g., via cron job).
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('cleanup_expired_verification_codes');

  if (error) {
    console.error('Failed to cleanup expired codes:', error);
    return 0;
  }

  return data as number;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
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
};
