'use client';

import { cn } from '@/lib/ui-utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-700 text-gray-300 border-gray-600',
  success: 'bg-green-900/50 text-green-400 border-green-700/50',
  warning: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  danger: 'bg-red-900/50 text-red-400 border-red-700/50',
  info: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
};

const sizeClasses = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        variantClasses[variant],
        sizeClasses[size],
        pulse && 'animate-pulse',
        className
      )}
    >
      {children}
    </span>
  );
}
