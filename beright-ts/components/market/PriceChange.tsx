'use client';

import { cn } from '@/lib/ui-utils';

interface PriceChangeProps {
  change: number;
  suffix?: string;
  size?: 'sm' | 'md';
  showSign?: boolean;
  className?: string;
}

export function PriceChange({
  change,
  suffix = 'pp',
  size = 'sm',
  showSign = true,
  className,
}: PriceChangeProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const sign = showSign && isPositive ? '+' : '';

  return (
    <span
      className={cn(
        'font-medium',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        isPositive && 'text-green-400',
        isNegative && 'text-red-400',
        !isPositive && !isNegative && 'text-gray-500',
        className
      )}
    >
      {sign}
      {change.toFixed(1)}
      {suffix}
    </span>
  );
}
