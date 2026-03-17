'use client';

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

/**
 * Reusable error boundary component for Next.js App Router
 * Use this in error.tsx files for consistent error handling
 */
export default function ErrorBoundary({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
}: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="error-container">
      <div className="error-content">
        <div className="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="error-title">{title}</h1>
        <p className="error-description">{description}</p>

        {error.message && process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Error Details</summary>
            <pre>{error.message}</pre>
            {error.stack && <pre className="error-stack">{error.stack}</pre>}
          </details>
        )}

        <div className="error-actions">
          <button onClick={reset} className="retry-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Try Again
          </button>

          <a href="/" className="home-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go Home
          </a>
        </div>
      </div>

      <style jsx>{`
        .error-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #080C14 0%, #0D1117 100%);
          padding: 24px;
        }

        .error-content {
          max-width: 420px;
          text-align: center;
        }

        .error-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 50%;
          color: #EF4444;
          margin-bottom: 24px;
        }

        .error-title {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: -0.02em;
        }

        .error-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          line-height: 1.6;
        }

        .error-details {
          text-align: left;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 24px;
        }

        .error-details summary {
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
        }

        .error-details pre {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .error-stack {
          margin-top: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .retry-btn,
        .home-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .retry-btn {
          background: #10B981;
          border: none;
          color: #000;
        }
        .retry-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        .home-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }
        .home-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 480px) {
          .error-content { padding: 0 16px; }
          .error-title { font-size: 20px; }
          .error-description { font-size: 14px; }
          .error-actions { flex-direction: column; }
          .retry-btn, .home-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
