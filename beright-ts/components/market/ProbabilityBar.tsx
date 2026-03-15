'use client';

import { cn } from '@/lib/ui-utils';

interface ProbabilityBarProps {
  probability: number;
  showLabels?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProbabilityBar({
  probability,
  showLabels = true,
  size = 'md',
  className,
}: ProbabilityBarProps) {
  const yesPct = (probability * 100).toFixed(0);
  const noPct = ((1 - probability) * 100).toFixed(0);

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'w-full bg-gray-700 rounded-full overflow-hidden',
          size === 'sm' ? 'h-2' : 'h-3'
        )}
      >
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
          style={{ width: `${probability * 100}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs">
          <span className="text-green-400">{yesPct}% YES</span>
          <span className="text-red-400">{noPct}% NO</span>
        </div>
      )}
    </div>
  );
}
