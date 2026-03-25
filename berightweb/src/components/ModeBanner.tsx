'use client';

import { useMode } from '@/context/ModeContext';
import { useProductionAccess } from '@/hooks/useProductionAccess';

/**
 * Mode Toggle Component
 *
 * Shows mode indicator in header:
 * - Owner (shivamssoni6@gmail.com): Toggle button to switch demo/production
 * - Everyone else: Static "Demo" badge (no toggle capability)
 */
export function ModeToggle() {
  const { isLoading, toggleMode } = useMode();
  const { canToggle, isEffectiveDemo } = useProductionAccess();

  if (isLoading) {
    return null;
  }

  const isDemo = isEffectiveDemo;

  // Non-owners: show static Demo badge (no toggle capability)
  if (!canToggle) {
    return (
      <div className="demo-badge" title="Demo Mode - Paper Trading">
        <span className="demo-dot" />
        <span className="demo-label">Demo</span>

        <style jsx>{`
          /* Matches Header.tsx nav-btn sizing system */
          .demo-badge {
            --btn-height: 36px;
            --btn-padding: 0 14px;
            --btn-font: 12px;
            --btn-radius: 8px;
            --btn-gap: 6px;

            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: var(--btn-gap);
            height: var(--btn-height);
            padding: var(--btn-padding);
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.25);
            border-radius: var(--btn-radius);
            color: #F59E0B;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: var(--btn-font);
            font-weight: 600;
            letter-spacing: 0.3px;
          }

          .demo-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #F59E0B;
            animation: pulse 2s infinite;
          }

          .demo-label {
            text-transform: uppercase;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          @media (max-width: 768px) {
            .demo-badge {
              --btn-height: 32px;
              --btn-padding: 0 12px;
              --btn-font: 11px;
            }

            .demo-dot {
              width: 5px;
              height: 5px;
            }
          }
        `}</style>
      </div>
    );
  }

  // Owner: show toggle button
  return (
    <button
      className={`mode-toggle ${isDemo ? 'demo' : 'production'}`}
      onClick={toggleMode}
      title={`Switch to ${isDemo ? 'Production' : 'Demo'} mode`}
    >
      <span className="mode-dot" />
      <span className="mode-label">{isDemo ? 'Demo' : 'Live'}</span>
      <svg className="mode-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6,9 12,15 18,9" />
      </svg>

      <style jsx>{`
        /* Matches Header.tsx nav-btn sizing system */
        .mode-toggle {
          --btn-height: 36px;
          --btn-padding: 0 14px;
          --btn-font: 12px;
          --btn-radius: 8px;
          --btn-gap: 6px;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--btn-gap);
          height: var(--btn-height);
          padding: var(--btn-padding);
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: var(--btn-radius);
          color: #94A3B8;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: var(--btn-font);
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

        @media (max-width: 768px) {
          .mode-toggle {
            --btn-height: 32px;
            --btn-padding: 0 12px;
            --btn-font: 11px;
          }

          .mode-chevron {
            display: none;
          }

          .mode-dot {
            width: 5px;
            height: 5px;
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
 * Shows effective mode (respects access control - non-owners always see Demo)
 */
export function ModeIndicator() {
  const { networkLabel, isLoading } = useMode();
  const { isEffectiveDemo } = useProductionAccess();

  if (isLoading) {
    return null;
  }

  // Non-owners always see demo mode
  const isDemo = isEffectiveDemo;
  const effectiveNetworkLabel = isDemo ? 'Devnet' : networkLabel;

  return (
    <div className={`mode-indicator ${isDemo ? 'demo' : 'production'}`}>
      <span className="mode-dot" />
      <span className="mode-label">{isDemo ? 'Demo' : 'Live'}</span>
      <span className="mode-network">{effectiveNetworkLabel}</span>

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
