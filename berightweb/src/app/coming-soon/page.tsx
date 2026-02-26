'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════════════════════
// COMING SOON PAGE - Premium Locked State
// ═══════════════════════════════════════════════════════════════════════════════

const FEATURE_NAMES: Record<string, { title: string; description: string; icon: string }> = {
  // Main pages
  '/profile': {
    title: 'Forecaster Profile',
    description: 'Track your predictions, view your Brier score, and climb the leaderboard.',
    icon: '👤',
  },
  '/markets': {
    title: 'Live Markets',
    description: 'Browse and trade on prediction markets across multiple platforms.',
    icon: '📊',
  },
  '/leaderboard': {
    title: 'Global Leaderboard',
    description: 'See the top forecasters ranked by accuracy and consistency.',
    icon: '🏆',
  },
  '/beright-terminal': {
    title: 'BeRight Terminal',
    description: 'Pro-grade terminal for power users with real-time signals and alerts.',
    icon: '⚡',
  },
  '/vault': {
    title: 'Prediction Vaults',
    description: 'Automated strategies powered by collective intelligence.',
    icon: '🏦',
  },
  '/vaults': {
    title: 'Vault Explorer',
    description: 'Discover and invest in prediction market vaults.',
    icon: '🔍',
  },
  '/kalshi': {
    title: 'Kalshi Integration',
    description: 'Trade regulated prediction markets with Kalshi integration.',
    icon: '📈',
  },
  // Doc subpages
  '/docs/api': {
    title: 'API Reference',
    description: 'Complete API documentation for developers integrating with BeRight.',
    icon: '🔌',
  },
  '/docs/fees': {
    title: 'Fee Structure',
    description: 'Transparent breakdown of fees across all supported platforms.',
    icon: '💰',
  },
  '/docs/resolution': {
    title: 'Market Resolution',
    description: 'How prediction markets resolve and settle positions.',
    icon: '⚖️',
  },
  // Other pages
  '/landing': {
    title: 'Landing Page',
    description: 'The BeRight homepage and product introduction.',
    icon: '🏠',
  },
  '/embed': {
    title: 'Embed Widget',
    description: 'Embed prediction market data on your website.',
    icon: '📦',
  },
};

