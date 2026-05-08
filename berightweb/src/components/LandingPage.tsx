'use client';

import { useState, useCallback, useEffect, FormEvent, FocusEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUnifiedUser';
import { BadgeCheck, UserRound, Wallet, X, Menu } from 'lucide-react';
import styles from './LandingPage.module.css';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE - Public fund for prediction market forecasters
// Exactly 5 sections: Hero, How It Works, Deliverables, Cohort 1, Footer
// ═══════════════════════════════════════════════════════════════════════════════

const VENUES = ['Polymarket', 'Kalshi', 'Manifold', 'Drift', 'Limitless'];

interface WaitlistSignup {
  id: string;
  displayName: string;
  initials: string;
  role: 'forecaster' | 'lp' | 'watching';
  venues: string[];
  createdAt: string;
}

interface WaitlistStats {
  total: number;
  recentWeek: number;
  roles: {
    forecaster: number;
    lp: number;
    watching: number;
  };
  recent: WaitlistSignup[];
}

interface WaitlistResponse {
  success: boolean;
  data?: WaitlistStats;
  error?: string;
}

const EMPTY_WAITLIST_STATS: WaitlistStats = {
  total: 0,
  recentWeek: 0,
  roles: {
    forecaster: 0,
    lp: 0,
    watching: 0,
  },
  recent: [],
};

const COHORT_SIZE = 100;
const COHORT_START = 'June 2026';

const getReviewedCount = (stats: WaitlistStats, loading: boolean, error: string | null): number | null => {
  if (loading || error) return null;
  return Math.min(COHORT_SIZE, Math.max(1, stats.total));
};

// ─────────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────────

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const router = useRouter();
  const { login, isLoading } = useUser();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const handleAnchorClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollTo(id);
  };

  const handleUseDemo = async () => {
    setDemoLoading(true);
    setMobileMenuOpen(false);

    try {
      await login();
      router.push('/');
      router.refresh();
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <button
          type="button"
          className={styles.brand}
          onClick={() => scrollTo('top')}
          aria-label="Go to top"
        >
          <span className={styles.brandMark} />
          <span className={styles.brandName}>BeRight</span>
        </button>
        <div className={styles.navLinks}>
          <a href="#how" onClick={handleAnchorClick('how')}>How it works</a>
          <a href="#leaderboard" onClick={handleAnchorClick('leaderboard')}>What you get</a>
          <a href="#apply" onClick={handleAnchorClick('apply')}>Cohort 1</a>
        </div>
        <div className={styles.navActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.navApplyButton}`}
            onClick={() => scrollTo('apply')}
            type="button"
          >
            Apply for Cohort 1 <span className={styles.arr}>→</span>
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            onClick={handleUseDemo}
            type="button"
            disabled={isLoading || demoLoading}
            aria-label="Use demo and open the home card experience"
          >
            {demoLoading ? 'Connecting…' : 'Use demo'}
          </button>
        </div>
        <button
          type="button"
          className={styles.navMobileToggle}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <div
        id="mobile-nav"
        className={`${styles.navMobilePanel} ${mobileMenuOpen ? styles.navMobilePanelOpen : ''}`}
      >
        <a href="#how" onClick={handleAnchorClick('how')}>How it works</a>
        <a href="#leaderboard" onClick={handleAnchorClick('leaderboard')}>What you get</a>
        <a href="#apply" onClick={handleAnchorClick('apply')}>Cohort 1</a>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SAMPLE RESULT CARD
// ─────────────────────────────────────────────────────────────────────────────────

function ResultCard() {
  return (
    <div className={styles.resultStack}>
      <p className={styles.resultCaption}>Sample allocation · Cohort 1 begins {COHORT_START}</p>
      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <span className={styles.resultBrand}>
            <span className={styles.brandMark} style={{ width: 16, height: 16 }} />
            BeRight
          </span>
          <span className={styles.resultLive}>
            <span className={styles.liveDot} />
            FUNDED
          </span>
        </div>

        <div className={styles.resultBody}>
          <div className={styles.resultScore}>
            <span className={styles.scoreLabel}>VSCORE</span>
            <span className={styles.scoreValue}>847</span>
            <span className={styles.scoreSub}>/ 1000</span>
          </div>

          <div className={styles.resultTier}>
            <span className={styles.tierBadge}>ALPHA</span>
          </div>

          <div className={styles.resultFunded}>
            <span className={styles.fundedLabel}>Funded</span>
            <span className={styles.fundedValue}>$25,000</span>
            <span className={styles.fundedUnit}>USDC</span>
          </div>

          <div className={styles.resultWallet}>
            Deployed to <span className={styles.walletAddr}>4qN8…2hLp</span>
          </div>
        </div>

        <div className={styles.resultActions}>
          <span className={styles.shareButton}>Read-only scoring</span>
          <span className={styles.shareButton}>No custody</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 1: HERO WITH LIVE WAITLIST
// ─────────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.hero} id="top">
      <div className={`${styles.wrap} ${styles.heroInner}`}>
        {/* Left column */}
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>
            Solana · Cohort 1 reviewing
          </span>

          <h1 className={styles.heroTitle}>
            Decentralized credit layer<br />
            for prediction-market forecasters
          </h1>

          <p className={styles.heroSub}>
            Top forecasters get up to $100,000 USDC from the public pool to trade Polymarket and Kalshi, settled to your Solana wallet, read-only, no custody, you keep up to 50% of Alpha.
          </p>

          {/* Venue Connect Widget */}
          <div className={styles.venueWidget}>
            <div className={styles.venueChips}>
              {VENUES.map((venue) => (
                <span key={venue} className={styles.venueChip}>{venue}</span>
              ))}
              <span className={`${styles.venueChip} ${styles.venueWallet}`}>
                <span className={styles.solanaDot} />
                + Solana wallet
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className={styles.heroCtas}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => scrollTo('apply')}
              type="button"
            >
              Apply for Cohort 1 <span className={styles.arr}>→</span>
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => scrollTo('how')}
              type="button"
            >
              See how scoring works
            </button>
          </div>

          {/* Stats strip */}
          <div className={styles.statsStrip}>
            <span>Up to $100K per forecaster</span>
            <span className={styles.statDivider}>·</span>
            <span>Up to 50% Alpha kept</span>
            <span className={styles.statDivider}>·</span>
            <span>Read-only · no custody</span>
          </div>
        </div>

        {/* Right column - Result Card */}
        <div className={styles.heroRight}>
          <ResultCard />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 2: HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section className={styles.section} id="how">
      <div className={styles.wrap}>
        <div className={styles.howGrid}>
          {/* Card 1: Connect - with venue logos at bottom */}
          <div className={styles.howCard}>
            <div className={styles.howCardHeader}>
              <span className={styles.howStep}>01</span>
            </div>
            <h3 className={styles.howCardTitle}>Connect your venues</h3>
            <p className={styles.howCardDesc}>
              Read-only API into Polymarket, Kalshi, Manifold, Drift, plus your Solana wallet. We pull every resolved trade. Never custody anything.
            </p>
            <div className={styles.howCardFooter}>
              <div className={styles.venueLogos}>
                {['Polymarket', 'Kalshi', 'Manifold', 'Drift'].map((v) => (
                  <span key={v} className={styles.venueLogo}>{v.slice(0, 2).toUpperCase()}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Score - with score arc SVG */}
          <div className={styles.howCard}>
            <div className={styles.howCardHeader}>
              <span className={styles.howStep}>02</span>
            </div>
            <h3 className={styles.howCardTitle}>Get your VScore</h3>
            <p className={styles.howCardDesc}>
              Brier, calibration and edge collapsed into one score from 0 to 1000, posted on Solana, recomputed every block.
            </p>
            <div className={styles.howCardFooter}>
              <svg className={styles.scoreArc} viewBox="0 0 100 50" fill="none">
                <path d="M 10 45 A 40 40 0 0 1 90 45" stroke="#222" strokeWidth="6" strokeLinecap="round" />
                <path d="M 10 45 A 40 40 0 0 1 75 15" stroke="#D4F542" strokeWidth="6" strokeLinecap="round" />
                <text x="50" y="42" textAnchor="middle" fill="#888" fontSize="8" fontFamily="monospace">0–1000</text>
              </svg>
            </div>
          </div>

          {/* Card 3: Fund - Larger, lime accent */}
          <div className={`${styles.howCard} ${styles.howCardPrimary}`}>
            <div className={styles.howCardHeader}>
              <span className={styles.howStep}>03</span>
            </div>
            <h3 className={styles.howCardTitle}>Get funded to trade</h3>
            <p className={styles.howCardDesc}>
              The pool deploys USDC to your Solana wallet sized to your VScore. Trade Polymarket, Kalshi, Manifold, Drift. Keep up to 50% of Alpha.
            </p>
            <div className={styles.howCardHighlight}>
              <span className={styles.highlightAmount}>up to $100,000</span>
              <span className={styles.highlightLabel}>USDC deployed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 3: WHAT YOU GET
// ─────────────────────────────────────────────────────────────────────────────────

function WhatYouGetSection() {
  const items = [
    {
      icon: Wallet,
      title: 'Valuable USD credit line on Solana',
      desc: 'Delivered in USDC, sized to your VScore from $5K to $100K+. Settles to your wallet within 24h of approval.',
    },
    {
      icon: BadgeCheck,
      title: 'Valuable portable on-chain reputation',
      desc: 'Your VScore is one Solana account. Drift, Jupiter, and Kamino can read it directly.',
    },
    {
      icon: UserRound,
      title: 'Valuable public profile page',
      desc: 'beright.fun/@yourhandle shows your score, allocation, and PnL, your prediction résumé, on-chain.',
    },
  ];

  return (
    <section className={styles.section} id="leaderboard">
      <div className={styles.wrap}>
        <div className={styles.whatHeader}>
          <h2 className={styles.activityTitle}>What you get when you&apos;re funded</h2>
          <p className={styles.activityDesc}>
            BeRight gives funded forecasters capital, portable reputation, and a public proof page that makes their edge legible.
          </p>
        </div>

        <div className={styles.whatGrid}>
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className={styles.whatItem}>
                <span className={styles.whatIcon} aria-hidden="true">
                  <Icon size={18} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 4: COHORT 1 + APPLY FORM
// ─────────────────────────────────────────────────────────────────────────────────

function CohortSummary({
  stats,
  loading,
  error,
}: {
  stats: WaitlistStats;
  loading: boolean;
  error: string | null;
}) {
  const reviewedCount = getReviewedCount(stats, loading, error);
  const spotsOpen = reviewedCount === null ? null : Math.max(0, COHORT_SIZE - reviewedCount);
  const progress = reviewedCount === null ? 18 : Math.max(4, Math.min(100, reviewedCount));

  return (
    <div className={styles.cohortIntro}>
      <span className={styles.cohortEyebrow}>Cohort 1 · 100 forecasters</span>
      <h2>Apply for Cohort 1.</h2>
      <p>
        Reviewing applications now. First allocations deploy {COHORT_START}. We respond within 48 hours.
      </p>

      <div className={styles.cohortProgress} aria-label="Cohort 1 review progress">
        <div className={styles.cohortProgressHeader}>
          <span>Cohort 1 review progress</span>
          <span>
            {reviewedCount === null
              ? 'Review progress updating'
              : `${reviewedCount} reviewed · ${spotsOpen} spots open`}
          </span>
        </div>
        <div className={styles.cohortProgressTrack}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={styles.cohortFacts}>
        <span>Read-only venue access</span>
        <span>Solana wallet settlement</span>
        <span>48h response target</span>
      </div>
    </div>
  );
}

interface FormErrors {
  name?: string;
  email?: string;
  forecastHandle?: string;
}

interface FormTouched {
  name?: boolean;
  email?: boolean;
  forecastHandle?: boolean;
}

interface LandingApplicationResponse {
  success: boolean;
  error?: string;
  alreadyExists?: boolean;
  data?: {
    publicSignup?: WaitlistSignup;
  };
}

function ApplyForm({
  onStored,
  onSubmitted,
}: {
  onStored: (signup: WaitlistSignup) => void;
  onSubmitted: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [forecastHandle, setForecastHandle] = useState('');
  const [email, setEmail] = useState('');
  const [predictions, setPredictions] = useState(0);
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const predictionStops = [100, 500, 1000, 2000];

  const validateField = (field: string, value: string): string | undefined => {
    if (field === 'name') {
      if (!value.trim()) return 'Name is required';
    }
    if (field === 'email') {
      if (!value.trim()) return 'Email is required';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter a valid email';
    }
    if (field === 'forecastHandle') {
      if (!value.trim()) return 'Primary forecasting handle is required';
    }
    return undefined;
  };

  const handleBlur = (field: 'name' | 'email' | 'forecastHandle') => (e: FocusEvent<HTMLInputElement>) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, e.target.value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const normalizeHandle = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate all fields
    const nameError = validateField('name', name);
    const emailError = validateField('email', email);
    const forecastHandleError = validateField('forecastHandle', forecastHandle);

    setTouched({ name: true, email: true, forecastHandle: true });
    setErrors({ name: nameError, email: emailError, forecastHandle: forecastHandleError });

    if (nameError || emailError || forecastHandleError) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/landing-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          handle: normalizeHandle(forecastHandle),
          email,
          venues: [],
          resolvedPredictions: predictions,
          role,
        }),
      });

      const result = (await response.json()) as LandingApplicationResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit application');
      }

      setSubmitted(true);
      if (!result.alreadyExists && result.data?.publicSignup) {
        onStored(result.data.publicSignup);
      }
      void onSubmitted();
    } catch (error) {
      console.error('[Landing Apply] Submit failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.formSuccess}>
        <div className={styles.successCheck}>✓</div>
        <h4>Application received</h4>
        <p>We&apos;ll review your track record and reach out within 48h.</p>
      </div>
    );
  }

  return (
    <form className={styles.applyForm} onSubmit={handleSubmit} noValidate>
      <div className={`${styles.field} ${touched.name && errors.name ? styles.fieldErr : ''}`}>
        <label htmlFor="landing-name">Name <span className={styles.required}>*</span></label>
        <input
          id="landing-name"
          type="text"
          placeholder="Your name"
          autoComplete="name"
          spellCheck={false}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur('name')}
          aria-invalid={touched.name && errors.name ? 'true' : undefined}
          aria-describedby={touched.name && errors.name ? 'landing-name-error' : undefined}
        />
        {touched.name && errors.name && (
          <span id="landing-name-error" className={styles.err}>{errors.name}</span>
        )}
      </div>

      <div className={`${styles.field} ${touched.email && errors.email ? styles.fieldErr : ''}`}>
        <label htmlFor="landing-email">Email <span className={styles.required}>*</span></label>
        <input
          id="landing-email"
          type="email"
          placeholder="you@protonmail.com"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleBlur('email')}
          aria-invalid={touched.email && errors.email ? 'true' : undefined}
          aria-describedby={touched.email && errors.email ? 'landing-email-error' : undefined}
        />
        {touched.email && errors.email && (
          <span id="landing-email-error" className={styles.err}>{errors.email}</span>
        )}
      </div>

      <div className={`${styles.field} ${touched.forecastHandle && errors.forecastHandle ? styles.fieldErr : ''}`}>
        <label htmlFor="landing-handle">Primary forecasting handle <span className={styles.required}>*</span></label>
        <input
          id="landing-handle"
          type="text"
          placeholder="@yourhandle on Polymarket / Kalshi / Manifold"
          autoComplete="username"
          spellCheck={false}
          value={forecastHandle}
          onChange={(e) => setForecastHandle(e.target.value)}
          onBlur={handleBlur('forecastHandle')}
          aria-invalid={touched.forecastHandle && errors.forecastHandle ? 'true' : undefined}
          aria-describedby={touched.forecastHandle && errors.forecastHandle ? 'landing-handle-error' : undefined}
        />
        {touched.forecastHandle && errors.forecastHandle && (
          <span id="landing-handle-error" className={styles.err}>{errors.forecastHandle}</span>
        )}
      </div>

      <div className={styles.field}>
        <label>Lifetime resolved predictions</label>
        <div className={styles.rangeRow}>
          <span className={styles.rangeValue}>
            {predictions === 0 ? 'Not shared' : `${predictions >= 2000 ? '2000+' : predictions} predictions`}
          </span>
          <input
            type="range"
            min="0"
            max="2000"
            step="100"
            value={predictions}
            onChange={(e) => setPredictions(Number(e.target.value))}
            className={styles.rangeInput}
          />
          <div className={styles.rangeLabels}>
            {predictionStops.map((stop) => (
              <span
                key={stop}
                className={predictions >= stop ? styles.rangeActive : ''}
              >
                {stop === 2000 ? '2000+' : stop}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.field}>
        <label>I am a</label>
        <div className={styles.chipGrid}>
          {[
            { value: 'forecaster', label: 'Forecaster' },
            { value: 'lp', label: 'LP' },
            { value: 'watching', label: 'Just watching' },
          ].map((r) => (
            <label
              key={r.value}
              className={`${styles.roleChip} ${role === r.value ? styles.roleSelected : ''}`}
            >
              <input
                type="radio"
                name="role"
                checked={role === r.value}
                onChange={() => setRole(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className={`${styles.btn} ${styles.btnFormSubmit} ${styles.btnLg} ${styles.btnFull}`}
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'Submitting…' : 'Apply for Cohort 1'}
      </button>

      {submitError && (
        <p className={styles.submitError} role="alert">
          {submitError}
        </p>
      )}

      <p className={styles.formDisclaimer}>
        Reviewed within 48h · Trading prediction markets carries risk of loss · Not investment advice.
      </p>
    </form>
  );
}

function ShareApplySection({
  stats,
  loading,
  error,
  onStored,
  onSubmitted,
}: {
  stats: WaitlistStats;
  loading: boolean;
  error: string | null;
  onStored: (signup: WaitlistSignup) => void;
  onSubmitted: () => Promise<void>;
}) {
  return (
    <section className={styles.section} id="apply">
      <div className={styles.wrap}>
        <div className={styles.shareApplyGrid}>
          <CohortSummary stats={stats} loading={loading} error={error} />
          <ApplyForm onStored={onStored} onSubmitted={onSubmitted} />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 5: FOOTER
// ─────────────────────────────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <div className={styles.brand}>
              <span className={styles.brandMark} />
              <span className={styles.brandName}>BeRight</span>
            </div>
            <p className={styles.footerDesc}>
              Prediction-market intelligence and on-chain forecasting reputation for BeRight users.
            </p>
            <div className={styles.footerSocials}>
              <a href="https://twitter.com/beright_fi" target="_blank" rel="noopener noreferrer">X</a>
            </div>
          </div>

          <div className={styles.footerCol}>
            <h4>Protocol</h4>
            <a href="#how">How it works</a>
            <a href="#leaderboard">What you get</a>
            <span>Score formula</span>
          </div>

          <div className={styles.footerCol}>
            <h4>Forecasters</h4>
            <a href="#apply">Cohort 1</a>
            <span>FAQ</span>
          </div>
        </div>

        <div className={styles.footerBar}>
          <span>© {year} BeRight · Solana</span>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LANDING PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStats>(EMPTY_WAITLIST_STATS);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const loadWaitlistStats = useCallback(async (options?: { preserveOnError?: boolean }) => {
    setWaitlistLoading(true);
    if (!options?.preserveOnError) {
      setWaitlistError(null);
    }

    try {
      const response = await fetch('/api/landing-applications', {
        cache: 'no-store',
      });
      const result = (await response.json()) as WaitlistResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to load waitlist');
      }

      setWaitlistStats(result.data);
    } catch (error) {
      console.error('[Landing Waitlist] Load failed:', error);
      if (!options?.preserveOnError) {
        setWaitlistError(error instanceof Error ? error.message : 'Failed to load waitlist');
        setWaitlistStats(EMPTY_WAITLIST_STATS);
      }
    } finally {
      setWaitlistLoading(false);
    }
  }, []);

  const applyStoredSignup = useCallback((signup: WaitlistSignup) => {
    setWaitlistError(null);
    setWaitlistStats((current) => {
      const withoutDuplicate = current.recent.filter((item) => item.id !== signup.id);

      return {
        total: current.total + 1,
        recentWeek: current.recentWeek + 1,
        roles: {
          ...current.roles,
          [signup.role]: current.roles[signup.role] + 1,
        },
        recent: [signup, ...withoutDuplicate].slice(0, 8),
      };
    });
  }, []);

  useEffect(() => {
    void loadWaitlistStats();
  }, [loadWaitlistStats]);

  return (
    <div className={styles.landing}>
      <Navigation />
      <HeroSection />
      <HowItWorksSection />
      <WhatYouGetSection />
      <ShareApplySection
        stats={waitlistStats}
        loading={waitlistLoading}
        error={waitlistError}
        onStored={applyStoredSignup}
        onSubmitted={() => loadWaitlistStats({ preserveOnError: true })}
      />
      <Footer />
    </div>
  );
}
