/**
 * Design Constants for BeRight Web
 * Platform colors, design tokens, and configuration
 */

import type { Platform } from '@/types';

// Platform color mapping
export const PLATFORM_COLORS: Record<Platform, string> = {
  polymarket: '#8b5cf6',
  kalshi: '#3b82f6',
  manifold: '#eab308',
  metaculus: '#ef4444',
  limitless: '#22c55e',
  jupiter: '#9333ea',
};

// Platform badge classes (Tailwind)
export const PLATFORM_BADGE_CLASSES: Record<Platform, string> = {
  polymarket: 'bg-purple-600',
  kalshi: 'bg-blue-600',
  manifold: 'bg-yellow-600',
  metaculus: 'bg-red-600',
  limitless: 'bg-green-600',
  jupiter: 'bg-purple-700',
};

// Platform text color classes
export const PLATFORM_TEXT_CLASSES: Record<string, string> = {
  polymarket: 'text-purple-400',
  kalshi: 'text-blue-400',
  manifold: 'text-yellow-400',
  metaculus: 'text-red-400',
  limitless: 'text-green-400',
  jupiter: 'text-purple-400',
};

// Semantic colors
export const SEMANTIC_COLORS = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#6b7280',
} as const;

// Navigation links
export const NAV_LINKS = [
  { href: '/', label: 'Terminal' },
  { href: '/swipe', label: 'Swipe' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/markets', label: 'Markets' },
] as const;

// Tier thresholds for Brier scores
export const TIER_THRESHOLDS = {
  superforecaster: 0.15,
  elite: 0.20,
  verified: 0.25,
  rookie: 0.35,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  markets: '/api/v2/markets',
  trending: '/api/v2/markets/trending',
  calibration: '/api/v2/calibration',
  forecasters: '/api/forecasters',
  factCheck: '/api/v2/fact-check',
  signals: '/api/signals/stream',
} as const;
