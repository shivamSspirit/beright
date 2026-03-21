'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="success-icon">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" fill="rgba(16, 185, 129, 0.15)" stroke="#10B981" strokeWidth="3" />
          <path d="M25 40L35 50L55 30" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="success-title">Welcome to BeRight!</h1>
      <p className="success-subtitle">
        Your subscription is now active. You have full access to all premium features.
      </p>

      <div className="success-details">
        <div className="detail-item">
          <span className="detail-icon">🚀</span>
          <span className="detail-text">All AI agents unlocked</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">📡</span>
          <span className="detail-text">Real-time signal intelligence</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">⚡</span>
          <span className="detail-text">Priority arbitrage alerts</span>
        </div>
      </div>

      <Link href="/" className="success-cta">
        Go to Dashboard
        <span className="countdown">({countdown}s)</span>
      </Link>

      {sessionId && (
        <p className="session-id">
          Session: {sessionId.slice(0, 20)}...
        </p>
      )}
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="success-page">
      <div className="success-card">
        <Suspense fallback={<LoadingFallback />}>
          <SuccessContent />
        </Suspense>
      </div>

      <style jsx>{`
        .success-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #080C14 0%, #0D1117 100%);
          padding: 24px;
        }

        .success-card {
          max-width: 480px;
          width: 100%;
          padding: 48px 32px;
          background: rgba(14, 14, 18, 0.95);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 24px;
          text-align: center;
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px;
          color: rgba(255, 255, 255, 0.6);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(16, 185, 129, 0.2);
          border-top-color: #10B981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <style jsx global>{`
        .success-icon {
          margin-bottom: 24px;
          animation: checkPop 0.5s ease-out 0.2s backwards;
        }

        @keyframes checkPop {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .success-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }

        .success-subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
          margin-bottom: 32px;
        }

        .success-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          background: rgba(16, 185, 129, 0.05);
          border: 1px solid rgba(16, 185, 129, 0.1);
          border-radius: 12px;
          margin-bottom: 32px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .detail-icon {
          font-size: 18px;
        }

        .detail-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }

        .success-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .success-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -8px rgba(16, 185, 129, 0.5);
        }

        .countdown {
          font-size: 14px;
          font-weight: 500;
          opacity: 0.7;
        }

        .session-id {
          margin-top: 24px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
