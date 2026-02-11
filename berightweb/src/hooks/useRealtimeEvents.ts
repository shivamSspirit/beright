/**
 * useRealtimeEvents Hook
 * Subscribe to BeRight events in realtime from Telegram and other sources
 *
 * Usage:
 *   const { events, isConnected, latestEvent } = useRealtimeEvents();
 *
 *   // Or with filters:
 *   const { events } = useRealtimeEvents({
 *     eventTypes: ['agent_response', 'arb_alert'],
 *     maxEvents: 100,
 *   });
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeToEvents,
  unsubscribeFromEvents,
  getRecentEvents,
  BerightEvent,
  EventType,
} from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeEventsOptions {
  eventTypes?: EventType[];
  sessionId?: string;
  maxEvents?: number;
  autoConnect?: boolean;
}

interface UseRealtimeEventsReturn {
  events: BerightEvent[];
  latestEvent: BerightEvent | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export function useRealtimeEvents(
  options: UseRealtimeEventsOptions = {}
): UseRealtimeEventsReturn {
  const {
    eventTypes,
    sessionId,
    maxEvents = 50,
    autoConnect = true,
  } = options;

  const [events, setEvents] = useState<BerightEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<BerightEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Handle new event
  const handleNewEvent = useCallback(
    (event: BerightEvent) => {
      setLatestEvent(event);
      setEvents((prev) => {
        const newEvents = [event, ...prev];
        // Limit number of events in memory
        return newEvents.slice(0, maxEvents);
      });
    },
    [maxEvents]
  );

  // Connect to realtime
  const connect = useCallback(() => {
    if (channelRef.current) {
      return; // Already connected
    }

    try {
      const channel = subscribeToEvents(handleNewEvent, {
        eventTypes,
        sessionId,
      });

      channelRef.current = channel;
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setIsConnected(false);
    }
  }, [handleNewEvent, eventTypes, sessionId]);

  // Disconnect from realtime
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromEvents(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setLatestEvent(null);
  }, []);

  // Load initial events and connect
  useEffect(() => {
    let mounted = true;

    async function init() {
      setIsLoading(true);

      try {
        // Load recent events
        const recentEvents = await getRecentEvents({
          limit: maxEvents,
          eventTypes,
          sessionId,
        });

        if (mounted) {
          setEvents(recentEvents);
          if (recentEvents.length > 0) {
            setLatestEvent(recentEvents[0]);
          }
        }

        // Connect to realtime if autoConnect is true
        if (mounted && autoConnect) {
          connect();
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load events'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      disconnect();
    };
  }, [maxEvents, eventTypes, sessionId, autoConnect, connect, disconnect]);

  return {
    events,
    latestEvent,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    clearEvents,
  };
}

// Convenience hooks for specific event types
export function useAgentResponses(maxEvents = 50) {
  return useRealtimeEvents({
    eventTypes: ['agent_response'],
    maxEvents,
  });
}

export function useAlerts(maxEvents = 50) {
  return useRealtimeEvents({
    eventTypes: ['arb_alert', 'whale_alert'],
    maxEvents,
  });
}

export function usePredictionEvents(maxEvents = 50) {
  return useRealtimeEvents({
    eventTypes: ['prediction'],
    maxEvents,
  });
}

export default useRealtimeEvents;
