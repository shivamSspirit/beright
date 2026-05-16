/**
 * Link Platform API
 *
 * POST /api/v2/forecaster/link-platform
 *
 * Links an external forecasting platform to a BeRight forecaster account.
 * Verifies ownership, imports stats, and updates composite score.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { linkPlatform, PLATFORM_REGISTRY } from '../../../../../lib/platformImport';
import type { ExternalPlatform, OwnershipProof, AuthMethod } from '../../../../../lib/platformImport';

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
  proof: z.object({
    type: z.enum(['oauth', 'api_key', 'wallet_signature', 'profile_code']),
    data: z.object({
      accessToken: z.string().optional(),
      message: z.string().optional(),
      signature: z.string().optional(),
      walletType: z.enum(['solana', 'ethereum']).optional(),
      code: z.string().optional(),
      key: z.string().optional(),
    }),
  }),
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

    const { forecasterPubkey, platform, platformUserId, proof } = validation.data;
    const platformType = platform as ExternalPlatform;

    // Check if platform supports the proof type
    const platformConfig = PLATFORM_REGISTRY[platformType];
    if (!platformConfig.authMethods.includes(proof.type as AuthMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: `${platformConfig.displayName} does not support ${proof.type} verification`,
          supportedMethods: platformConfig.authMethods,
        },
        { status: 400 }
      );
    }

    // Link the platform
    const result = await linkPlatform(
      forecasterPubkey,
      platformType,
      platformUserId,
      proof as OwnershipProof
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        link: result.link,
        message: `Successfully linked ${platformConfig.displayName} account`,
      },
    });
  } catch (error) {
    console.error('[Link Platform API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