// Helper to generate title from path for unknown routes
function getTitleFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'This Page';

  const lastSegment = segments[segments.length - 1];
  // Convert kebab-case to Title Case
  return lastSegment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const originalPath = searchParams.get('from') || '/';

  // Get feature info or generate from path
  const feature = FEATURE_NAMES[originalPath] || {
    title: getTitleFromPath(originalPath),
    description: 'This feature is currently being built. Join our Telegram to get notified when it launches.',
    icon: '🚀',
  };

  return (
    <>
      {/* Background Effects */}
      <div className="cs-bg">
        <div className="cs-grid" />
        <div className="cs-glow" />
        <div className="cs-noise" />
      </div>

      {/* Header */}
      <header className="cs-header">
        <Link href="/" className="cs-logo">
          <span className="logo-icon">◉</span>
          <span className="logo-text">BeRight</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="cs-main">
        <div className="cs-card">
          {/* Feature Icon */}
          <div className="cs-icon-wrapper">
            <span className="cs-icon">{feature.icon}</span>
            <div className="cs-icon-glow" />
          </div>

          {/* Badge */}
          <div className="cs-badge">
            <span className="badge-dot" />
            <span className="badge-text">Coming Soon</span>
          </div>

          {/* Title */}
          <h1 className="cs-title">{feature.title}</h1>

          {/* Description */}
          <p className="cs-description">{feature.description}</p>

          {/* Progress Indicator */}
          <div className="cs-progress">
            <div className="progress-bar">
              <div className="progress-fill" />
            </div>
            <span className="progress-text">Building something amazing...</span>
          </div>

          {/* CTA Buttons */}
          <div className="cs-cta">
            <a
              href="https://t.me/mygroupname"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-btn primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Get Early Access
            </a>
            <Link href="/" className="cta-btn secondary">
              ← Back to Home
            </Link>
          </div>

          {/* Notify Option */}
          <p className="cs-notify">
            Join our Telegram for launch updates
          </p>
        </div>

        {/* Feature Preview Grid */}
        <div className="cs-features">
          <h3 className="features-title">What's Coming</h3>
          <div className="features-grid">
            {Object.entries(FEATURE_NAMES).slice(0, 4).map(([path, info]) => (
              <div key={path} className={`feature-item ${path === originalPath ? 'active' : ''}`}>
                <span className="feature-icon">{info.icon}</span>
                <span className="feature-name">{info.title}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="cs-footer">
        <p>© 2026 BeRight Protocol</p>
      </footer>

      <style jsx>{`
        .coming-soon-page {
          min-height: 100dvh;
          background: #0A0A0B;
          color: #fff;
          font-family: 'Satoshi', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* Background Effects */
        .cs-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }

        .cs-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .cs-glow {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(0, 255, 136, 0.08) 0%, transparent 70%);
          filter: blur(60px);
        }

        .cs-noise {
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.03;
        }

        /* Header */
        .cs-header {
          padding: 24px 32px;
          position: relative;
          z-index: 10;
        }

        .cs-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #fff;
        }

        .logo-icon {
          font-size: 28px;
          color: #00FF88;
        }

        .logo-text {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        /* Main Content */
        .cs-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 10;
          gap: 48px;
        }

        /* Card */
        .cs-card {
          max-width: 480px;
          width: 100%;
          background: linear-gradient(165deg, rgba(17, 17, 19, 0.9) 0%, rgba(10, 10, 11, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 48px 40px;
          text-align: center;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Icon */
        .cs-icon-wrapper {
          position: relative;
          display: inline-flex;
          margin-bottom: 24px;
        }

        .cs-icon {
          font-size: 64px;
          position: relative;
          z-index: 1;
        }

        .cs-icon-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(0, 255, 136, 0.2) 0%, transparent 70%);
          filter: blur(20px);
        }

        /* Badge */
        .cs-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 100px;
          margin-bottom: 20px;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          background: #00FF88;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .badge-text {
          font-size: 13px;
          font-weight: 600;
          color: #00FF88;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* Title */
        .cs-title {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        /* Description */
        .cs-description {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          margin: 0 0 32px;
        }

        /* Progress */
        .cs-progress {
          margin-bottom: 32px;
        }

        .progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill {
          height: 100%;
          width: 65%;
          background: linear-gradient(90deg, #00FF88, #00D4FF);
          border-radius: 2px;
          animation: progressShimmer 2s ease-in-out infinite;
        }

        @keyframes progressShimmer {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        .progress-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* CTA Buttons */
        .cs-cta {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }

        .cta-btn.primary {
          background: linear-gradient(135deg, #00FF88, #00D4FF);
          color: #000;
        }

        .cta-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        .cta-btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .cta-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        /* Notify */
        .cs-notify {
          margin-top: 20px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Features Preview */
        .cs-features {
          max-width: 480px;
          width: 100%;
        }

        .features-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 16px;
          text-align: center;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .feature-item.active {
          background: rgba(0, 255, 136, 0.08);
          border-color: rgba(0, 255, 136, 0.2);
        }

        .feature-icon {
          font-size: 24px;
        }

        .feature-name {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
        }

        .feature-item.active .feature-name {
          color: #00FF88;
        }

        /* Footer */
        .cs-footer {
          padding: 24px;
          text-align: center;
          position: relative;
          z-index: 10;
        }

        .cs-footer p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.3);
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 520px) {
          .cs-card {
            padding: 32px 24px;
          }

          .cs-title {
            font-size: 26px;
          }

          .cs-icon {
            font-size: 48px;
          }

          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0A0B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(0, 255, 136, 0.2)',
        borderTopColor: '#00FF88',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Main export with Suspense wrapper
export default function ComingSoonPage() {
  return (
    <div className="coming-soon-page">
      <Suspense fallback={<LoadingFallback />}>
        <ComingSoonContent />
      </Suspense>
    </div>
  );
}
