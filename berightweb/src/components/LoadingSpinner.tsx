'use client';

import BrandLogo from './BrandLogo';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  text?: string;
  variant?: 'default' | 'inline' | 'minimal';
}

/**
 * LoadingSpinner - Unified loading component using BeRight silver sphere logo
 *
 * @param size - Logo size in pixels (default: 48)
 * @param className - Additional CSS classes
 * @param text - Optional loading text
 * @param variant - Display style:
 *   - default: Centered with optional text
 *   - inline: Small inline spinner
 *   - minimal: Just the logo, no container
 */
export default function LoadingSpinner({
  size = 48,
  className = '',
  text,
  variant = 'default'
}: LoadingSpinnerProps) {
  if (variant === 'minimal') {
    return <BrandLogo size={size} className={`loader-sphere ${className}`} />;
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <BrandLogo size={size || 20} className="loader-sphere" />
        {text && <span className="text-sm text-gray-400">{text}</span>}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <BrandLogo size={size} className="loader-sphere" />
      {text && (
        <p className="text-sm text-gray-400 font-medium">{text}</p>
      )}
    </div>
  );
}

/**
 * FullPageLoader - Full screen loading overlay with BeRight branding
 */
export function FullPageLoader({ text }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080C14]">
      <div className="loader-logo">
        <BrandLogo size={48} className="loader-sphere" />
        <span className="loader-text">beright AI</span>
      </div>
      {text && (
        <p className="mt-4 text-gray-400 text-sm">{text}</p>
      )}
    </div>
  );
}
