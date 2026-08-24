'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  Info,
  Layers3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { PageWrapper } from '@/components/ui';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';
import { useBerightWallet } from '@/context/BerightWalletContext';
import {
  getCapitalPositions,
  getCapitalStrategyProviders,
  getCapitalYieldRate,
  prepareJupiterEarnTransaction,
  recommendCapitalAction,
  simulateCapitalPosition,
  type CapitalPosition,
  type CapitalRouteRecommendation,
  type CapitalSimulation,
  type CapitalStrategyProvider,
  type CapitalYieldRate,
} from '@/lib/api';
import styles from './capital.module.css';
import CapitalMarketplace from './CapitalMarketplace';

const DEMO_WALLET = '11111111111111111111111111111111';

interface FormErrors {
  shares?: string;
  opposingAvailableShares?: string;
  holdingDays?: string;
  form?: string;
}

function formatUsd(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function formatPercent(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  return `${formatNumber(value, maximumFractionDigits)}%`;
}

function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return 'Unknown';
  return `${Math.max(0, Math.floor(days))} days`;
}

function positionKey(position: CapitalPosition): string {
  return `${position.mintAddress}:${position.market?.side ?? position.side ?? 'unknown'}`;
}

function statusLabel(position: CapitalPosition): string {
  if (position.available === false || !position.eligibility) return 'Unavailable';
  if (position.eligibility.status === 'eligible') return 'Eligible';
  if (position.eligibility.status === 'review') return 'Review';
  return 'Ineligible';
}

