'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, RefreshCw, Wallet } from 'lucide-react';
import { CapitalVaultShell } from '../CapitalVaultShell';
import { useUser } from '@/hooks/useUnifiedUser';
import { getCapitalThesisPortfolio, type CapitalThesisPosition } from '@/lib/api';
import { atomicToUiAmount, formatCapitalShares, formatCapitalUsd } from '@/lib/capital-format';
import styles from '../capital-vault.module.css';

export default function CapitalPortfolio() {
  const { isAuthenticated, isLoading: walletLoading, walletAddress, login } = useUser();
  const [positions, setPositions] = useState<CapitalThesisPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!walletAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getCapitalThesisPortfolio(walletAddress);
      setPositions(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your Capital portfolio.');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => positions.reduce((result, position) => ({
    principal: result.principal + (atomicToUiAmount(position.principalAtomic) ?? 0),
    value: result.value + (atomicToUiAmount(position.currentValueAtomic) ?? 0),
    pending: result.pending + (atomicToUiAmount(position.pendingRedemptionAssetsAtomic) ?? 0),
  }), { principal: 0, value: 0, pending: 0 }), [positions]);

  return (
    <CapitalVaultShell>
      <section className={styles.portfolioHero}>
        <span className={styles.eyebrow}>Your thesis shares</span>
        <h1>Capital portfolio</h1>
        <p>Track program-recorded principal, shares, current NAV value, and redemption state by connected wallet.</p>
      </section>

      {!isAuthenticated ? (
        <section className={styles.walletEmpty}>
          <Wallet size={28} aria-hidden="true" />
          <h2>Connect your wallet</h2>
          <p>Your wallet identifies devnet share accounts. Viewing is read-only; deposits and redemptions require signatures.</p>
          <button type="button" disabled={walletLoading} onClick={() => void login()}>{walletLoading ? 'Connecting…' : 'Connect wallet'}</button>
        </section>
      ) : (
        <>
          <section className={styles.portfolioMetrics} aria-label="Portfolio summary">
            <article><span>Devnet principal</span><strong>{formatCapitalUsd(totals.principal, 'detailed')}</strong><small>USDC recorded by the vault program</small></article>
            <article><span>Checkpoint value</span><strong>{formatCapitalUsd(totals.value, 'detailed')}</strong><small>Includes pending redemption estimate</small></article>
            <article><span>Unrealized P&amp;L</span><strong className={totals.value - totals.principal >= 0 ? styles.positiveText : styles.negativeText}>{formatCapitalUsd(totals.value - totals.principal, 'detailed', true)}</strong><small>Program NAV less remaining principal</small></article>
            <article><span>Pending settlement</span><strong>{formatCapitalUsd(totals.pending, 'detailed')}</strong><small>Estimated at request NAV</small></article>
          </section>

          {loading && <div className={styles.portfolioSkeleton} aria-label="Loading portfolio"><span /><span /></div>}
          {error && (
            <div className={styles.errorState} role="alert">
              <strong>Couldn’t load your positions</strong><p>{error}</p>
              <button type="button" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" /> Retry</button>
            </div>
          )}
          {!loading && !error && positions.length === 0 && (
            <div className={styles.emptyState}>
              <BookOpen size={28} aria-hidden="true" />
              <strong>No thesis shares yet</strong>
              <p>Create or review a devnet vault and make your first wallet-signed deposit.</p>
              <Link href="/capital">Explore theses</Link>
            </div>
          )}
          {!loading && !error && positions.length > 0 && (
            <section className={styles.positionTableSection} aria-labelledby="positions-title">
              <div className={styles.sectionHeading}><div><span className={styles.cardLabel}>Holdings</span><h2 id="positions-title">Your positions</h2></div></div>
              <div className={styles.positionTableWrap}>
                <table className={styles.positionTable}>
                  <thead><tr><th>Thesis</th><th>Shares</th><th>Principal</th><th>Value</th><th>P&amp;L</th><th>Redemption</th><th><span className={styles.srOnly}>Action</span></th></tr></thead>
                  <tbody>
                    {positions.map((position) => {
                      const pnl = atomicToUiAmount(position.unrealizedPnlAtomic) ?? 0;
                      const pendingShares = atomicToUiAmount(position.pendingRedemptionSharesAtomic) ?? 0;
                      return (
                        <tr key={position.thesisSlug}>
                          <td><strong>{position.thesisName}</strong><span className={styles.mono}>{position.symbol}</span></td>
                          <td className={styles.mono}>{formatCapitalShares(atomicToUiAmount(position.sharesAtomic), 'detailed')}</td>
                          <td className={styles.mono}>{formatCapitalUsd(atomicToUiAmount(position.principalAtomic), 'detailed')}</td>
                          <td className={styles.mono}>{formatCapitalUsd(atomicToUiAmount(position.currentValueAtomic), 'detailed')}</td>
                          <td className={`${styles.mono} ${pnl >= 0 ? styles.positiveText : styles.negativeText}`}>{formatCapitalUsd(pnl, 'detailed', true)}</td>
                          <td>{pendingShares > 0 ? <span className={styles.pendingPill}>Pending {formatCapitalShares(pendingShares)}</span> : <span>None</span>}</td>
                          <td><Link href={`/capital/${position.thesisSlug}`}>Manage <ArrowRight size={14} aria-hidden="true" /></Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </CapitalVaultShell>
  );
}
