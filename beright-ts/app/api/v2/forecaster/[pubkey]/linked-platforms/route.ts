/**
 * Linked Platforms API
 *
 * GET /api/v2/forecaster/:pubkey/linked-platforms
 *
 * Returns all linked external platforms for a forecaster.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLinkedPlatforms } from '../../../../../../lib/platformImport';
import type { ExternalPlatformLink } from '../../../../../../lib/platformImport';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
): Promise<NextResponse> {
  try {
    const { pubkey } = await params;

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    const platforms = await getLinkedPlatforms(pubkey);

    // Filter sensitive data for public response
    const publicPlatforms = platforms.map((p: ExternalPlatformLink) => ({
      id: p.id,
      platform: p.platform,
      platformUserId: p.platformUserId,
      platformProfileUrl: p.platformProfileUrl,
      verifiedAt: p.verifiedAt,
      verificationMethod: p.verificationMethod,
      importedStats: {
        brierScore: p.importedStats?.brierScore,
        predictionCount: p.importedStats?.predictionCount,
        resolvedCount: p.importedStats?.resolvedCount,
        accuracy: p.importedStats?.accuracy,
        platformRank: p.importedStats?.platformRank,
        platformPercentile: p.importedStats?.platformPercentile,
        totalVolumeUsd: p.importedStats?.totalVolumeUsd,
        profitLossUsd: p.importedStats?.profitLossUsd,
        roi: p.importedStats?.roi,
        importedAt: p.importedStats?.importedAt,
        // Omit rawData for privacy
      },
      lastRefreshedAt: p.lastRefreshedAt,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        forecasterPubkey: pubkey,
        platforms: publicPlatforms,
        totalLinked: publicPlatforms.length,
        verifiedCount: publicPlatforms.filter((p: { verifiedAt: string | null }) => p.verifiedAt).length,
      },
    });
  } catch (error) {
    console.error('[Linked Platforms API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
