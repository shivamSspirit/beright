/**
 * Formatting Utilities for BeRight Protocol
 * Consolidated formatting functions used across the codebase
 */

/**
 * Format options for customization
 */
export interface FormatOptions {
  /** Number of decimal places */
  precision?: number;
  /** Include sign (+/-) */
  showSign?: boolean;
  /** Compact large numbers (1.5M instead of 1,500,000) */
  compact?: boolean;
  /** Currency symbol */
  currency?: string;
}

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * Format a number as USD
 * @example formatUsd(1500000) => "$1.5M"
 * @example formatUsd(1234.56) => "$1,234.56"
 */
export function formatUsd(amount: number, options: FormatOptions = {}): string {
  const { precision = 2, showSign = false, compact = true, currency = '$' } = options;

  if (!Number.isFinite(amount)) {
    return `${currency}--`;
  }

  const absAmount = Math.abs(amount);
  const sign = showSign && amount > 0 ? '+' : '';
  const negSign = amount < 0 ? '-' : '';

  if (compact) {
    if (absAmount >= 1_000_000_000) {
      return `${negSign}${sign}${currency}${(absAmount / 1_000_000_000).toFixed(1)}B`;
    }
    if (absAmount >= 1_000_000) {
      return `${negSign}${sign}${currency}${(absAmount / 1_000_000).toFixed(1)}M`;
    }
    if (absAmount >= 10_000) {
      return `${negSign}${sign}${currency}${(absAmount / 1_000).toFixed(1)}K`;
    }
  }

  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return `${negSign}${sign}${currency}${formatted}`;
}

/**
 * Parse USD string back to number
 * @example parseUsd("$1.5M") => 1500000
 */
export function parseUsd(str: string): number {
  const cleaned = str.replace(/[$,]/g, '').trim();

  if (cleaned.endsWith('B') || cleaned.endsWith('b')) {
    return parseFloat(cleaned) * 1_000_000_000;
  }
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    return parseFloat(cleaned) * 1_000_000;
  }
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    return parseFloat(cleaned) * 1_000;
  }

  return parseFloat(cleaned);
}

// ============================================================================
// Percentage Formatting
// ============================================================================

/**
 * Format a number as percentage
 * @example formatPct(0.75) => "75.0%"
 * @example formatPct(75) => "75.0%" (auto-detects if already percentage)
 */
export function formatPct(value: number, options: FormatOptions = {}): string {
  const { precision = 1, showSign = false } = options;

  if (!Number.isFinite(value)) {
    return '--%';
  }

  // Auto-detect if value is already a percentage (>1 or <-1)
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  const sign = showSign && pct > 0 ? '+' : '';

  return `${sign}${pct.toFixed(precision)}%`;
}

/**
 * Format probability (0-1) as percentage
 * Always treats input as decimal probability
 */
export function formatProb(prob: number, options: FormatOptions = {}): string {
  const { precision = 0 } = options;

  if (!Number.isFinite(prob)) {
    return '--%';
  }

  const pct = Math.max(0, Math.min(100, prob * 100));
  return `${pct.toFixed(precision)}%`;
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a large number with compact notation
 * @example formatNumber(1500000) => "1.5M"
 */
export function formatNumber(num: number, options: FormatOptions = {}): string {
  const { precision = 1 } = options;

  if (!Number.isFinite(num)) {
    return '--';
  }

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return `${sign}${(absNum / 1_000_000_000).toFixed(precision)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${sign}${(absNum / 1_000_000).toFixed(precision)}M`;
  }
  if (absNum >= 1_000) {
    return `${sign}${(absNum / 1_000).toFixed(precision)}K`;
  }

  return `${sign}${absNum.toFixed(precision)}`;
}

/**
 * Format number with thousands separators
 * @example formatWithCommas(1234567) => "1,234,567"
 */
export function formatWithCommas(num: number): string {
  if (!Number.isFinite(num)) {
    return '--';
  }
  return num.toLocaleString('en-US');
}

// ============================================================================
// Price Formatting (for prediction markets)
// ============================================================================

/**
 * Format price as cents (0-100)
 * @example formatPrice(0.75) => "75¢"
 */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) {
    return '--¢';
  }

  // Handle both 0-1 and 0-100 inputs
  const cents = price <= 1 ? Math.round(price * 100) : Math.round(price);
  return `${cents}¢`;
}

/**
 * Format price with implied probability arrow
 * @example formatPriceWithArrow(0.75, 0.70) => "75¢ ↑"
 */
export function formatPriceWithArrow(current: number, previous: number): string {
  const currentCents = current <= 1 ? Math.round(current * 100) : Math.round(current);
  const diff = current - previous;

  let arrow = '';
  if (Math.abs(diff) > 0.01) {
    arrow = diff > 0 ? ' ↑' : ' ↓';
  }

  return `${currentCents}¢${arrow}`;
}

// ============================================================================
// Date/Time Formatting
// ============================================================================

/**
 * Format date in human-readable form
 * @example formatDate(new Date()) => "Mar 15, 2024"
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '--';
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date with time
 * @example formatDateTime(new Date()) => "Mar 15, 2024 2:30 PM"
 */
export function formatDateTime(date: Date | string | null): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '--';
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format relative time
 * @example formatRelativeTime(new Date(Date.now() - 3600000)) => "1 hour ago"
 */
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '--';
  }

  const now = Date.now();
  const diff = now - d.getTime();
  const absDiff = Math.abs(diff);
  const isFuture = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let value: string;
  if (days > 0) {
    value = `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    value = `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    value = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    value = 'just now';
    return value;
  }

  return isFuture ? `in ${value}` : `${value} ago`;
}

/**
 * Format duration in human-readable form
 * @example formatDuration(3661000) => "1h 1m"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '--';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Truncate text with ellipsis
 * @example truncate("Hello World", 8) => "Hello..."
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 * @example capitalize("hello") => "Hello"
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert to title case
 * @example titleCase("hello world") => "Hello World"
 */
export function titleCase(text: string): string {
  if (!text) return '';
  return text.split(' ').map(capitalize).join(' ');
}

// ============================================================================
// Platform-Specific Formatting
// ============================================================================

/**
 * Format platform name for display
 */
export function formatPlatform(platform: string): string {
  const names: Record<string, string> = {
    polymarket: 'Polymarket',
    kalshi: 'Kalshi',
    limitless: 'Limitless',
    manifold: 'Manifold',
    metaculus: 'Metaculus',
    jupiter: 'Jupiter',
  };
  return names[platform.toLowerCase()] || capitalize(platform);
}

/**
 * Format spread as basis points or percentage
 * @example formatSpread(0.02) => "2.0%"
 */
export function formatSpread(spread: number): string {
  if (!Number.isFinite(spread)) {
    return '--%';
  }

  // Convert to percentage if decimal
  const pct = Math.abs(spread) <= 1 ? spread * 100 : spread;
  return `${pct.toFixed(1)}%`;
}
