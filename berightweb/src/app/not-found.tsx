'use client';

import Link from 'next/link';

/**
 * 404 Not Found page
 */
export default function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-description">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="not-found-actions">
          <Link href="/" className="home-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>

          <Link href="/markets" className="markets-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            Browse Markets
          </Link>
        </div>
      </div>

      <style jsx>{`
        .not-found-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #080C14 0%, #0D1117 100%);
          padding: 24px;
        }

        .not-found-content {
          max-width: 420px;
          text-align: center;
        }

        .not-found-code {
          font-size: 120px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.05);
          line-height: 1;
          margin-bottom: -20px;
          letter-spacing: -0.05em;
        }

        .not-found-title {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: -0.02em;
        }

        .not-found-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 32px;
          line-height: 1.6;
        }

        .not-found-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .home-btn,
        .markets-btn {
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

        .home-btn {
          background: #10B981;
          color: #000;
        }
        .home-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        .markets-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }
        .markets-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 480px) {
          .not-found-code { font-size: 80px; }
          .not-found-title { font-size: 22px; }
          .not-found-actions { flex-direction: column; }
          .home-btn, .markets-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
