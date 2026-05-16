/**
 * Terminal Component Types
 *
 * Shared types for all terminal components.
 */

export type ViewMode = 'terminal' | 'markets' | 'agents' | 'intel' | 'signals' | 'portfolio' | 'risk' | 'analyst';

export interface AgentLog {
  id: string;
  agent: 'SCOUT' | 'ANALYST' | 'TRADER' | 'BUILDER' | 'SYSTEM';
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'data';
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'error' | 'success' | 'data' | 'link';
  content: string;
  timestamp: Date;
}

export interface MarketTick {
  id: string;
  title: string;
  price: number;
  change: number;
  platform: string;
}

// Agent configurations (matching beright-ts/config/agents.ts)
export const AGENTS_CONFIG = {
  SCOUT: {
    color: '#00fff7',    // Cyan
    model: 'sonnet',
    specialization: 'Market Scanning',
    capabilities: ['Arbitrage', 'Hot Markets', 'Volume Spikes'],
  },
  ANALYST: {
    color: '#ff00ff',    // Magenta
    model: 'opus',
    specialization: 'Deep Research',
    capabilities: ['Superforecaster', 'Base Rates', 'Calibration'],
  },
  TRADER: {
    color: '#00ff00',    // Matrix green
    model: 'sonnet',
    specialization: 'Trade Execution',
    capabilities: ['Quotes', 'Positions', 'Whale Tracking'],
  },
  BUILDER: {
    color: '#ffae00',    // Amber
    model: 'opus',
    specialization: 'Code Generation',
    capabilities: ['Frontend', 'Backend', 'Testing'],
  },
  SYSTEM: {
    color: '#666',       // Gray
    model: 'system',
    specialization: 'System',
    capabilities: [],
  },
} as const;

// Agent colors for quick lookup
export const AGENT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(AGENTS_CONFIG).map(([k, v]) => [k, v.color])
);

// Signal action colors
export const SIGNAL_ACTION_COLOR: Record<string, string> = {
  ALERT: '#ff0055',
  WATCH: '#00fff7',
  SKIP:  '#444',
};

// Signal type labels
export const SIGNAL_TYPE_LABEL: Record<string, string> = {
  volume_surge:        'VOL SURGE',
  odds_shift:          'ODDS SHIFT',
  arb_opportunity:     'ARB',
  resolution_imminent: 'RESOLVING',
  new_market:          'NEW MKT',
  smart_money:         'SMART $',
  narrative_emergence: 'NARRATIVE',
  cross_market:        'CROSS-MKT',
  insider_pattern:     'INSIDER',
  consensus_flip:      'FLIP',
  whale_entry:         'WHALE',
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
