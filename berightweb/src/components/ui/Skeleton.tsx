'use client';

import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
}

export default function Skeleton({
  width,
  height,
  borderRadius,
  className = '',
  variant = 'text',
  animation = 'pulse',
}: SkeletonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return { borderRadius: '50%' };
      case 'rectangular':
        return { borderRadius: 0 };
      case 'rounded':
        return { borderRadius: '8px' };
      case 'text':
      default:
        return { borderRadius: '4px' };
    }
  };

  const style: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? (variant === 'text' ? '1em' : undefined),
    ...getVariantStyles(),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[animation]} ${className}`}
      style={style}
      role="status"
      aria-label="Loading..."
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1em"
          width={i === lines - 1 && lines > 1 ? '80%' : '100%'}
          className={styles.textLine}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton variant="circular" width={size} height={size} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.cardHeader}>
        <SkeletonAvatar />
        <div className={styles.cardHeaderText}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonLeaderboardRow({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.leaderboardRow} ${className}`}>
      <Skeleton width={24} height={24} variant="circular" />
      <SkeletonAvatar size={36} />
      <div className={styles.leaderboardInfo}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
      </div>
      <Skeleton width={60} height={20} variant="rounded" />
    </div>
  );
}
