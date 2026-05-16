/**
 * Generate Verification Code API
 *
 * POST /api/v2/verification/generate-code
 *
 * Generates a verification code for profile-based platform verification.
 * User adds this code to their external platform bio to prove ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createVerificationCode,
  userExistsOnPlatform,
  PLATFORM_REGISTRY,
} from '../../../../../lib/platformImport';
import type { ExternalPlatform } from '../../../../../lib/platformImport';

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

    const { forecasterPubkey, platform, platformUserId } = validation.data;

    // Check if platform supports profile code verification
    const platformConfig = PLATFORM_REGISTRY[platform as ExternalPlatform];
    if (!platformConfig.authMethods.includes('profile_code')) {
      return NextResponse.json(
        {
          success: false,
          error: `${platformConfig.displayName} does not support profile code verification`,
        },
        { status: 400 }
      );
    }

    // Verify user exists on platform (if API available)
    if (platformConfig.apiAvailable) {
      const exists = await userExistsOnPlatform(platform as ExternalPlatform, platformUserId);
      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            error: `User "${platformUserId}" not found on ${platformConfig.displayName}`,
          },
          { status: 404 }
        );
      }
    }

    // Generate and store verification code
    const { code, expiresAt, instructions } = await createVerificationCode(
      forecasterPubkey,
      platform as ExternalPlatform,
      platformUserId
    );

    return NextResponse.json({
      success: true,
      data: {
        code,
        expiresAt,
        instructions,
        platform: platformConfig.displayName,
        profileUrl: platformConfig.profileUrlTemplate.replace('{userId}', platformUserId),
      },
    });
  } catch (error) {
    console.error('[Generate Code API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
