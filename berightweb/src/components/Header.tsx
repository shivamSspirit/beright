'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useMode } from '@/context/ModeContext';
import { useSubscription } from '@/hooks/useSubscription';
import BrandLogo from './BrandLogo';
import { ModeToggle } from './ModeBanner';

// Props for Header to receive auth state from parent
interface HeaderProps {
  isAuthenticated?: boolean;
  walletAddress?: string | null;
  login?: () => Promise<void>;
  logout?: () => Promise<void>;
  isLoading?: boolean;
}

export default function Header({
  isAuthenticated: propIsAuthenticated,
  walletAddress: propWalletAddress,
  login: propLogin,
  logout: propLogout,
  isLoading: propIsLoading,
}: HeaderProps = {}) {
  const [scrolled, setScrolled] = useState(false);
  const { isDemo } = useMode();
  const { tierConfig } = useSubscription();

  // Use window state as fallback for auth info
  const [authState, setAuthState] = useState({
    isAuthenticated: propIsAuthenticated ?? false,
    walletAddress: propWalletAddress ?? null,
    isLoading: propIsLoading ?? true,
  });

  // Subscribe to wallet state from window (set by providers)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAuthState = () => {
      const walletState = (window as Window & { __BERIGHT_WALLET__?: {
        connected: boolean;
        connecting: boolean;
        publicKey: string | null;
      } }).__BERIGHT_WALLET__;

      if (walletState) {
        setAuthState({
          isAuthenticated: walletState.connected,
          walletAddress: walletState.publicKey,
          isLoading: walletState.connecting,
        });
      }
    };

    checkAuthState();
    const interval = setInterval(checkAuthState, 500);
    return () => clearInterval(interval);
  }, []);

  // Use props if provided, otherwise use window state
  const isAuthenticated = propIsAuthenticated ?? authState.isAuthenticated;
  const walletAddress = propWalletAddress ?? authState.walletAddress;
  const isLoading = propIsLoading ?? authState.isLoading;

  // Login/logout handlers that use window functions
  const handleLogin = async () => {
    if (propLogin) {
      await propLogin();
      return;
    }

    // Use window-exposed login function
    const funcs = (window as Window & { __BERIGHT_WALLET_FUNCS__?: {
      login?: () => Promise<void>;
    } }).__BERIGHT_WALLET_FUNCS__;

    if (funcs?.login) {
      await funcs.login();
    } else if (isDemo) {
      // For Jupiter, trigger wallet modal via useUnifiedWalletContext
      // This is exposed to window by DemoUserContext
      const userFuncs = (window as Window & { __BERIGHT_USER_FUNCS__?: {
        login?: () => Promise<void>;
      } }).__BERIGHT_USER_FUNCS__;
      if (userFuncs?.login) {
        await userFuncs.login();
      }
    }
  };

  const handleLogout = async () => {
    if (propLogout) {
      await propLogout();
      return;
    }

    const funcs = (window as Window & { __BERIGHT_WALLET_FUNCS__?: {
      disconnect?: () => Promise<void>;
      logout?: () => Promise<void>;
    } }).__BERIGHT_WALLET_FUNCS__;

    if (funcs?.disconnect) {
      await funcs.disconnect();
    } else if (funcs?.logout) {
      await funcs.logout();
    }
  };

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
          <Link href="/" className="nav-logo" aria-label="BeRight Home" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <BrandLogo size={28} />
            <span className="logo-text" style={{ lineHeight: '28px' }}>BeRight</span>
          </Link>

          <div className="nav-links" role="menubar">
            <Link href="/docs" className="nav-link" role="menuitem">Docs</Link>
            <Link href="/docs/faq" className="nav-link" role="menuitem">FAQ</Link>
          </div>

          <div className="nav-actions">
            <ModeToggle />

            {!isAuthenticated ? (
              <button
                className="nav-btn wallet-btn"
                onClick={handleLogin}
                disabled={isLoading}
                aria-label="Connect Wallet"
              >
                {isLoading ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <Link href="/subscription" className="tier-badge" style={{ '--tier-color': tierConfig.color } as React.CSSProperties}>
                  {tierConfig.badge}
                </Link>
                <div className="wallet-info">
                  <span className="wallet-dot" />
                  <span className="wallet-address">{formatAddress(walletAddress || '')}</span>
                </div>
                <button
                  className="disconnect-btn"
                  onClick={handleLogout}
                  aria-label="Disconnect Wallet"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        /* ============================================
           CSS CUSTOM PROPERTIES - Sizing System
           ============================================ */
        .navbar {
          --nav-btn-height: 36px;
          --nav-btn-height-mobile: 32px;
          --nav-btn-padding: 0 14px;
          --nav-btn-padding-mobile: 0 12px;
          --nav-btn-font: 12px;
          --nav-btn-font-mobile: 11px;
          --nav-btn-icon: 16px;
          --nav-btn-icon-mobile: 14px;
          --nav-btn-radius: 8px;
          --nav-btn-gap: 6px;

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
          position: relative;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #F1F5F9;
        }

        .logo-text {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
          color: #F1F5F9;
          line-height: 32px;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
          /* Center over the cards */
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .nav-link {
          color: #CBD5E1;
          text-decoration: none;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 0.2s ease;
        }

        .nav-link:hover {
          color: #FFFFFF;
        }

        /* ============================================
           NAV ACTIONS - Consistent 36px height system
           ============================================ */
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Base button style - uses CSS variables */
        .nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--nav-btn-gap);
          height: var(--nav-btn-height);
          padding: var(--nav-btn-padding);
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: var(--nav-btn-radius);
          color: #F1F5F9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: var(--nav-btn-font);
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-btn:hover {
          background: rgba(148, 163, 184, 0.15);
          border-color: rgba(148, 163, 184, 0.35);
        }

        .nav-btn svg {
          flex-shrink: 0;
          width: var(--nav-btn-icon);
          height: var(--nav-btn-icon);
        }

        /* Wallet connect button variant */
        .wallet-btn {
          background: linear-gradient(135deg, rgba(0, 255, 178, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%);
          border-color: rgba(0, 255, 178, 0.3);
          color: #00FFB2;
        }

        .wallet-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 255, 178, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
          border-color: rgba(0, 255, 178, 0.5);
        }

        .wallet-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #00FFB2;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Wallet connected state - uses CSS variables */
        .wallet-connected {
          display: flex;
          align-items: center;
          gap: 8px;
          height: var(--nav-btn-height);
          padding: 0 10px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: var(--nav-btn-radius);
        }

        .tier-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 22px;
          padding: 0 8px;
          background: color-mix(in srgb, var(--tier-color) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--tier-color) 25%, transparent);
          border-radius: 4px;
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--tier-color);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .tier-badge:hover {
          background: color-mix(in srgb, var(--tier-color) 20%, transparent);
          border-color: color-mix(in srgb, var(--tier-color) 40%, transparent);
        }

        .wallet-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .wallet-dot {
          width: 6px;
          height: 6px;
          background: #10B981;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .wallet-address {
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #F1F5F9;
        }

        .disconnect-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 4px;
          color: #F43F5E;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .disconnect-btn:hover {
          background: rgba(244, 63, 94, 0.2);
          border-color: rgba(244, 63, 94, 0.4);
        }

        /* ============================================
           RESPONSIVE - Mobile (768px)
           ============================================ */
        @media (max-width: 768px) {
          .navbar {
            padding: 0 16px;
          }

          .nav-inner {
            height: 60px;
          }

          .nav-links {
            display: none;
          }

          .logo-text {
            font-size: 18px;
          }

          .nav-actions {
            gap: 8px;
          }

          /* Mobile: Override CSS variables for smaller buttons */
          .navbar {
            --nav-btn-height: var(--nav-btn-height-mobile);
            --nav-btn-padding: var(--nav-btn-padding-mobile);
            --nav-btn-font: var(--nav-btn-font-mobile);
            --nav-btn-icon: var(--nav-btn-icon-mobile);
          }

          .wallet-connected {
            padding: 0 8px;
            gap: 6px;
          }

          .wallet-address {
            font-size: 10px;
          }

          .tier-badge {
            height: 20px;
            padding: 0 6px;
            font-size: 8px;
          }

          .disconnect-btn {
            width: 20px;
            height: 20px;
          }

          .disconnect-btn svg {
            width: 12px;
            height: 12px;
          }
        }

        /* ============================================
           RESPONSIVE - Small Mobile (400px)
           ============================================ */
        @media (max-width: 400px) {
          .nav-actions {
            gap: 6px;
          }

          .wallet-address {
            display: none;
          }

          .wallet-dot {
            width: 8px;
            height: 8px;
          }
        }
      `}</style>
    </>
  );
}
