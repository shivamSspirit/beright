'use client';

import styles from '../beright.module.css';

type PulseState = 'active' | 'idle' | 'alert';

interface PulseIndicatorProps {
  state: PulseState;
}

/**
 * PulseIndicator - Animated status dot
 *
 * - active: Green pulsing glow
 * - idle: Gray static
 * - alert: Red glow
 */
export default function PulseIndicator({ state }: PulseIndicatorProps) {
  const stateClass = {
    active: styles.pulseActive,
    idle: styles.pulseIdle,
    alert: styles.pulseAlert,
  }[state];

  return <div className={`${styles.pulseIndicator} ${stateClass}`} />;
}
