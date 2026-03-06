'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { usePrivy } from '@privy-io/react-auth';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, walletAddress, logout, isLoading } = useUser();
  const { login } = usePrivy();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Format Solana wallet address for display (4rW3...xVQ)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-3)}`;
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          <Link href="/" className="nav-logo" aria-label="BeRight Home">
            <span className="logo-icon">◉</span>
            <span className="logo-text">BeRight</span>
          </Link>

          <div className="nav-links" role="menubar">
            <Link href="/docs" className="nav-link" role="menuitem">Docs</Link>
            <Link href="/docs/faq" className="nav-link" role="menuitem">FAQ</Link>
          </div>

          <div className="nav-actions">
            <a href="https://t.me/berightaii" target="_blank" rel="noopener noreferrer" className="nav-cta telegram-btn" aria-label="Join Telegram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>Telegram</span>
            </a>

            {!isAuthenticated ? (
              <button
                className="nav-cta wallet-btn"
                onClick={login}
                disabled={isLoading}
                aria-label="Connect Wallet"
              >
                {isLoading ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
                      <circle cx="18" cy="12" r="1" fill="currentColor" />
                    </svg>
                    <span>Connect</span>
                  </>
                )}
              </button>
            ) : (
              <div className="wallet-connected">
                <div className="wallet-info">
                  <span className="wallet-dot" />
                  <span className="wallet-address">{formatAddress(walletAddress || '')}</span>
                </div>
                <button
                  className="disconnect-btn"
                  onClick={logout}
                  aria-label="Disconnect Wallet"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16,17 21,12 16,7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 0 24px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .navbar.scrolled {
          background: rgba(8, 12, 20, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(30, 58, 95, 0.2);
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
        }

        .nav-logo {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: #F1F5F9;
          line-height: 1;
        }

        .logo-icon {
          color: #00C2FF;
          font-size: 26px;
          line-height: 1;
          display: inline-block;
          vertical-align: middle;
        }

        .logo-text {
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #F1F5F9;
          line-height: 1;
          display: inline-block;
          vertical-align: middle;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 36px;
        }

        .nav-link {
          color: #94A3B8;
          text-decoration: none;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 15px;
          font-weight: 500;
          transition: color 0.2s ease;
          line-height: 1;
        }

        .nav-link:hover {
          color: #F1F5F9;
        }

        .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: rgba(0, 194, 255, 0.1);
          border: 1px solid rgba(0, 194, 255, 0.2);
          border-radius: 10px;
          color: #F1F5F9;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.25s ease;
          line-height: 1;
        }

        .nav-cta:hover {
          background: rgba(0, 194, 255, 0.15);
          border-color: rgba(0, 194, 255, 0.35);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 194, 255, 0.15);
        }

        .nav-cta svg {
          flex-shrink: 0;
          display: block;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .wallet-btn {
          background: linear-gradient(135deg, rgba(0, 194, 255, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
          border: 1px solid rgba(0, 194, 255, 0.3);
          cursor: pointer;
        }

        .wallet-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 194, 255, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%);
          border-color: rgba(0, 194, 255, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 194, 255, 0.2);
        }

        .wallet-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #00C2FF;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .wallet-connected {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px 6px 14px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 10px;
        }

        .wallet-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wallet-dot {
          width: 8px;
          height: 8px;
          background: #10B981;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .wallet-address {
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          color: #F1F5F9;
        }

        .disconnect-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 8px;
          color: #F43F5E;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .disconnect-btn:hover {
          background: rgba(244, 63, 94, 0.2);
          border-color: rgba(244, 63, 94, 0.4);
        }

        @media (max-width: 768px) {
          .navbar {
            padding: 0 16px;
          }

          .nav-inner {
            height: 64px;
          }

          .nav-links {
            display: none;
          }

          .logo-icon {
            font-size: 22px;
          }

          .logo-text {
            font-size: 18px;
          }

          .nav-actions {
            gap: 8px;
          }

          .telegram-btn {
            display: none;
          }

          .nav-cta span {
            display: none;
          }

          .nav-cta {
            padding: 10px;
          }

          .wallet-btn span {
            display: inline;
          }

          .wallet-connected {
            padding: 6px 8px 6px 10px;
          }

          .wallet-address {
            font-size: 12px;
          }

          .disconnect-btn {
            width: 28px;
            height: 28px;
          }

          .disconnect-btn svg {
            width: 14px;
            height: 14px;
          }
        }

        @media (max-width: 400px) {
          .wallet-address {
            display: none;
          }

          .wallet-dot {
            width: 10px;
            height: 10px;
          }

          .wallet-connected {
            padding: 8px 8px 8px 12px;
          }
        }
      `}</style>
    </>
  );
}
