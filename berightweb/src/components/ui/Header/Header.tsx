/**
 * Header - Unified navigation header for BeRight
 *
 * Chainlift-inspired sticky header with glassmorphism and responsive design.
 *
 * @example
 * <Header />
 *
 * @example With custom actions
 * <Header>
 *   <WalletButton />
 * </Header>
 */

'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export interface NavItem {
  href: string;
  label: string;
  /** Match path exactly or as prefix */
  exact?: boolean;
}

export interface HeaderProps {
  /** Override default navigation items */
  navItems?: NavItem[];
  /** Show mobile menu toggle */
  showMobileMenu?: boolean;
  /** Additional actions (wallet button, etc.) */
  children?: ReactNode;
  /** Transparent background (for hero sections) */
  transparent?: boolean;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', exact: true },
  { href: '/markets', label: 'Markets' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/beright-terminal', label: 'Terminal' },
  { href: '/docs', label: 'Docs' },
];

export function Header({
  navItems = DEFAULT_NAV_ITEMS,
  showMobileMenu = true,
  children,
  transparent = false,
}: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for background transition
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const headerClasses = [
    styles.header,
    scrolled && styles.scrolled,
    transparent && !scrolled && styles.transparent,
    mobileMenuOpen && styles.menuOpen,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClasses}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBe}>Be</span>
          <span className={styles.logoRight}>Right</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item) ? styles.active : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          {children}

          {/* Mobile Menu Toggle */}
          {showMobileMenu && (
            <button
              className={styles.menuToggle}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <span className={styles.menuIcon}>
                <span />
                <span />
                <span />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
          <nav className={styles.mobileNav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavLink} ${isActive(item) ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;
