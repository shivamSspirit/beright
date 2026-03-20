/**
 * Mode Info API
 *
 * Returns current operating mode information for the frontend.
 * The frontend can use this to display appropriate UI indicators.
 *
 * GET /api/v2/mode
 */

import { NextResponse } from 'next/server';
import { getModeInfo } from '@/lib/demo';

export async function GET() {
  try {
    const modeInfo = getModeInfo();

    return NextResponse.json({
      success: true,
      data: {
        ...modeInfo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Mode API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get mode info',
      },
      { status: 500 }
    );
  }
}
