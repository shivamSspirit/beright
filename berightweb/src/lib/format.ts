/**
 * BeRight Formatting Utilities
 *
 * Centralized formatting functions used across all pages:
 * - Currency (USD, crypto)
 * - Percentages
 * - Numbers (compact, with commas)
 * - Dates and times
 */

export interface CurrencyFormatOptions {
  /** Use compact notation (e.g., $1.2M instead of $1,200,000) */
  compact?: boolean;
  /** Show sign for positive values (e.g., +$100) */
  showSign?: boolean;
  /** Number of decimal places (default: 2 for non-compact, 1 for compact) */
  decimals?: number;
  /** Currency symbol (default: $) */
  symbol?: string;
}

/**
 * Format a value as currency
 * @param value The numeric value to format
 * @param options Formatting options
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234567) // "$1,234,567.00"
 * formatCurrency(1234567, { compact: true }) // "$1.2M"
 * formatCurrency(1234567, { compact: true, showSign: true }) // "+$1.2M"
 * formatCurrency(-500) // "-$500.00"
 * formatCurrency(0) // "$0.00"
 */
export function formatCurrency(
  value: number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    compact = false,
    showSign = false,
    decimals,
    symbol = '$',
  } = options;

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  let formatted: string;

  if (compact) {
    const decimalPlaces = decimals ?? 1;

    if (absValue >= 1_000_000_000) {
      formatted = `${(absValue / 1_000_000_000).toFixed(decimalPlaces)}B`;
    } else if (absValue >= 1_000_000) {
      formatted = `${(absValue / 1_000_000).toFixed(decimalPlaces)}M`;
    } else if (absValue >= 1_000) {
      formatted = `${(absValue / 1_000).toFixed(decimalPlaces)}K`;
    } else {
      formatted = absValue.toFixed(decimalPlaces);
    }
  } else {
    const decimalPlaces = decimals ?? 2;
    formatted = absValue.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  }

  // Build the final string
  let result = '';

  if (isNegative) {
    result = `-${symbol}${formatted}`;
  } else if (showSign && value > 0) {
    result = `+${symbol}${formatted}`;
  } else {
    result = `${symbol}${formatted}`;
  }

  return result;
}

/**
 * Format a percentage value
 * @param value The percentage (0-100 or 0-1 depending on asDecimal)
 * @param options Formatting options
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(75.5) // "75.5%"
 * formatPercentage(0.755, { asDecimal: true }) // "75.5%"
 * formatPercentage(75.5, { decimals: 0 }) // "76%"
 */
export function formatPercentage(
  value: number,
  options: {
    decimals?: number;
    asDecimal?: boolean;
    showSign?: boolean;
  } = {}
): string {
  const { decimals = 1, asDecimal = false, showSign = false } = options;

  const percentage = asDecimal ? value * 100 : value;
  const formatted = percentage.toFixed(decimals);

  if (showSign && percentage > 0) {
    return `+${formatted}%`;
  }

  return `${formatted}%`;
}

/**
 * Format a large number with compact notation
 * @param value The numeric value
 * @param decimals Number of decimal places
 * @returns Formatted string
 *
 * @example
 * formatCompactNumber(1234567) // "1.2M"
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(123) // "123"
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toString();
}

/**
 * Format a number with comma separators
 * @param value The numeric value
 * @param decimals Number of decimal places
 * @returns Formatted string
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234567.89, 2) // "1,234,567.89"
 */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a wallet address with ellipsis
 * @param address Full wallet address
 * @param startChars Characters to show at start (default: 6)
 * @param endChars Characters to show at end (default: 4)
 * @returns Shortened address
 *
 * @example
 * formatAddress("0x1234567890abcdef1234567890abcdef12345678") // "0x1234...5678"
 */
export function formatAddress(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format a date as relative time
 * @param date Date or timestamp
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 60000)) // "1m ago"
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1h ago"
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a countdown timer
 * @param endDate Target date
 * @returns Countdown string
 *
 * @example
 * formatCountdown(new Date(Date.now() + 86400000)) // "1d 0h"
 * formatCountdown(new Date(Date.now() + 3600000)) // "1h 0m"
 */
export function formatCountdown(endDate: Date | string | number): {
  text: string;
  isUrgent: boolean;
  isPast: boolean;
} {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: 'Ended', isUrgent: false, isPast: true };
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const isUrgent = diffDay === 0 && diffHour < 24;

  if (diffDay > 0) {
    return {
      text: `${diffDay}d ${diffHour % 24}h`,
      isUrgent: false,
      isPast: false,
    };
  }

  if (diffHour > 0) {
    return {
      text: `${diffHour}h ${diffMin % 60}m`,
      isUrgent,
      isPast: false,
    };
  }

  return {
    text: `${diffMin}m`,
    isUrgent: true,
    isPast: false,
  };
}

/**
 * Format market volume for display
 * @param volume Volume in USD
 * @returns Formatted volume string
 */
export function formatVolume(volume: number): string {
  return formatCurrency(volume, { compact: true, decimals: 1 });
}

/**
 * Format profit/loss with color hint
 * @param value PnL value
 * @returns Object with formatted string and color class
 */
export function formatPnL(value: number): {
  text: string;
  isPositive: boolean;
  isNegative: boolean;
} {
  const text = formatCurrency(value, { compact: true, showSign: true });
  return {
    text,
    isPositive: value > 0,
    isNegative: value < 0,
  };
}
