'use client';

import { useRouter } from 'next/navigation';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title?: string;
  showBack?: boolean;
  showSettings?: boolean;
  showShare?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
}

// Icon components
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

export default function PageHeader({
  title,
  showBack = false,
  showSettings = false,
  showShare = false,
  leftSlot,
  rightSlot,
  onSettingsClick,
  onShareClick,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleShare = async () => {
    if (onShareClick) {
      onShareClick();
      return;
    }

    // Default share behavior
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'BeRight',
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderInner}>
        {/* Left section */}
        <div className={styles.leftSection}>
          {showBack && (
            <button
              className={styles.backButton}
              onClick={handleBack}
              aria-label="Go back"
            >
              <BackIcon />
            </button>
          )}
          {leftSlot}
        </div>

        {/* Center section */}
        <div className={styles.centerSection}>
          {title && <h1 className={styles.title}>{title}</h1>}
        </div>

        {/* Right section */}
        <div className={styles.rightSection}>
          {rightSlot}
          {showShare && (
            <button
              className={styles.shareButton}
              onClick={handleShare}
              aria-label="Share"
            >
              <ShareIcon />
            </button>
          )}
          {showSettings && (
            <button
              className={styles.settingsButton}
              onClick={onSettingsClick}
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// Pre-built slot components for common use cases

export function BalancePill({ amount }: { amount: string }) {
  return (
    <div className={styles.balancePill}>
      <svg className={styles.balanceIcon} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
      </svg>
      <span className={styles.balanceAmount}>{amount}</span>
    </div>
  );
}

export function StatusIndicator({ label = 'LIVE' }: { label?: string }) {
  return (
    <div className={styles.statusIndicator}>
      <div className={styles.statusDot} />
      <span>{label}</span>
    </div>
  );
}

export function DemoIndicator() {
  return (
    <div className={styles.demoIndicator}>
      DEMO
    </div>
  );
}

export function OptionsButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className={styles.optionsButton}
      onClick={onClick}
      aria-label="More options"
    >
      <MoreIcon />
    </button>
  );
}
