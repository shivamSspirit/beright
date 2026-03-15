'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/ui-utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-400">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg',
              'text-white placeholder-gray-500 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              !!icon && 'pl-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
