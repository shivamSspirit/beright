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

          <a href="https://t.me/mygroupname" target="_blank" rel="noopener noreferrer" className="nav-cta" aria-label="Join Telegram">
            Join Telegram
          </a>
        </div>
      </nav>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 0 20px;
          transition: all 0.3s ease;
        }

        .navbar.scrolled {
          background: rgba(10, 10, 11, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #fff;
          font-weight: 700;
          font-size: 20px;
        }

        .logo-icon {
          color: #00FF88;
          font-size: 24px;
        }

        .logo-text {
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .nav-links {
          display: flex;
          gap: 32px;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #fff;
        }

        .nav-cta {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .nav-cta:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }

        @media (max-width: 768px) {
          .navbar {
            padding: 0 16px;
          }

          .nav-inner {
            padding: 12px 0;
          }

          .nav-links {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

