/**
 * Affiliate Program API
 *
 * GET /api/v2/yield/affiliate - Get affiliate status and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAffiliateSetup,
  getAffiliateStats,
  getPartnership,
  isAffiliateConfigured,
  AFFILIATE_REGISTRATION_GUIDE,
} from '@/lib/yield/meteora';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'verify': {
        const verification = await verifyAffiliateSetup();
        return NextResponse.json({
          success: true,
          action: 'verify',
          data: verification,
        });
      }

      case 'stats': {
        if (!isAffiliateConfigured()) {
          return NextResponse.json({
            success: false,
            error: 'Affiliate not configured',
            guide: AFFILIATE_REGISTRATION_GUIDE,
          });
        }

        const stats = await getAffiliateStats();
        return NextResponse.json({
          success: true,
          action: 'stats',
          data: stats ? {
            partnerId: stats.partnerId,
            totalVolumeRouted: stats.totalVolumeRouted.toString(),
            totalFeesEarned: stats.totalFeesEarned.toString(),
            activeUsers: stats.activeUsers,
            transactions: stats.transactions,
          } : null,
        });
      }

      case 'partnership': {
        const partnership = await getPartnership();
        return NextResponse.json({
          success: true,
          action: 'partnership',
          data: partnership,
        });
      }

      case 'guide': {
        return NextResponse.json({
          success: true,
          action: 'guide',
          data: {
            configured: isAffiliateConfigured(),
            guide: AFFILIATE_REGISTRATION_GUIDE,
          },
        });
      }

      default: {
        // Status check
        const configured = isAffiliateConfigured();
        const partnership = configured ? await getPartnership() : null;

        return NextResponse.json({
          success: true,
          action: 'status',
          data: {
            configured,
            partnership,
            availableActions: ['verify', 'stats', 'partnership', 'guide'],
          },
        });
      }
    }
  } catch (error) {
    console.error('[Affiliate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process affiliate request' },
      { status: 500 }
    );
  }
}
