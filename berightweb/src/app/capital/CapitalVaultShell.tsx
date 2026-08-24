'use client';

import Link from 'next/link';
import { PageWrapper } from '@/components/ui';
import styles from './capital-vault.module.css';

export function CapitalVaultShell({ children }: { children: React.ReactNode }) {
  return (
    <PageWrapper
      showHeader={false}
      showFooter={false}
      maxWidth="full"
      className={styles.page}
    >
      <nav className={styles.capitalSubnav} aria-label="Capital sections">
        <Link href="/capital">Explore</Link>
        <Link href="/capital/portfolio">Portfolio</Link>
        <Link href="/capital/create">Create thesis</Link>
        <Link href="/capital?view=lab">Position lab</Link>
      </nav>
      {children}
    </PageWrapper>
  );
}
