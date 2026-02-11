/**
 * AgentFeed Component
 * Shows realtime agent activity from Telegram and other sources
 *
 * Usage:
 *   <AgentFeed />
 *   <AgentFeed maxEvents={20} showAlerts />
 */

'use client';

import { useState } from 'react';
import { useRealtimeEvents, useAlerts } from '../hooks/useRealtimeEvents';
import type { BerightEvent, AgentType } from '../lib/supabase';

interface AgentFeedProps {
  maxEvents?: number;
  showAlerts?: boolean;
  className?: string;
}

// Agent color mapping
const agentColors: Record<AgentType, string> = {
  scout: 'bg-blue-500',
  analyst: 'bg-purple-500',
  trader: 'bg-green-500',
  commander: 'bg-gray-500',
};

// Mood emoji mapping
const moodEmoji: Record<string, string> = {
  BULLISH: '📈',
  BEARISH: '📉',
  NEUTRAL: '📊',
  ALERT: '🚨',
  EDUCATIONAL: '📚',
  ERROR: '❌',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function EventCard({ event }: { event: BerightEvent }) {
  const agentColor = event.agent ? agentColors[event.agent] : 'bg-gray-400';
  const emoji = event.mood ? moodEmoji[event.mood] || '📊' : '📊';

  return (
    <div className="border border-gray-700 rounded-lg p-3 mb-2 bg-gray-800/50 hover:bg-gray-800 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {event.agent && (
            <span className={`${agentColor} text-white text-xs px-2 py-0.5 rounded-full uppercase font-medium`}>
              {event.agent}
            </span>
          )}
          <span className="text-lg">{emoji}</span>
          {event.telegram_username && (
            <span className="text-gray-400 text-sm">@{event.telegram_username}</span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{formatTime(event.created_at)}</span>
      </div>

      {event.command && (
        <div className="text-gray-400 text-sm mb-1 font-mono bg-gray-900 rounded px-2 py-1">
          {event.command}
        </div>
      )}

      {event.response && (
        <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
          {event.response.length > 300 ? `${event.response.slice(0, 300)}...` : event.response}
        </div>
      )}
    </div>
  );
}

function AlertCard({ event }: { event: BerightEvent }) {
  const isArb = event.event_type === 'arb_alert';

  return (
    <div className={`border rounded-lg p-3 mb-2 ${isArb ? 'border-yellow-500 bg-yellow-900/20' : 'border-blue-500 bg-blue-900/20'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{isArb ? '💰' : '🐋'}</span>
        <span className="font-medium text-white">{isArb ? 'Arbitrage Alert' : 'Whale Alert'}</span>
        <span className="text-gray-500 text-xs ml-auto">{formatTime(event.created_at)}</span>
      </div>
      {event.response && (
        <div className="text-gray-300 text-sm">{event.response}</div>
      )}
    </div>
  );
}

export function AgentFeed({ maxEvents = 30, showAlerts = true, className = '' }: AgentFeedProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'alerts'>('all');

  const { events, isConnected, isLoading, latestEvent } = useRealtimeEvents({
    eventTypes: ['agent_response'],
    maxEvents,
  });

  const { events: alertEvents } = useAlerts(20);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Agent Activity</h2>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">{isConnected ? 'Live' : 'Disconnected'}</span>
        </div>

        {showAlerts && (
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${activeTab === 'alerts' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Alerts
              {alertEvents.length > 0 && (
                <span className="bg-yellow-500 text-black text-xs px-1.5 rounded-full">{alertEvents.length}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Latest Event Banner */}
      {latestEvent && activeTab === 'all' && (
        <div className="px-4 py-2 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">Latest:</span>
            <span className="text-white font-medium">{latestEvent.agent?.toUpperCase()}</span>
            <span className="text-gray-400 truncate">{latestEvent.command?.slice(0, 40)}...</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : activeTab === 'all' ? (
          events.length > 0 ? (
            events.map((event) => <EventCard key={event.id} event={event} />)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No agent activity yet</p>
              <p className="text-sm mt-1">Events from Telegram will appear here in realtime</p>
            </div>
          )
        ) : (
          alertEvents.length > 0 ? (
            alertEvents.map((event) => <AlertCard key={event.id} event={event} />)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No alerts yet</p>
              <p className="text-sm mt-1">Arbitrage and whale alerts will appear here</p>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{events.length} events loaded</span>
        <span>Synced with Telegram</span>
      </div>
    </div>
  );
}

export default AgentFeed;
