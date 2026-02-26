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
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #fff;
        }

        .logo-icon {
          color: #00FF88;
          font-size: 28px;
          line-height: 1;
          display: flex;
          align-items: center;
        }

        .logo-text {
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #fff;
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

        .nav-link.token {
          color: #00FF88;
          font-weight: 700;
        }

        .nav-link.token:hover {
          text-shadow: 0 0 12px rgba(0, 255, 136, 0.5);
        }

        .nav-cta {
          display: flex;
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
            font-size: 24px;
          }

          .logo-text {
            font-size: 20px;
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
