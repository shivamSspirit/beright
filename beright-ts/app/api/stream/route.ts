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

const log = getSkillLogger('stream');

// Event types
export type StreamEventType = 'arbitrage' | 'whale' | 'price' | 'heartbeat' | 'error' | 'connected';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
}

// Global event emitter for broadcasting
type EventCallback = (event: StreamEvent) => void;
const subscribers = new Set<EventCallback>();

// Broadcast an event to all connected clients
export function broadcastEvent(type: StreamEventType, data: unknown): void {
  const event: StreamEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  log.debug('Broadcasting event', { type, subscriberCount: subscribers.size });

  subscribers.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      log.error('Error broadcasting to subscriber', error);
    }
  });
}

// Helper to broadcast arbitrage
export function broadcastArbitrage(opportunity: {
  topic: string;
  platformA: string;
  platformB: string;
  spread: number;
  profitPercent: number;
}): void {
  broadcastEvent('arbitrage', opportunity);
}

// Helper to broadcast whale activity
export function broadcastWhale(activity: {
  wallet: string;
  action: string;
  amount: number;
  market?: string;
}): void {
  broadcastEvent('whale', activity);
}

// Helper to broadcast price alert
export function broadcastPrice(alert: {
  market: string;
  platform: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
}): void {
  broadcastEvent('price', alert);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Optional: filter by event type
  const filterTypes = searchParams.get('types')?.split(',') as StreamEventType[] | undefined;

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({
        message: 'Connected to BeRight stream',
        timestamp: new Date().toISOString(),
        filters: filterTypes || 'all',
      })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      log.info('Client connected to stream', {
        filters: filterTypes,
      });

      // Subscribe to events
      const callback: EventCallback = (event) => {
        // Apply filter if specified
        if (filterTypes && !filterTypes.includes(event.type)) {
          return;
        }

        try {
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (error) {
          log.error('Error sending SSE event', error);
        }
      };

      subscribers.add(callback);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
            subscribers: subscribers.size,
          })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          // Client disconnected
          clearInterval(heartbeatInterval);
          subscribers.delete(callback);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        log.info('Client disconnected from stream');
        clearInterval(heartbeatInterval);
        subscribers.delete(callback);
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

// Export subscriber count for monitoring
export function getSubscriberCount(): number {
  return subscribers.size;
}
