/**
 * PageWrapper - Unified page layout with header, footer, and content area
 *
 * Provides consistent page structure across the app.
 *
 * @example Basic usage
 * <PageWrapper>
 *   <Section>Content here</Section>
 * </PageWrapper>
 *
 * @example With custom header actions
 * <PageWrapper headerActions={<WalletButton />}>
 *   <Section>Content here</Section>
 * </PageWrapper>
 *
 * @example Without footer (for app pages)
 * <PageWrapper showFooter={false}>
 *   <Section>Content here</Section>
 * </PageWrapper>
 */

'use client';

import { type ReactNode } from 'react';
import { Header, type NavItem } from '../Header';
import { Footer } from '../Footer';
import styles from './PageWrapper.module.css';

export interface PageWrapperProps {
  /** Page content */
  children: ReactNode;
  /** Show header (default: true) */
  showHeader?: boolean;
  /** Show footer (default: true) */
  showFooter?: boolean;
  /** Footer variant */
  footerVariant?: 'default' | 'minimal';
  /** Custom header navigation items */
  navItems?: NavItem[];
  /** Header action buttons (wallet, etc.) */
  headerActions?: ReactNode;
  /** Transparent header for hero pages */
  transparentHeader?: boolean;
  /** Max width of main content */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Additional CSS class for main content */
  className?: string;
  /** Background variant */
  background?: 'default' | 'gradient' | 'dots';
}

export function PageWrapper({
  children,
  showHeader = true,
  showFooter = true,
  footerVariant = 'default',
  navItems,
  headerActions,
  transparentHeader = false,
  maxWidth = 'full',
  className,
  background = 'default',
}: PageWrapperProps) {
  const mainClasses = [
    styles.main,
    styles[`width-${maxWidth}`],
    styles[`bg-${background}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      {showHeader && (
        <Header
          navItems={navItems}
          transparent={transparentHeader}
        >
          {headerActions}
        </Header>
      )}

      <main className={mainClasses}>
        {children}
      </main>

      {showFooter && <Footer variant={footerVariant} />}
    </div>
  );
}

export default PageWrapper;
