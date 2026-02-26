'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

          <a href="https://t.me/berightai" target="_blank" rel="noopener noreferrer" className="nav-cta" aria-label="Join Telegram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span>Join Telegram</span>
          </a>
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
          background: rgba(10, 10, 11, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
          color: #fff;
          line-height: 1;
        }

        .logo-icon {
          color: #00FF88;
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
          color: #fff;
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
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 15px;
          font-weight: 500;
          transition: color 0.2s ease;
          line-height: 1;
        }

        .nav-link:hover {
          color: #fff;
        }

        .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 176, 255, 0.1) 100%);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 10px;
          color: #fff;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.25s ease;
          line-height: 1;
        }

        .nav-cta:hover {
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 176, 255, 0.15) 100%);
          border-color: rgba(0, 255, 136, 0.35);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.15);
        }

        .nav-cta svg {
          flex-shrink: 0;
          display: block;
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

          .nav-cta span {
            display: none;
          }

          .nav-cta {
            padding: 10px;
          }
        }
      `}</style>
    </>
  );
}
