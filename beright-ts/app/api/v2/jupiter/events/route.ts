/**
 * Jupiter Prediction Events API
 *
 * GET /api/v2/jupiter/events - List prediction events
 * GET /api/v2/jupiter/events?id=<eventId> - Get single event
 * GET /api/v2/jupiter/events?q=<query> - Search events
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEvents,
  getEvent,
  searchEvents,
  getHotEvents,
  JupiterEventsParams,
} from '../../../../../lib/jupiter/prediction';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get single event by ID
    const eventId = searchParams.get('id');
    if (eventId) {
      const response = await getEvent(eventId);
      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Event not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // Search events
    const query = searchParams.get('q');
    if (query) {
      const response = await searchEvents({
        query,
        category: searchParams.get('category') as any,
        provider: searchParams.get('provider') as any,
        limit: parseInt(searchParams.get('limit') || '20'),
        includeMarkets: searchParams.get('includeMarkets') !== 'false',
      });

      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Search failed' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // Get hot/trending events (default)
    const hot = searchParams.get('hot') === 'true';
    if (hot) {
      const limit = parseInt(searchParams.get('limit') || '20');
      const response = await getHotEvents(limit);

      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Failed to fetch hot events' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // List events with filters
    const params: JupiterEventsParams = {
      category: searchParams.get('category') as any,
      provider: searchParams.get('provider') as any,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as any,
      sortOrder: searchParams.get('sortOrder') as any,
      includeMarkets: searchParams.get('includeMarkets') !== 'false',
    };

    // Parse status array
    const statusParam = searchParams.get('status');
    if (statusParam) {
      params.status = statusParam.split(',') as any;
    }

    const response = await getEvents(params);

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      pagination: {
        limit: params.limit,
        offset: params.offset,
      },
    });
  } catch (error) {
    console.error('[Jupiter Events API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
