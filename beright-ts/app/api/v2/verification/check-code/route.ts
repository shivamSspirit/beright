/**
 * Check Verification Code API
 *
 * POST /api/v2/verification/check-code
 *
 * Checks if the verification code is present in user's external platform bio.
 * If found, marks the code as used and returns success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateVerificationCode,
  verifyPlatformOwnership,
  PLATFORM_REGISTRY,
  getPlatformProfileUrl,
} from '../../../../../lib/platformImport';
import type { ExternalPlatform, OwnershipProof } from '../../../../../lib/platformImport';

// =============================================================================
// VALIDATION
// =============================================================================

const requestSchema = z.object({
  forecasterPubkey: z.string().min(32).max(64),
  platform: z.enum([
    'metaculus',
    'manifold',
    'goodjudgment',
    'polymarket',
    'kalshi',
    'infer',
    'hypermind',
    'predictit',
  ]),
  platformUserId: z.string().min(1).max(100),
  code: z.string().regex(/^beright-verify-[a-f0-9]{8}$/),
});

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate request body
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { forecasterPubkey, platform, platformUserId, code } = validation.data;
    const platformType = platform as ExternalPlatform;

    // Validate the code exists and is not expired
    const codeValidation = await validateVerificationCode(
      forecasterPubkey,
      platformType,
      platformUserId,
      code
    );

    if (!codeValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: codeValidation.error || 'Invalid verification code',
        },
        { status: 400 }
      );
    }

    // Build proof and verify ownership via platform connector
    const proof: OwnershipProof = {
      type: 'profile_code',
      data: { code },
    };

    const result = await verifyPlatformOwnership(platformType, platformUserId, proof);

    if (!result.verified) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: result.error || 'Verification failed',
        profileUrl: result.profileUrl || getPlatformProfileUrl(platformType, platformUserId),
        hint: `Make sure the code "${code}" is visible in your ${PLATFORM_REGISTRY[platformType].displayName} bio/about section`,
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      profileUrl: result.profileUrl,
      message: `Successfully verified ownership of ${PLATFORM_REGISTRY[platformType].displayName} account`,
    });
  } catch (error) {
    console.error('[Check Code API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
