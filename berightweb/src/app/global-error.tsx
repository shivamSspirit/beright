'use client';

import Link from 'next/link';

/**
 * Global error boundary for root layout errors
 * This catches errors that occur in the root layout itself
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #080C14 0%, #0D1117 100%)',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '50%',
              marginBottom: '24px',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            </div>

            <h1 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 12px',
              letterSpacing: '-0.02em',
            }}>
              Critical Error
            </h1>

            <p style={{
              fontSize: '15px',
              color: 'rgba(255, 255, 255, 0.6)',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}>
              A critical error occurred while loading the application. Please refresh the page or try again later.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: '#10B981',
                  border: 'none',
                  color: '#000',
                }}
              >
                Try Again
              </button>

              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textDecoration: 'none',
                }}
              >
                Reload Page
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
