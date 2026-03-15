'use client';

import { cn } from '@/lib/ui-utils';
import { PLATFORM_BADGE_CLASSES, PLATFORM_TEXT_CLASSES } from '@/lib/constants';
import type { Platform } from '@/types';

interface PlatformBadgeProps {
  platform: string;
  variant?: 'filled' | 'text';
  size?: 'sm' | 'md';
  className?: string;
}

export function PlatformBadge({
  platform,
  variant = 'filled',
  size = 'sm',
  className,
}: PlatformBadgeProps) {
  const platformKey = platform.toLowerCase() as Platform;
  const displayName = platform.slice(0, 4).toUpperCase();

  if (variant === 'text') {
    return (
      <span
        className={cn(
          'font-semibold uppercase',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
          PLATFORM_TEXT_CLASSES[platformKey] || 'text-gray-400',
          className
        )}
      >
        {displayName}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold text-white uppercase rounded',
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
        PLATFORM_BADGE_CLASSES[platformKey] || 'bg-gray-600',
        className
      )}
    >
      {displayName}
    </span>
  );
}
