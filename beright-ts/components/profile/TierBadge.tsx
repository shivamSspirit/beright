'use client';

import { cn } from '@/lib/ui-utils';
import { getTierInfo } from '@/lib/ui-utils';
import type { ForecasterTier } from '@/types';

interface TierBadgeProps {
  tier: ForecasterTier | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function TierBadge({ tier, size = 'md', showLabel = true, className }: TierBadgeProps) {
  const { label, color, icon } = getTierInfo(tier);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full bg-gray-800 border border-gray-700',
        color,
        sizeClasses[size],
        className
      )}
    >
      <span>{icon}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
}
