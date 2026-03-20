'use client';

import { useMode } from '@/context/ModeContext';

/**
 * Mode Banner Component
 *
 * Displays a clickable banner to toggle between demo and production modes.
 * Shows current network info and allows switching.
 */
export function ModeBanner() {
  const { isDemo, networkLabel, tradingMode, isLoading, toggleMode } = useMode();

  // Don't show while loading
  if (isLoading) {
    return null;
  }

  return (
    <div className={`mode-banner ${isDemo ? 'demo' : 'production'}`}>
      <div className="mode-banner-content">
        <button className="mode-toggle-btn" onClick={toggleMode}>
          <span className="mode-badge">{isDemo ? 'TESTNET' : 'MAINNET'}</span>
          <span className="mode-info">
            {networkLabel} &bull; {tradingMode === 'paper' ? 'Paper Trading' : 'Live Trading'}
          </span>
          <span className="mode-switch">
            Click to switch to {isDemo ? 'Production' : 'Demo'}
          </span>
        </button>
      </div>

      <style jsx>{`
        .mode-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 6px 16px;
          z-index: 9999;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.3s ease;
        }

        .mode-banner.demo {
          background: linear-gradient(90deg, #F59E0B 0%, #D97706 100%);
          color: #000;
        }

        .mode-banner.production {
          background: linear-gradient(90deg, #22C55E 0%, #16A34A 100%);
          color: #000;
        }

        .mode-banner-content {
          display: flex;
          align-items: center;
          justify-content: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .mode-toggle-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
          font-family: inherit;
          font-size: inherit;
        }

        .mode-toggle-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .mode-badge {
          background: #000;
          padding: 3px 10px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
        }

        .mode-banner.demo .mode-badge {
          color: #F59E0B;
        }

        .mode-banner.production .mode-badge {
          color: #22C55E;
        }

        .mode-info {
          opacity: 0.8;
        }

        .mode-switch {
          opacity: 0.6;
          font-size: 12px;
          border-left: 1px solid rgba(0, 0, 0, 0.2);
          padding-left: 12px;
          margin-left: 4px;
        }

        @media (max-width: 640px) {
          .mode-switch {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Spacer component to push content below the banner
 * Use this in layouts when ModeBanner is present
 */
export function ModeBannerSpacer() {
  const { isDemo, isLoading } = useMode();

  if (!isDemo || isLoading) {
    return null;
  }

  return <div style={{ height: '40px' }} />;
}

/**
 * Compact mode indicator for header/nav
 */
export function ModeIndicator() {
  const { isDemo, networkLabel, isLoading } = useMode();

  if (isLoading) {
    return null;
  }

  return (
    <div className={`mode-indicator ${isDemo ? 'demo' : 'production'}`}>
      <span className="mode-dot" />
      <span className="mode-label">{isDemo ? 'Demo' : 'Live'}</span>
      <span className="mode-network">{networkLabel}</span>

      <style jsx>{`
        .mode-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .mode-indicator.demo {
          background: rgba(245, 158, 11, 0.15);
          color: #F59E0B;
        }

        .mode-indicator.production {
          background: rgba(34, 197, 94, 0.15);
          color: #22C55E;
        }

        .mode-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .mode-indicator.demo .mode-dot {
          background: #F59E0B;
        }

        .mode-indicator.production .mode-dot {
          background: #22C55E;
        }

        .mode-label {
          font-weight: 600;
        }

        .mode-network {
          opacity: 0.7;
          font-size: 11px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default ModeBanner;
