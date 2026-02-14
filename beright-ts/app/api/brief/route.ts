/**
 * Morning Brief API Route
 * GET /api/brief - Get today's morning brief
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering (uses request.url)
export const dynamic = 'force-dynamic';
import { generateMorningBrief, formatBriefWeb, formatBriefTelegram, formatBriefText } from '../../../skills/brief';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') as 'web' | 'telegram' | 'text' || 'web';
    const userId = searchParams.get('userId') || undefined;

    // Generate the morning brief
    const briefData = await generateMorningBrief(userId);

    // Format based on request
    let response: unknown;
    switch (format) {
      case 'telegram':
        response = {
          format: 'telegram',
          text: formatBriefTelegram(briefData),
          data: briefData,
        };
        break;
      case 'text':
        response = {
          format: 'text',
          text: formatBriefText(briefData),
          data: briefData,
        };
        break;
      default:
        response = {
          format: 'web',
          ...formatBriefWeb(briefData),
        };
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Brief API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate morning brief', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
