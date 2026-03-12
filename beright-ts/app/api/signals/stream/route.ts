/**
 * Signals Stream API - Server-Sent Events (SSE)
 *
 * Real-time signal intelligence feed for the BeRight Terminal.
 * Streams signals as they're detected by the signal aggregator.
 *
 * @author BeRight Protocol
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Signal types matching the frontend
interface StreamSignal {
  id: string;
  type: 'signal';
  signalType: string;
  marketTitle: string;
  platform: string;
  strength: number;
  action: 'ALERT' | 'WATCH' | 'SKIP';
  confidence: number;
  reasoning: string;
  alertText: string;
  createdAt: string;
}

// In-memory signal buffer (in production, use Redis or similar)
const signalBuffer: StreamSignal[] = [];
const MAX_BUFFER_SIZE = 100;
const connections = new Set<ReadableStreamDefaultController>();

/**
 * Add a signal to the buffer and broadcast to all connections
 */
export function emitSignal(signal: Omit<StreamSignal, 'id' | 'type' | 'createdAt'>) {
  const fullSignal: StreamSignal = {
    ...signal,
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'signal',
    createdAt: new Date().toISOString(),
  };

  // Add to buffer
  signalBuffer.unshift(fullSignal);
  if (signalBuffer.length > MAX_BUFFER_SIZE) {
    signalBuffer.pop();
  }

  // Broadcast to all connections
  const data = `data: ${JSON.stringify(fullSignal)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);

  for (const controller of connections) {
    try {
      controller.enqueue(encoded);
    } catch (e) {
      // Connection closed, will be cleaned up
    }
  }
}

/**
 * GET /api/signals/stream
 *
 * SSE endpoint for real-time signals.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Add to connections set
      connections.add(controller);

      // Send connected event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

      // Send recent signals from buffer
      for (const signal of signalBuffer.slice(0, 20)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(signal)}\n\n`));
      }

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        connections.delete(controller);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },

    cancel() {
      // Will be handled by abort listener
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// ============================================================================
// Signal Generation (called by heartbeat/scanner services)
// ============================================================================

/**
 * Generate a sample signal (for testing/demo)
 */
export function generateTestSignal() {
  const signalTypes = ['volume_surge', 'whale_alert', 'arb_opportunity', 'price_movement', 'news_catalyst'];
  const platforms = ['polymarket', 'kalshi', 'manifold', 'dflow'];
  const actions: Array<'ALERT' | 'WATCH' | 'SKIP'> = ['ALERT', 'WATCH', 'SKIP'];

  const signalType = signalTypes[Math.floor(Math.random() * signalTypes.length)];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];
  const strength = Math.floor(Math.random() * 100);
  const confidence = Math.floor(Math.random() * 100);
  const action = strength > 70 ? 'ALERT' : strength > 40 ? 'WATCH' : 'SKIP';

  emitSignal({
    signalType,
    marketTitle: `Sample Market ${Date.now()}`,
    platform,
    strength,
    action,
    confidence,
    reasoning: `${signalType} detected with ${strength}% strength`,
    alertText: `${signalType.toUpperCase()}: ${platform} market activity`,
  });
}

// For importing in other modules
export { signalBuffer, connections };
