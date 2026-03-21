'use client';

import { useMode } from '@/context/ModeContext';

/**
 * Mode Toggle Component
 *
 * Compact toggle button for switching between demo and production modes.
 * Designed to integrate cleanly into the header navigation.
 */
export function ModeToggle() {
  const { isDemo, isLoading, toggleMode } = useMode();

  if (isLoading) {
    return null;
  }

  return (
    <button
      className={`mode-toggle ${isDemo ? 'demo' : 'production'}`}
      onClick={toggleMode}
      title={`Switch to ${isDemo ? 'Production' : 'Demo'} mode`}
    >
      <span className="mode-dot" />
      <span className="mode-label">{isDemo ? 'Demo' : 'Live'}</span>
      <svg className="mode-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6,9 12,15 18,9" />
      </svg>

      <style jsx>{`
        .mode-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          color: #94A3B8;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-toggle:hover {
          border-color: rgba(148, 163, 184, 0.4);
          background: rgba(148, 163, 184, 0.05);
        }

        .mode-toggle.demo {
          border-color: rgba(245, 158, 11, 0.3);
          color: #F59E0B;
        }

        .mode-toggle.demo:hover {
          border-color: rgba(245, 158, 11, 0.5);
          background: rgba(245, 158, 11, 0.08);
        }

        .mode-toggle.production {
          border-color: rgba(34, 197, 94, 0.3);
          color: #22C55E;
        }

        .mode-toggle.production:hover {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.08);
        }

        .mode-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        .mode-label {
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .mode-chevron {
          opacity: 0.6;
          transition: transform 0.2s ease;
        }

        .mode-toggle:hover .mode-chevron {
          transform: translateY(1px);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @media (max-width: 640px) {
          .mode-toggle {
            padding: 6px 10px;
          }

          .mode-chevron {
            display: none;
          }
        }
      `}</style>
    </button>
  );
}

/**
 * @deprecated Use ModeToggle instead - integrates into header
 */
export function ModeBanner() {
  // Deprecated: Return null - use ModeToggle in Header instead
  return null;
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
