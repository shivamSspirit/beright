'use client';

import Link from 'next/link';

export default function SubscriptionCancelPage() {
  return (
    <div className="cancel-page">
      <div className="cancel-card">
        <div className="cancel-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="36" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="3" />
            <path d="M30 30L50 50M50 30L30 50" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="cancel-title">Checkout Cancelled</h1>
        <p className="cancel-subtitle">
          No worries! Your payment was not processed. You can try again anytime.
        </p>

        <div className="cancel-actions">
          <Link href="/subscription" className="action-primary">
            Try Again
          </Link>
          <Link href="/" className="action-secondary">
            Back to Dashboard
          </Link>
        </div>

        <div className="help-section">
          <p className="help-text">Need help choosing a plan?</p>
          <a href="mailto:support@beright.io" className="help-link">
            Contact Support
          </a>
        </div>
      </div>

      <style jsx>{`
        .cancel-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #080C14 0%, #0D1117 100%);
          padding: 24px;
        }

        .cancel-card {
          max-width: 480px;
          width: 100%;
          padding: 48px 32px;
          background: rgba(14, 14, 18, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          text-align: center;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .cancel-icon {
          margin-bottom: 24px;
        }

        .cancel-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }

        .cancel-subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
          margin-bottom: 32px;
        }

        .cancel-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 32px;
        }

        .action-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          transition: all 0.2s;
        }

        .action-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -8px rgba(16, 185, 129, 0.5);
        }

        .action-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 16px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: all 0.2s;
        }

        .action-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .help-section {
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .help-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 8px;
        }

        .help-link {
          font-size: 14px;
          font-weight: 600;
          color: #10B981;
          text-decoration: none;
          transition: color 0.2s;
        }

        .help-link:hover {
          color: #34D399;
        }
      `}</style>
    </div>
  );
}
