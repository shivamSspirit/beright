/**
 * useSignalStream — Live SSE connection to the BeRight signal intelligence feed
 *
 * Connects to /api/signals/stream and maintains a live list of signals.
 * New ALERT signals are prepended to the top of the feed.
 *
 * Usage:
 *   const { signals, connected, alertCount } = useSignalStream();
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type SignalAction = 'ALERT' | 'WATCH' | 'SKIP';

export interface LiveSignal {
  id: string;
  signalType: string;
  marketTitle: string;
  platform: string;
  strength: number;
  action: SignalAction;
  confidence: number;
  reasoning: string;
  alertText: string;
  createdAt: string;
}

interface UseSignalStreamReturn {
  signals: LiveSignal[];
  connected: boolean;
  alertCount: number;
  clearAlerts: () => void;
  lastSignal: LiveSignal | null;
}

const MAX_SIGNALS = 50;
// Use relative path - Next.js rewrites will proxy to backend
const API_BASE = '';

export function useSignalStream(): UseSignalStreamReturn {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [connected, setConnected] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Don't connect server-side
    if (typeof window === 'undefined') return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/signals/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          setConnected(true);
          return;
        }

        if (data.type === 'signal') {
          const signal: LiveSignal = {
            id: data.id || `${Date.now()}-${Math.random()}`,
            signalType: data.signalType,
            marketTitle: data.marketTitle,
            platform: data.platform,
            strength: data.strength,
            action: data.action,
            confidence: data.confidence,
            reasoning: data.reasoning || '',
            alertText: data.alertText || '',
            createdAt: data.createdAt || new Date().toISOString(),
          };

          setSignals(prev => {
            // Deduplicate by id
            const exists = prev.some(s => s.id === signal.id);
            if (exists) return prev;
            const updated = [signal, ...prev].slice(0, MAX_SIGNALS);
            return updated;
          });

          if (signal.action === 'ALERT') {
            setAlertCount(prev => prev + 1);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const clearAlerts = useCallback(() => {
    setAlertCount(0);
  }, []);

  const lastSignal = signals.length > 0 ? signals[0] : null;

  return { signals, connected, alertCount, clearAlerts, lastSignal };
}
