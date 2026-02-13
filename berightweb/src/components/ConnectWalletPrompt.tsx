'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';

interface ConnectWalletPromptProps {
  title?: string;
  description?: string;
  variant?: 'overlay' | 'card' | 'inline';
  onClose?: () => void;
}

export default function ConnectWalletPrompt({
  title = 'Connect Wallet',
  description = 'Link your wallet to make predictions and compete on the leaderboard',
  variant = 'overlay',
  onClose,
}: ConnectWalletPromptProps) {
  const { login, isLoading } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting || isLoading) return;

    setIsConnecting(true);
    try {
      await login();
    } catch (error) {
      // Silently handle login errors - Privy shows its own error UI
      console.warn('[ConnectWallet] Login error:', error);
    } finally {
      // Small delay before resetting to prevent rapid clicks
      setTimeout(() => setIsConnecting(false), 500);
    }
  };

  const buttonDisabled = isLoading || isConnecting;

  if (variant === 'inline') {
    return (
      <div className="connect-prompt-inline">
        <div className="prompt-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
          </svg>
        </div>
        <p className="prompt-text">{description}</p>
        <button
          className="connect-btn-small"
          onClick={handleConnect}
          disabled={buttonDisabled}
        >
          {buttonDisabled ? 'Connecting...' : 'Connect'}
        </button>

        <style jsx>{`
          .connect-prompt-inline {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: rgba(0, 230, 118, 0.1);
            border: 1px solid rgba(0, 230, 118, 0.3);
            border-radius: 12px;
          }

          .prompt-icon {
            color: #00E676;
            flex-shrink: 0;
          }

          .prompt-text {
            flex: 1;
            font-size: 13px;
            color: #888;
            margin: 0;
          }

          .connect-btn-small {
            padding: 8px 16px;
            background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #000;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .connect-btn-small:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);
          }

          .connect-btn-small:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="connect-prompt-card">
        <div className="card-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
            <circle cx="18" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
        <h3 className="card-title">{title}</h3>
        <p className="card-desc">{description}</p>
        <button
          className="connect-btn"
          onClick={handleConnect}
          disabled={buttonDisabled}
        >
          {buttonDisabled ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>

        <style jsx>{`
          .connect-prompt-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 24px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            text-align: center;
          }

          .card-icon {
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 230, 118, 0.1);
            border-radius: 50%;
            color: #00E676;
            margin-bottom: 16px;
          }

          .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 8px;
          }

          .card-desc {
            font-size: 14px;
            color: #888;
            margin: 0 0 24px;
            max-width: 280px;
          }

          .connect-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 28px;
            background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
            border: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            color: #000;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .connect-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 230, 118, 0.3);
          }

          .connect-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid transparent;
            border-top-color: #000;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Default: overlay variant
  return (
    <motion.div
      className="connect-prompt-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="prompt-content"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="prompt-icon-large">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
            <circle cx="18" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>

        <h2 className="prompt-title">{title}</h2>
        <p className="prompt-description">{description}</p>

        <div className="features-list">
          <div className="feature">
            <span className="feature-icon">&#10003;</span>
            <span>Make predictions on real markets</span>
          </div>
          <div className="feature">
            <span className="feature-icon">&#10003;</span>
            <span>Track your accuracy & Brier score</span>
          </div>
          <div className="feature">
            <span className="feature-icon">&#10003;</span>
            <span>Compete on the leaderboard</span>
          </div>
        </div>

        <button
          className="connect-btn-large"
          onClick={handleConnect}
          disabled={buttonDisabled}
        >
          {buttonDisabled ? (
            <span className="loading-spinner-large" />
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>

        <p className="security-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <circle cx="12" cy="16" r="1" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Secure connection via Privy
        </p>
      </motion.div>

      <style jsx>{`
        .connect-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 1000;
          padding: 20px;
        }

        .prompt-content {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px 32px;
          text-align: center;
        }

        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .prompt-icon-large {
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 176, 255, 0.2) 100%);
          border-radius: 50%;
          color: #00E676;
          margin: 0 auto 24px;
        }

        .prompt-title {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
        }

        .prompt-description {
          font-size: 15px;
          color: #888;
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .features-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
          text-align: left;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #ccc;
        }

        .feature-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 230, 118, 0.2);
          border-radius: 50%;
          color: #00E676;
          font-size: 12px;
        }

        .connect-btn-large {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 24px;
          background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .connect-btn-large:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 230, 118, 0.4);
        }

        .connect-btn-large:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner-large {
          width: 24px;
          height: 24px;
          border: 3px solid transparent;
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 16px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </motion.div>
  );
}
