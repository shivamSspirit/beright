/**
 * UI Utility Functions for BeRight Web
 * Common formatting and helper functions used across components
 */

import type { Platform } from '@/types';

// Format USD amounts with K/M suffixes
export function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

// Format percentage with sign
export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

// Format probability (0-1) to percentage
export function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// Truncate wallet address
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Format relative time
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

// Get grade color class
export function getGradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case 'S':
    case 'A':
      return 'text-green-400';
    case 'B':
      return 'text-yellow-400';
    case 'C':
      return 'text-orange-400';
    case 'D':
    case 'F':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

// Get tier display info
export function getTierInfo(tier: string): { label: string; color: string; icon: string } {
  switch (tier.toLowerCase()) {
    case 'superforecaster':
      return { label: 'Superforecaster', color: 'text-purple-400', icon: '★' };
    case 'elite':
      return { label: 'Elite', color: 'text-yellow-400', icon: '◆' };
    case 'verified':
      return { label: 'Verified', color: 'text-green-400', icon: '✓' };
    case 'rookie':
      return { label: 'Rookie', color: 'text-blue-400', icon: '○' };
    default:
      return { label: 'Unranked', color: 'text-gray-500', icon: '·' };
  }
}

// Classname utility (simple cn implementation)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
