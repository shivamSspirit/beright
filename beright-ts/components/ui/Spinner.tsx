'use client';

import { cn } from '@/lib/ui-utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-2',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-gray-600 border-t-green-500 animate-spin',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Spinner size={size} />
      <p className="mt-4 text-sm">{message}</p>
    </div>
  );
}
