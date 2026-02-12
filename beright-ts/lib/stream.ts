/**
 * Real-time Stream Utilities
 * Shared broadcasting functionality for Server-Sent Events
 */

import { getSkillLogger } from './logger';

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

// Subscribe to events
export function subscribe(callback: EventCallback): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

// Get current subscriber count
export function getSubscriberCount(): number {
  return subscribers.size;
}

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