function CapitalSkeleton() {
  return (
    <div className={styles.positionList} aria-label="Loading prediction positions">
      {[0, 1].map((item) => (
        <div className={styles.positionSkeleton} key={item}>
          <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.skeletonMedium}`} />
        </div>
      ))}
    </div>
  );
}

export default function CapitalPage() {
  return (
    <Suspense fallback={<div className={styles.routeLoading} aria-label="Loading Capital" />}>
      <CapitalRoute />
    </Suspense>
  );
}

function CapitalRoute() {
  const searchParams = useSearchParams();
  if (searchParams.get('view') === 'lab') return <CapitalLabPage />;
  return <CapitalMarketplace />;
}

function CapitalLabPage() {
  const { isDemo, isLoading: modeLoading } = useMode();
  const { isAuthenticated, isLoading: userLoading, walletAddress, login } = useUser();
  const wallet = useBerightWallet();
  const [positions, setPositions] = useState<CapitalPosition[]>([]);
  const [yieldRate, setYieldRate] = useState<CapitalYieldRate | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shares, setShares] = useState('');
  const [opposingAvailableShares, setOpposingAvailableShares] = useState('');
  const [holdingDays, setHoldingDays] = useState('30');
  const [simulation, setSimulation] = useState<CapitalSimulation | null>(null);
  const [recommendation, setRecommendation] = useState<CapitalRouteRecommendation | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [rateLoading, setRateLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [strategyProviders, setStrategyProviders] = useState<CapitalStrategyProvider[]>([]);
  const [strategyAmount, setStrategyAmount] = useState('100');
  const [strategyAction, setStrategyAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [strategySubmitting, setStrategySubmitting] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategySignature, setStrategySignature] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const sharesInputRef = useRef<HTMLInputElement>(null);
  const opposingInputRef = useRef<HTMLInputElement>(null);
  const daysInputRef = useRef<HTMLInputElement>(null);

  const selectedPosition = useMemo(
    () => positions.find((position) => positionKey(position) === selectedKey) ?? null,
    [positions, selectedKey]
  );

  const loadData = useCallback(async () => {
    setPositionsLoading(true);
    setRateLoading(true);
    setPositionsError(null);
    setRateError(null);

    const address = isDemo ? (walletAddress || DEMO_WALLET) : walletAddress;
    const positionsRequest = address
      ? getCapitalPositions(address)
      : Promise.resolve({ success: true, data: [] as CapitalPosition[] });

    const [positionsResult, rateResult] = await Promise.allSettled([
      positionsRequest,
      getCapitalYieldRate(),
    ]);

    if (positionsResult.status === 'fulfilled') {
      const nextPositions = positionsResult.value.data;
      setPositions(nextPositions);
      setSelectedKey((current) => {
        if (current && nextPositions.some((position) => positionKey(position) === current)) return current;
        const firstUsable = nextPositions.find((position) => position.eligibility?.status !== 'ineligible');
        return firstUsable ? positionKey(firstUsable) : null;
      });
    } else {
      setPositions([]);
      setPositionsError(positionsResult.reason instanceof Error
        ? positionsResult.reason.message
        : 'Could not load your prediction positions.');
    }
    setPositionsLoading(false);

    if (rateResult.status === 'fulfilled') {
      setYieldRate(rateResult.value.data);
    } else {
      setYieldRate(null);
      setRateError(rateResult.reason instanceof Error
        ? rateResult.reason.message
        : 'Could not load the USDC reference rate.');
    }
    setRateLoading(false);
  }, [isDemo, walletAddress]);

  useEffect(() => {
    if (modeLoading || userLoading) return;
    void loadData();
  }, [loadData, modeLoading, userLoading]);

  useEffect(() => {
    let active = true;
    void getCapitalStrategyProviders()
      .then((response) => {
        if (active) setStrategyProviders(response.data);
      })
      .catch((error) => {
        if (active) setStrategyError(error instanceof Error ? error.message : 'Could not load strategy providers.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedPosition) return;
    const selectedShares = selectedPosition.shares;
    setShares(formatNumber(selectedShares, 6).replaceAll(',', ''));
    setOpposingAvailableShares(formatNumber(selectedShares * 0.75, 6).replaceAll(',', ''));
    const maximumDays = Math.min(365, Math.max(1, Math.floor((selectedPosition.eligibility?.daysToResolution ?? 32) - 2)));
    setHoldingDays(String(Math.min(30, maximumDays)));
    setSimulation(null);
    setRecommendation(null);
    setFormErrors({});
  }, [selectedPosition]);

  const validateForm = (): { shares: number; opposing: number; days: number } | null => {
    const nextErrors: FormErrors = {};
    const parsedShares = Number(shares);
    const parsedOpposing = Number(opposingAvailableShares);
    const parsedDays = Number(holdingDays);
    const maximumDays = Math.min(365, Math.max(0, Math.floor((selectedPosition?.eligibility?.daysToResolution ?? 0) - 2)));

    if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
      nextErrors.shares = 'Enter a share amount greater than zero.';
    } else if (selectedPosition && parsedShares > selectedPosition.shares) {
      nextErrors.shares = `You have ${formatNumber(selectedPosition.shares, 6)} shares available.`;
    }
    if (!Number.isFinite(parsedOpposing) || parsedOpposing < 0) {
      nextErrors.opposingAvailableShares = 'Modeled opposite-side shares cannot be negative.';
    }
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > maximumDays) {
      nextErrors.holdingDays = `Choose 1–${maximumDays} days to preserve the unwind buffer.`;
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => {
        if (nextErrors.shares) sharesInputRef.current?.focus();
        else if (nextErrors.opposingAvailableShares) opposingInputRef.current?.focus();
        else if (nextErrors.holdingDays) daysInputRef.current?.focus();
      });
      return null;
    }
    return { shares: parsedShares, opposing: parsedOpposing, days: parsedDays };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSimulation(null);
    setRecommendation(null);
    const values = validateForm();
    const market = selectedPosition?.market;
    if (!values || !market) return;

    setSubmitting(true);
    setFormErrors({});
    try {
      const input = {
        ticker: market.ticker,
        side: market.side,
        shares: values.shares,
        opposingAvailableShares: values.opposing,
        holdingDays: values.days,
      };
      const [simulationResponse, routingResponse] = await Promise.all([
        simulateCapitalPosition(input),
        recommendCapitalAction(input),
      ]);
      setSimulation(simulationResponse.data.simulation);
      setRecommendation(routingResponse.data.recommendation);
    } catch (error) {
      setFormErrors({
        form: error instanceof Error ? error.message : 'The simulation could not be completed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnect = async () => {
    setPositionsError(null);
    try {
      await login();
    } catch (error) {
      setPositionsError(error instanceof Error ? error.message : 'Wallet connection was not completed.');
    }
  };

  const handleJupiterStrategy = async () => {
    setStrategyError(null);
    setStrategySignature(null);
    if (isDemo) {
      setStrategyError('Jupiter Earn execution is mainnet-only. Switch to production mode first.');
      return;
    }
    if (!walletAddress || !wallet.signTransaction) {
      setStrategyError('Connect a Solana wallet that supports transaction signing.');
      return;
    }
    const amount = Number(strategyAmount);
    if (!Number.isFinite(amount) || amount < 0.000001 || amount > 10_000) {
      setStrategyError('Enter an amount from 0.000001 to 10,000 USDC.');
      return;
    }

    setStrategySubmitting(true);
    try {
      const amountAtomic = BigInt(Math.round(amount * 1_000_000)).toString();
      const response = await prepareJupiterEarnTransaction({
        action: strategyAction,
        wallet: walletAddress,
        amountAtomic,
      });
      const bytes = Uint8Array.from(atob(response.data.transaction), (character) => character.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(bytes);
      const signed = await wallet.signTransaction(transaction);
      const serialized = signed instanceof Uint8Array ? signed : signed.serialize();
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
        'confirmed',
      );
      const signature = await connection.sendRawTransaction(serialized, {
        maxRetries: 3,
        skipPreflight: false,
      });
      await connection.confirmTransaction({
        signature,
        blockhash: response.data.recentBlockhash,
        lastValidBlockHeight: response.data.lastValidBlockHeight,
      }, 'confirmed');
      setStrategySignature(signature);
    } catch (error) {
      setStrategyError(error instanceof Error ? error.message : 'The wallet transaction was not completed.');
    } finally {
      setStrategySubmitting(false);
    }
  };

  const totalEligibleValue = positions.reduce((total, position) => {
    if (position.eligibility?.status === 'ineligible') return total;
    return total + (position.positionValueUsd ?? 0);
  }, 0);

  const selectedStatus = selectedPosition ? statusLabel(selectedPosition) : null;
  const canSimulate = Boolean(
    selectedPosition?.market
    && selectedPosition.eligibility
    && selectedPosition.eligibility.status !== 'ineligible'
    && yieldRate?.apyPct !== null
  );

  return (
    <PageWrapper
      showHeader={false}
      showFooter={false}
      maxWidth="full"
      className={styles.page}
    >
      <section className={styles.hero} aria-labelledby="capital-title">
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} aria-hidden="true" />
            Capital beta · Wallet-signed execution
          </div>
          <h1 id="capital-title">Make your position productive while reality catches up.</h1>
          <p>
            BeRight Capital finds conservative prediction positions, values them at executable bids,
            models matched-pair yield, and prepares allowlisted USDC strategies for your wallet to review.
          </p>
        </div>
        <div className={styles.trustCard}>
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Your wallet stays in control</strong>
            <span>BeRight cannot sign, submit, or call a strategy without your wallet confirmation.</span>
          </div>
        </div>
      </section>

      <section className={styles.metricGrid} aria-label="Capital overview">
        <article className={styles.metricCard}>
          <span>Eligible position value</span>
          <strong>{positionsLoading ? 'Loading…' : formatUsd(totalEligibleValue)}</strong>
          <small>Marked at executable bids</small>
        </article>
        <article className={styles.metricCard}>
          <span>USDC reference APY</span>
          <strong>{rateLoading ? 'Loading…' : formatPercent(yieldRate?.apyPct)}</strong>
          <small>{yieldRate?.source === 'demo_model' ? 'Modeled demo rate' : 'Variable Jupiter Earn rate'}</small>
        </article>
        <article className={styles.metricCard}>
          <span>Eligible positions</span>
          <strong>{positionsLoading ? '—' : positions.filter((position) => position.eligibility?.status !== 'ineligible').length}</strong>
          <small>Deterministic risk policy</small>
        </article>
      </section>

      <section className={styles.strategySection} aria-labelledby="strategy-heading">
        <div className={styles.strategyHeader}>
          <div>
            <span className={styles.sectionKicker}>Live strategy boundary</span>
            <h2 id="strategy-heading">External USDC yield</h2>
          </div>
          <span className={styles.readOnlyBadge}><LockKeyhole size={14} aria-hidden="true" /> Wallet signed</span>
        </div>
        <div className={styles.strategyGrid}>
          <div className={styles.providerList}>
            {strategyProviders.map((provider) => (
              <article className={styles.providerCard} key={provider.id}>
                <div>
                  <strong>{provider.name}</strong>
                  <span>{provider.asset} · {provider.custody.replace('_', ' ')}</span>
                </div>
                <span className={provider.status === 'transaction_ready' ? styles.providerReady : styles.providerGated}>
                  {provider.status === 'transaction_ready' ? 'Ready' : 'Gated'}
                </span>
                {provider.reason && <p>{provider.reason}</p>}
              </article>
            ))}
          </div>
          <div className={styles.strategyForm}>
            <div className={styles.strategyTabs} aria-label="Jupiter Earn action">
              {(['deposit', 'withdraw'] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={strategyAction === action}
                  className={strategyAction === action ? styles.strategyTabActive : ''}
                  onClick={() => setStrategyAction(action)}
                >
                  {action === 'deposit' ? 'Deposit' : 'Withdraw'}
                </button>
              ))}
            </div>
            <label htmlFor="strategy-amount">USDC amount</label>
            <div className={styles.strategyAmountRow}>
              <input
                id="strategy-amount"
                inputMode="decimal"
                value={strategyAmount}
                onChange={(event) => setStrategyAmount(event.target.value)}
                disabled={strategySubmitting}
              />
              <span>USDC</span>
            </div>
            <button
              type="button"
              className={styles.strategySubmit}
              disabled={
                strategySubmitting
                || strategyProviders.find((provider) => provider.id === 'jupiter_earn')?.status !== 'transaction_ready'
              }
              onClick={() => void handleJupiterStrategy()}
            >
              {strategySubmitting ? 'Waiting for wallet…' : `Review & ${strategyAction}`}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className={styles.strategyNotice}>
              Borrowed principal is never presented as yield. Jupiter rates are variable and withdrawals depend on protocol liquidity.
            </p>
            {strategyError && <p className={styles.strategyError} role="alert">{strategyError}</p>}
            {strategySignature && (
              <a
                className={styles.strategySuccess}
                href={`https://solscan.io/tx/${strategySignature}`}
                target="_blank"
                rel="noreferrer"
              >
                Confirmed on Solana ↗
              </a>
            )}
          </div>
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="positions-heading">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionKicker}>01 · Position scan</span>
              <h2 id="positions-heading">Eligible positions</h2>
            </div>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => void loadData()}
              disabled={positionsLoading || rateLoading}
              aria-label="Refresh positions and rates"
              title="Refresh positions and rates"
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </div>

          {positionsLoading ? <CapitalSkeleton /> : positionsError ? (
            <div className={styles.stateCard} role="alert">
              <AlertTriangle size={22} aria-hidden="true" />
              <div>
                <strong>Couldn’t scan positions</strong>
                <p>{positionsError}</p>
                <button type="button" onClick={() => void loadData()}>Try again</button>
              </div>
            </div>
          ) : positions.length === 0 ? (
            <div className={styles.stateCard}>
              <Wallet size={22} aria-hidden="true" />
              <div>
                <strong>{!isDemo && !isAuthenticated ? 'Connect your wallet' : 'No DFlow positions found'}</strong>
                <p>
                  {!isDemo && !isAuthenticated
                    ? 'Connect a Solana wallet to scan its outcome-token balances.'
                    : 'Hold a supported DFlow YES or NO token to evaluate it here.'}
                </p>
                {!isDemo && !isAuthenticated && (
                  <button type="button" onClick={handleConnect}>Connect wallet</button>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.positionList}>
              {positions.map((position) => {
                const key = positionKey(position);
                const isSelected = key === selectedKey;
                const market = position.market;
                const eligibility = position.eligibility;
                const label = statusLabel(position);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.positionCard} ${isSelected ? styles.positionSelected : ''}`}
                    onClick={() => setSelectedKey(key)}
                    disabled={!market || !eligibility || eligibility.status === 'ineligible'}
                    aria-pressed={isSelected}
                  >
                    <div className={styles.positionTopline}>
                      <span className={`${styles.sideBadge} ${market?.side === 'NO' ? styles.sideNo : styles.sideYes}`}>
                        {market?.side ?? position.side ?? '—'}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[`status${label}`]}`}>{label}</span>
                    </div>
                    <strong className={styles.positionTitle}>{market?.title ?? position.title ?? position.marketTicker}</strong>
                    <div className={styles.positionStats}>
                      <span><small>Shares</small>{formatNumber(position.shares, 2)}</span>
                      <span><small>Bid value</small>{formatUsd(position.positionValueUsd)}</span>
                      <span><small>Risk score</small>{eligibility ? `${eligibility.score}/100` : '—'}</span>
                    </div>
                    {isSelected && (
                      <span className={styles.selectedMark}><Check size={14} aria-hidden="true" /> Selected</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedPosition?.eligibility && (
            <div className={styles.riskDetails}>
              <div className={styles.riskHeader}>
                <span>Eligibility detail</span>
                <strong>{selectedStatus} · {selectedPosition.eligibility.score}/100</strong>
              </div>
              <dl>
                <div><dt>Executable bid</dt><dd>{formatUsd(selectedPosition.eligibility.riskPrice.bestBid, 4)}</dd></div>
                <div><dt>Bid/ask spread</dt><dd>{formatNumber(selectedPosition.eligibility.riskPrice.spreadBps, 0)} bps</dd></div>
                <div><dt>Executable depth</dt><dd>{formatUsd(selectedPosition.eligibility.riskPrice.availableDepthUsd)}</dd></div>
                <div><dt>Time remaining</dt><dd>{formatDays(selectedPosition.eligibility.daysToResolution)}</dd></div>
              </dl>
              {selectedPosition.eligibility.reasons.length > 0 && (
                <ul className={styles.reasonList}>
                  {selectedPosition.eligibility.reasons.map((reason) => (
                    <li key={reason.code}>
                      <Info size={14} aria-hidden="true" />
                      {reason.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="simulator-heading">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionKicker}>02 · Yield model</span>
              <h2 id="simulator-heading">Match simulator</h2>
            </div>
            <span className={styles.readOnlyBadge}><LockKeyhole size={14} aria-hidden="true" /> Read only</span>
          </div>

          {rateError && (
            <div className={styles.inlineWarning} role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>{rateError}</span>
            </div>
          )}

          <form className={styles.simulatorForm} onSubmit={handleSubmit} noValidate>
            <div className={styles.formIntro}>
              <p>Model a position against available opposite-side demand.</p>
              <span>Nothing will be signed or submitted.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="capital-shares">Your shares</label>
              <div className={styles.inputShell}>
                <input
                  ref={sharesInputRef}
                  id="capital-shares"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                  aria-invalid={Boolean(formErrors.shares)}
                  aria-describedby={formErrors.shares ? 'capital-shares-error' : 'capital-shares-hint'}
                  disabled={!selectedPosition}
                />
                <span>shares</span>
              </div>
              {formErrors.shares ? (
                <small className={styles.fieldError} id="capital-shares-error">{formErrors.shares}</small>
              ) : (
                <small id="capital-shares-hint">Maximum: {formatNumber(selectedPosition?.shares, 6)}</small>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="capital-opposing">Modeled opposite-side demand</label>
              <div className={styles.inputShell}>
                <input
                  ref={opposingInputRef}
                  id="capital-opposing"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={opposingAvailableShares}
                  onChange={(event) => setOpposingAvailableShares(event.target.value)}
                  aria-invalid={Boolean(formErrors.opposingAvailableShares)}
                  aria-describedby={formErrors.opposingAvailableShares ? 'capital-opposing-error' : 'capital-opposing-hint'}
                  disabled={!selectedPosition}
                />
                <span>shares</span>
              </div>
              {formErrors.opposingAvailableShares ? (
                <small className={styles.fieldError} id="capital-opposing-error">{formErrors.opposingAvailableShares}</small>
              ) : (
                <small id="capital-opposing-hint">An assumption—not live deposited liquidity.</small>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="capital-days">Holding period</label>
              <div className={styles.inputShell}>
                <input
                  ref={daysInputRef}
                  id="capital-days"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={holdingDays}
                  onChange={(event) => setHoldingDays(event.target.value)}
                  aria-invalid={Boolean(formErrors.holdingDays)}
                  aria-describedby={formErrors.holdingDays ? 'capital-days-error' : 'capital-days-hint'}
                  disabled={!selectedPosition}
                />
                <span>days</span>
              </div>
              {formErrors.holdingDays ? (
                <small className={styles.fieldError} id="capital-days-error">{formErrors.holdingDays}</small>
              ) : (
                <small id="capital-days-hint">Includes a mandatory two-day unwind buffer.</small>
              )}
            </div>

            <div className={styles.assumptionRow}>
              <span>Variable strategy reference</span>
              <strong>{rateLoading ? 'Loading…' : formatPercent(yieldRate?.apyPct)}</strong>
            </div>
            <div className={styles.assumptionRow}>
              <span>Liquidity reserve</span>
              <strong>20%</strong>
            </div>
            <div className={styles.assumptionRow}>
              <span>Modeled protocol fee</span>
              <strong>0%</strong>
            </div>

            {formErrors.form && (
              <div className={styles.formError} role="alert">
                <AlertTriangle size={17} aria-hidden="true" />
                <span>{formErrors.form}</span>
              </div>
            )}

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={!canSimulate || submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Calculating…' : 'Run simulation'}
              {!submitting && <ArrowRight size={17} aria-hidden="true" />}
            </button>
            <button className={styles.futureButton} type="button" disabled>
              Deposits open after Phase 2 review
            </button>
          </form>

          <div className={styles.resultRegion} aria-live="polite">
            {simulation ? (
              <div className={styles.resultCard}>
                <div className={styles.resultLead}>
                  <span>Estimated net yield</span>
                  <strong>{formatUsd(simulation.estimatedNetUserYieldUsd, 6)}</strong>
                  <small>
                    Modeled range {formatUsd(simulation.estimatedYieldRangeUsd.low, 6)}–{formatUsd(simulation.estimatedYieldRangeUsd.high, 6)}
                  </small>
                </div>
                <dl className={styles.resultGrid}>
                  <div><dt>Matched</dt><dd>{formatNumber(simulation.matchedShares, 4)} shares</dd></div>
                  <div><dt>Unmatched</dt><dd>{formatNumber(simulation.unmatchedShares, 4)} shares</dd></div>
                  <div><dt>Pair principal</dt><dd>{formatUsd(simulation.matchedPairPrincipalUsd)}</dd></div>
                  <div><dt>Effective APY</dt><dd>{formatPercent(simulation.estimatedEffectiveApyPct)}</dd></div>
                </dl>
                {recommendation && (
                  <div className={styles.recommendation}>
                    <div>
                      <span>BeRight route</span>
                      <strong>{recommendation.action.replaceAll('_', ' ')}</strong>
                    </div>
                    <p>{recommendation.reasons[0]}</p>
                    <small>
                      Recommendation only · {recommendation.requiresWalletSignature ? 'wallet signature required' : 'no signature'}
                    </small>
                  </div>
                )}
                <p>
                  Effective APY is measured against the position’s executable-bid value. It is a model output, not a promised return.
                </p>
              </div>
            ) : (
              <div className={styles.resultPlaceholder}>
                <CircleDollarSign size={24} aria-hidden="true" />
                <div>
                  <strong>Your estimate will appear here</strong>
                  <span>Select an eligible position and run the model.</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className={styles.mechanics} aria-labelledby="mechanics-heading">
        <div className={styles.mechanicsHeading}>
          <span className={styles.sectionKicker}>How the model works</span>
          <h2 id="mechanics-heading">One complete pair. One dollar of modeled principal.</h2>
        </div>
        <ol className={styles.mechanicsGrid}>
          <li>
            <span className={styles.stepNumber}>1</span>
            <Wallet size={20} aria-hidden="true" />
            <strong>Read the position</strong>
            <p>BeRight scans outcome tokens without asking for custody or approval.</p>
          </li>
          <li>
            <span className={styles.stepNumber}>2</span>
            <Layers3 size={20} aria-hidden="true" />
            <strong>Model the match</strong>
            <p>Each YES share pairs with one NO share to model one dollar of principal.</p>
          </li>
          <li>
            <span className={styles.stepNumber}>3</span>
            <Clock3 size={20} aria-hidden="true" />
            <strong>Apply time and reserve</strong>
            <p>The model reserves 20% and stops before the market’s unwind deadline.</p>
          </li>
          <li>
            <span className={styles.stepNumber}>4</span>
            <CircleDollarSign size={20} aria-hidden="true" />
            <strong>Split modeled yield</strong>
            <p>YES and NO holders each receive half of the modeled strategy yield.</p>
          </li>
        </ol>
      </section>

      <footer className={styles.disclaimer}>
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Matched-pair results remain simulations. Jupiter Earn actions are separate, wallet-signed USDC transactions with variable rates and liquidity risk. BeRight AI can explain and prepare actions but cannot control custody, collateral values, resolution, signatures, or withdrawals.
        </p>
      </footer>
    </PageWrapper>
  );
}
