'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'ai'
  | 'fire'
  | 'gold';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}

/**
 * Badge - Unified badge/pill component for BeRight
 *
 * Variants:
 * - default: Neutral gray
 * - primary: Brand green
 * - success: Green (same as primary)
 * - warning: Amber/orange
 * - danger: Red
 * - info: Cyan/blue
 * - ai: Purple (AI features)
 * - fire: Orange (trending)
 * - gold: Gold (achievements)
 *
 * Sizes: sm, md
 */
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      dot = false,
      pulse = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const classNames = [
      styles.badge,
      styles[variant],
      styles[size],
      dot && styles.withDot,
      pulse && styles.pulse,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={classNames} {...props}>
        {dot && <span className={styles.dot} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
