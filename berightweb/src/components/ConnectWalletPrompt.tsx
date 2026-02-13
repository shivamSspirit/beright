'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';

interface ConnectWalletPromptProps {
  title?: string;
  description?: string;
  onClose?: () => void;
}

export default function ConnectWalletPrompt({
  title = 'Connect Wallet',
  description = 'Link your wallet to make predictions and compete on the leaderboard',
  onClose,
}: ConnectWalletPromptProps) {
  const { login, isLoading } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render portal on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleConnect = async () => {
    if (isConnecting || isLoading) return;

    setIsConnecting(true);
    try {
      await login();
    } catch (error) {
      console.warn('[ConnectWallet] Login error:', error);
    } finally {
      setTimeout(() => setIsConnecting(false), 500);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const buttonDisabled = isLoading || isConnecting;

  const modalContent = (
    <>
      <motion.div
        className="cwp-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <motion.div
          className="cwp-modal"
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          {onClose && (
            <button className="cwp-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Wallet Icon */}
          <div className="cwp-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
              <circle cx="18" cy="12" r="1" fill="#00E676" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="cwp-title">{title}</h2>

          {/* Description */}
          <p className="cwp-description">{description}</p>

          {/* Features */}
          <div className="cwp-features">
            {[
              'Make predictions on real markets',
              'Track your accuracy & Brier score',
              'Compete on the leaderboard',
            ].map((feature, i) => (
              <div key={i} className="cwp-feature">
                <span className="cwp-check">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Connect Button */}
          <button
            className="cwp-button"
            onClick={handleConnect}
            disabled={buttonDisabled}
          >
            {buttonDisabled ? (
              <div className="cwp-spinner" />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
                </svg>
                Connect Wallet
              </>
            )}
          </button>

          {/* Security Note */}
          <p className="cwp-security">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <circle cx="12" cy="16" r="1" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Secure connection via Privy
          </p>
        </motion.div>
      </motion.div>

      <style>{`
        /* ═══ Overlay ═══ */
        .cwp-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9999;
          padding: 16px;
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        }

        /* ═══ Modal Card ═══ */
        .cwp-modal {
          position: relative;
          width: 100%;
          max-width: 380px;
          max-height: calc(100vh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
          overflow-y: auto;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 36px 28px;
          text-align: center;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        /* ═══ Close Button ═══ */
        .cwp-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 50%;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 10;
        }

        .cwp-close:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        /* ═══ Wallet Icon ═══ */
        .cwp-icon {
          width: 88px;
          height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 176, 255, 0.2) 100%);
          border-radius: 50%;
          margin: 0 auto 20px;
          box-shadow: 0 0 40px rgba(0, 230, 118, 0.15);
        }

        .cwp-icon svg {
          width: 42px;
          height: 42px;
        }

        /* ═══ Title ═══ */
        .cwp-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 10px;
          line-height: 1.2;
        }

        /* ═══ Description ═══ */
        .cwp-description {
          font-size: 14px;
          color: #888;
          margin: 0 0 24px;
          line-height: 1.5;
        }

        /* ═══ Features ═══ */
        .cwp-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
          text-align: left;
        }

        .cwp-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #ccc;
        }

        .cwp-check {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 230, 118, 0.15);
          border-radius: 50%;
          color: #00E676;
          font-size: 11px;
          flex-shrink: 0;
        }

        /* ═══ Connect Button ═══ */
        .cwp-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(0, 230, 118, 0.3);
        }

        .cwp-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 230, 118, 0.4);
        }

        .cwp-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .cwp-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* ═══ Spinner ═══ */
        .cwp-spinner {
          width: 22px;
          height: 22px;
          border: 3px solid transparent;
          border-top-color: #000;
          border-radius: 50%;
          animation: cwp-spin 0.8s linear infinite;
        }

        @keyframes cwp-spin {
          to { transform: rotate(360deg); }
        }

        /* ═══ Security Note ═══ */
        .cwp-security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 14px;
          font-size: 11px;
          color: #666;
        }

        /* ═══════════════════════════════════════════════════════════
           RESPONSIVE STYLES
           ═══════════════════════════════════════════════════════════ */

        /* Very small phones (< 360px) */
        @media (max-width: 359px) {
          .cwp-overlay {
            padding: 12px;
          }

          .cwp-modal {
            padding: 28px 20px;
            border-radius: 20px;
          }

          .cwp-close {
            width: 32px;
            height: 32px;
            top: 10px;
            right: 10px;
          }

          .cwp-close svg {
            width: 16px;
            height: 16px;
          }

          .cwp-icon {
            width: 72px;
            height: 72px;
            margin-bottom: 16px;
          }

          .cwp-icon svg {
            width: 34px;
            height: 34px;
          }

          .cwp-title {
            font-size: 19px;
            margin-bottom: 8px;
          }

          .cwp-description {
            font-size: 13px;
            margin-bottom: 20px;
          }

          .cwp-features {
            gap: 10px;
            margin-bottom: 24px;
          }

          .cwp-feature {
            font-size: 12px;
            gap: 8px;
          }

          .cwp-check {
            width: 18px;
            height: 18px;
            font-size: 10px;
          }

          .cwp-button {
            padding: 12px 16px;
            font-size: 14px;
            border-radius: 12px;
          }

          .cwp-button svg {
            width: 18px;
            height: 18px;
          }

          .cwp-security {
            font-size: 10px;
            margin-top: 12px;
          }
        }

        /* Small phones (360-400px) */
        @media (min-width: 360px) and (max-width: 399px) {
          .cwp-modal {
            padding: 32px 24px;
          }

          .cwp-icon {
            width: 80px;
            height: 80px;
          }

          .cwp-icon svg {
            width: 38px;
            height: 38px;
          }

          .cwp-title {
            font-size: 20px;
          }
        }

        /* Short screens (landscape or small height) */
        @media (max-height: 600px) {
          .cwp-modal {
            padding: 24px 20px;
          }

          .cwp-icon {
            width: 64px;
            height: 64px;
            margin-bottom: 14px;
          }

          .cwp-icon svg {
            width: 30px;
            height: 30px;
          }

          .cwp-title {
            font-size: 18px;
            margin-bottom: 6px;
          }

          .cwp-description {
            font-size: 13px;
            margin-bottom: 16px;
          }

          .cwp-features {
            gap: 8px;
            margin-bottom: 20px;
          }

          .cwp-feature {
            font-size: 12px;
          }

          .cwp-button {
            padding: 12px 16px;
            font-size: 14px;
          }

          .cwp-security {
            margin-top: 10px;
          }
        }

        /* Very short screens */
        @media (max-height: 500px) {
          .cwp-icon {
            width: 56px;
            height: 56px;
            margin-bottom: 12px;
          }

          .cwp-icon svg {
            width: 26px;
            height: 26px;
          }

          .cwp-features {
            display: none;
          }

          .cwp-description {
            margin-bottom: 20px;
          }
        }

        /* Tablets and larger */
        @media (min-width: 768px) {
          .cwp-modal {
            padding: 44px 36px;
            max-width: 400px;
          }

          .cwp-icon {
            width: 100px;
            height: 100px;
            margin-bottom: 24px;
          }

          .cwp-icon svg {
            width: 48px;
            height: 48px;
          }

          .cwp-title {
            font-size: 26px;
          }

          .cwp-description {
            font-size: 15px;
          }

          .cwp-feature {
            font-size: 14px;
          }

          .cwp-button {
            padding: 16px 24px;
            font-size: 16px;
          }
        }

        /* Touch device optimizations */
        @media (hover: none) and (pointer: coarse) {
          .cwp-close {
            width: 40px;
            height: 40px;
          }

          .cwp-button {
            min-height: 48px;
          }
        }
      `}</style>
    </>
  );

  // Use portal to render at document body level
  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
