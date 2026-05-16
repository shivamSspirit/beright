'use client';

import { useRestartTour } from '@/components/OnboardingTour';
import styles from './RestartTourButton.module.css';

interface RestartTourButtonProps {
  storageKey: string;
  ariaLabel?: string;
}

/**
 * Restart Tour Button - Floating "?" button that restarts the onboarding tour
 * Responsive across all screen sizes with proper touch targets
 */
export default function RestartTourButton({
  storageKey,
  ariaLabel = 'Restart tour'
}: RestartTourButtonProps) {
  const restartTour = useRestartTour(storageKey);

  return (
    <button
      onClick={restartTour}
      className={styles.restartBtn}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      ?
    </button>
  );
}
