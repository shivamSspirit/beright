/**
 * Real-time Stream API Route
 * GET /api/stream - Server-Sent Events for real-time updates
 *
 * Events:
 * - arbitrage: New arbitrage opportunity detected
 * - whale: Whale movement detected
 * - price: Significant price change
 * - heartbeat: System heartbeat (every 30s)
 */

import { NextRequest } from 'next/server';
import { getSkillLogger } from '../../../lib/logger';
import { secrets } from '../../../lib/secrets';
import {
  StreamEvent,
  StreamEventType,
  subscribe,
  broadcastEvent,
} from '../../../lib/stream';

const log = getSkillLogger('stream');

// Re-export types for convenience
export type { StreamEventType, StreamEvent };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Optional: filter by event type
  const filterTypes = searchParams.get('types')?.split(',') as StreamEventType[] | undefined;

  log.info('New SSE connection', { filterTypes });

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE-formatted data
      const sendEvent = (event: StreamEvent) => {
        // Filter if needed
        if (filterTypes && !filterTypes.includes(event.type)) {
          return;
        }

        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          // Client disconnected
          log.debug('Client disconnected during write');
        }
      };

      // Send initial connected event
      sendEvent({
        type: 'connected',
        data: {
          message: 'Connected to BeRight stream',
          filterTypes: filterTypes || 'all',
        },
        timestamp: new Date().toISOString(),
      });

      // Subscribe to events
      const unsubscribe = subscribe(sendEvent);

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        sendEvent({
          type: 'heartbeat',
          data: { status: 'ok' },
          timestamp: new Date().toISOString(),
        });
      }, 30000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        log.info('Client disconnected');
        clearInterval(heartbeatInterval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
