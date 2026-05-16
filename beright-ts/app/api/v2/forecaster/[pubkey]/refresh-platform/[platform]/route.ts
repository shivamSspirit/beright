/**
 * Refresh Platform Stats API
 *
 * POST /api/v2/forecaster/:pubkey/refresh-platform/:platform
 *
 * Re-fetches stats from an external platform and updates composite score.
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshPlatformStats, PLATFORM_REGISTRY } from '../../../../../../../lib/platformImport';
import type { ExternalPlatform } from '../../../../../../../lib/platformImport';

// =============================================================================
// VALID PLATFORMS
// =============================================================================

const VALID_PLATFORMS = [
  'metaculus',
  'manifold',
  'goodjudgment',
  'polymarket',
  'kalshi',
  'infer',
  'hypermind',
  'predictit',
] as const;

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pubkey: string; platform: string }> }
): Promise<NextResponse> {
  try {
    const { pubkey, platform } = await params;

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid platform: ${platform}`,
          validPlatforms: VALID_PLATFORMS,
        },
        { status: 400 }
      );
    }

    const platformType = platform as ExternalPlatform;
    const platformConfig = PLATFORM_REGISTRY[platformType];

    // Check if platform supports auto-refresh
    if (!platformConfig.canAutoRefresh) {
      return NextResponse.json(
        {
          success: false,
          error: `${platformConfig.displayName} does not support automatic refresh`,
        },
        { status: 400 }
      );
    }

    // Refresh stats
    const result = await refreshPlatformStats(pubkey, platformType);

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
        forecasterPubkey: pubkey,
        platform: platformType,
        platformDisplayName: platformConfig.displayName,
        refreshedAt: new Date().toISOString(),
        message: `Successfully refreshed stats from ${platformConfig.displayName}`,
      },
    });
  } catch (error) {
    console.error('[Refresh Platform API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/forecaster/:pubkey/refresh-platform/:platform
 *
 * Unlinks a platform from the forecaster's account.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pubkey: string; platform: string }> }
): Promise<NextResponse> {
  try {
    const { pubkey, platform } = await params;
    const { unlinkPlatform } = await import('../../../../../../../lib/platformImport');

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid platform: ${platform}`,
          validPlatforms: VALID_PLATFORMS,
        },
        { status: 400 }
      );
    }

    const platformType = platform as ExternalPlatform;
    const platformConfig = PLATFORM_REGISTRY[platformType];

    // Unlink the platform
    const result = await unlinkPlatform(pubkey, platformType);

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
        forecasterPubkey: pubkey,
        platform: platformType,
        message: `Successfully unlinked ${platformConfig.displayName}`,
      },
    });
  } catch (error) {
    console.error('[Unlink Platform API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
