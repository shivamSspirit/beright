/**
 * GET /api/v2/credit/[pubkey]/limits
 *
 * Get just the credit limits for a forecaster (lighter response).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCreditLimitsResponse, DEFAULT_CREDIT_CONFIG } from '@/lib/credit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  try {
    const { pubkey } = await params;

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 44) {
      return NextResponse.json(
        { success: false, pubkey: pubkey || '', error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    const response = await getCreditLimitsResponse(pubkey, DEFAULT_CREDIT_CONFIG);

    if (!response.success) {
      return NextResponse.json(response, { status: 404 });
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Credit limits error:', error);
    return NextResponse.json(
      {
        success: false,
        pubkey: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
