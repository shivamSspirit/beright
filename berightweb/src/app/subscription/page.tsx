'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { usePrivy } from '@privy-io/react-auth';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type BillingInterval = 'month' | 'year';

interface TierFeatures {
  dashboardAccess: boolean;
  telegramBot: boolean;
  apiAccess: boolean;
  scoutAgent: boolean;
  analystAgent: boolean;
  traderAgent: boolean;
  xdegenAgent: boolean;
  arbitrageAlerts: boolean;
  signalIntelligence: boolean;
  deepResearch: boolean;
  portfolioTracking: boolean;
  autoExecution: boolean;
  customAlerts: boolean;
  prioritySupport: boolean;
  whiteGlove: boolean;
}

interface TierLimits {
  queriesPerDay: number;
  scoutCallsPerDay: number;
  analystCallsPerDay: number;
  traderCallsPerDay: number;
  alertsPerDay: number;
  watchlistSize: number;
  apiCallsPerMinute: number;
  apiCallsPerDay: number;
}

interface Tier {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: TierFeatures;
  limits: TierLimits;
  badge: string;
  color: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER DATA (mirrors backend)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic market intelligence',
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: false,
      scoutAgent: true,
      analystAgent: false,
      traderAgent: false,
      xdegenAgent: false,
      arbitrageAlerts: false,
      signalIntelligence: false,
      deepResearch: false,
      portfolioTracking: false,
      autoExecution: false,
      customAlerts: false,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 10,
      scoutCallsPerDay: 5,
      analystCallsPerDay: 0,
      traderCallsPerDay: 0,
      alertsPerDay: 0,
      watchlistSize: 3,
      apiCallsPerMinute: 0,
      apiCallsPerDay: 0,
    },
    badge: 'FREE',
    color: '#6B7280',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Full Scout access with signal intelligence',
    priceMonthly: 29,
    priceYearly: 290,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: false,
      traderAgent: false,
      xdegenAgent: false,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: false,
      portfolioTracking: true,
      autoExecution: false,
      customAlerts: true,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 100,
      scoutCallsPerDay: 50,
      analystCallsPerDay: 0,
      traderCallsPerDay: 0,
      alertsPerDay: 20,
      watchlistSize: 20,
      apiCallsPerMinute: 10,
      apiCallsPerDay: 1000,
    },
    badge: 'PRO',
    color: '#3B82F6',
  },
  {
    id: 'alpha',
    name: 'Alpha',
    description: 'Full agent access with deep research',
    priceMonthly: 79,
    priceYearly: 790,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: false,
      customAlerts: true,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 500,
      scoutCallsPerDay: 200,
      analystCallsPerDay: 20,
      traderCallsPerDay: 50,
      alertsPerDay: 100,
      watchlistSize: 50,
      apiCallsPerMinute: 30,
      apiCallsPerDay: 5000,
    },
    badge: 'ALPHA',
    color: '#8B5CF6',
  },
  {
    id: 'whale',
    name: 'Whale',
    description: 'Unlimited access with auto-execution',
    priceMonthly: 199,
    priceYearly: 1990,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: true,
      customAlerts: true,
      prioritySupport: true,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 2000,
      scoutCallsPerDay: 1000,
      analystCallsPerDay: 100,
      traderCallsPerDay: 200,
      alertsPerDay: 500,
      watchlistSize: 200,
      apiCallsPerMinute: 60,
      apiCallsPerDay: 20000,
    },
    badge: 'WHALE',
    color: '#F59E0B',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solution with white-glove support',
    priceMonthly: 499,
    priceYearly: 4990,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: true,
      customAlerts: true,
      prioritySupport: true,
      whiteGlove: true,
    },
    limits: {
      queriesPerDay: -1,
      scoutCallsPerDay: -1,
      analystCallsPerDay: -1,
      traderCallsPerDay: -1,
      alertsPerDay: -1,
      watchlistSize: -1,
      apiCallsPerMinute: 120,
      apiCallsPerDay: -1,
    },
    badge: 'ENTERPRISE',
    color: '#10B981',
  },
];

// Feature display configuration
const FEATURE_DISPLAY: { key: keyof TierFeatures; label: string; icon: string }[] = [
  { key: 'scoutAgent', label: 'Scout Agent', icon: '🔍' },
  { key: 'analystAgent', label: 'Analyst Agent', icon: '📊' },
  { key: 'traderAgent', label: 'Trader Agent', icon: '💹' },
  { key: 'xdegenAgent', label: 'xDegen Agent', icon: '🐦' },
  { key: 'arbitrageAlerts', label: 'Arbitrage Alerts', icon: '⚡' },
  { key: 'signalIntelligence', label: 'Signal Intelligence', icon: '📡' },
  { key: 'deepResearch', label: 'Deep Research', icon: '🔬' },
  { key: 'portfolioTracking', label: 'Portfolio Tracking', icon: '📈' },
  { key: 'autoExecution', label: 'Auto-Execution', icon: '🤖' },
  { key: 'customAlerts', label: 'Custom Alerts', icon: '🔔' },
  { key: 'apiAccess', label: 'API Access', icon: '🔌' },
  { key: 'prioritySupport', label: 'Priority Support', icon: '💬' },
  { key: 'whiteGlove', label: 'White-Glove Service', icon: '🤝' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CheckIcon({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="check-icon enabled">
        <circle cx="9" cy="9" r="8" fill="rgba(16, 185, 129, 0.15)" />
        <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="check-icon disabled">
      <circle cx="9" cy="9" r="8" fill="rgba(255, 255, 255, 0.03)" />
      <path d="M6 9H12" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TierCard({
  tier,
  interval,
  isPopular,
  isCurrent,
  isAuthenticated,
  onSelect,
}: {
  tier: Tier;
  interval: BillingInterval;
  isPopular?: boolean;
  isCurrent?: boolean;
  isAuthenticated?: boolean;
  onSelect: (tier: Tier) => void;
}) {
  const price = interval === 'year' ? tier.priceYearly : tier.priceMonthly;
  const monthlyEquivalent = interval === 'year' ? Math.round(tier.priceYearly / 12) : tier.priceMonthly;
  const savings = interval === 'year' && tier.priceMonthly > 0
    ? Math.round((1 - (tier.priceYearly / (tier.priceMonthly * 12))) * 100)
    : 0;

  const formatLimit = (value: number) => {
    if (value === -1) return 'Unlimited';
    if (value === 0) return '—';
    return value.toLocaleString();
  };

  return (
    <div className={`tier-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''} ${tier.id}`} style={{ '--tier-color': tier.color } as React.CSSProperties}>
      {isCurrent && (
        <div className="current-badge">
          <span>Current Plan</span>
        </div>
      )}
      {isPopular && !isCurrent && (
        <div className="popular-badge">
          <span>Most Popular</span>
        </div>
      )}

      <div className="tier-header">
        <span className="tier-badge" style={{ background: `${tier.color}20`, color: tier.color }}>
          {tier.badge}
        </span>
        <h3 className="tier-name">{tier.name}</h3>
        <p className="tier-description">{tier.description}</p>
      </div>

      <div className="tier-pricing">
        {tier.priceMonthly === 0 ? (
          <div className="price-free">
            <span className="price-amount">Free</span>
            <span className="price-period">forever</span>
          </div>
        ) : (
          <div className="price-paid">
            <span className="price-currency">$</span>
            <span className="price-amount">{monthlyEquivalent}</span>
            <span className="price-period">/mo</span>
            {interval === 'year' && savings > 0 && (
              <span className="price-savings">Save {savings}%</span>
            )}
          </div>
        )}
        {interval === 'year' && tier.priceMonthly > 0 && (
          <p className="price-billed">${price} billed yearly</p>
        )}
      </div>

      <div className="tier-limits">
        <div className="limit-item">
          <span className="limit-value">{formatLimit(tier.limits.queriesPerDay)}</span>
          <span className="limit-label">queries/day</span>
        </div>
        <div className="limit-item">
          <span className="limit-value">{formatLimit(tier.limits.scoutCallsPerDay)}</span>
          <span className="limit-label">scout calls</span>
        </div>
        <div className="limit-item">
          <span className="limit-value">{formatLimit(tier.limits.alertsPerDay)}</span>
          <span className="limit-label">alerts/day</span>
        </div>
      </div>

      <div className="tier-features">
        {FEATURE_DISPLAY.map(({ key, label, icon }) => (
          <div key={key} className={`feature-item ${tier.features[key] ? 'enabled' : 'disabled'}`}>
            <CheckIcon enabled={tier.features[key]} />
            <span className="feature-icon">{icon}</span>
            <span className="feature-label">{label}</span>
          </div>
        ))}
      </div>

      <button
        className={`tier-cta ${tier.id === 'free' || isCurrent ? 'secondary' : 'primary'}`}
        onClick={() => onSelect(tier)}
        disabled={isCurrent}
      >
        {isCurrent
          ? 'Current Plan'
          : tier.id === 'free'
          ? 'Get Started'
          : tier.id === 'enterprise'
          ? 'Contact Sales'
          : !isAuthenticated
          ? 'Sign In to Upgrade'
          : 'Upgrade Now'}
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SubscriptionPage() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const { user, isAuthenticated, isLoading: authLoading } = useUser();
  const { login } = usePrivy();

  // Fetch current subscription on mount
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setSubscriptionLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`/api/stripe/subscription?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.subscription?.tier) {
            setCurrentTier(data.subscription.tier);
          }
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchSubscription();
  }, [isAuthenticated, user?.id]);

  const handleSelectTier = async (tier: Tier) => {
    if (tier.id === 'free') {
      // Already on free, redirect to dashboard
      window.location.href = '/';
      return;
    }

    if (tier.id === 'enterprise') {
      // Contact sales
      window.location.href = 'mailto:enterprise@beright.io?subject=Enterprise%20Plan%20Inquiry';
      return;
    }

    // Require authentication for paid tiers
    if (!isAuthenticated || !user) {
      login();
      return;
    }

    setLoading(true);

    try {
      // Create checkout session with real user data
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: tier.id,
          interval,
          userId: user.id,
          email: user.email || `${user.walletAddress}@beright.io`,
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-page">
      {/* Hero Section */}
      <header className="hero">
        <Link href="/" className="back-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="hero-title">Choose Your Plan</h1>
        <p className="hero-subtitle">
          Unlock AI-powered prediction market intelligence
        </p>

        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button
            className={`toggle-option ${interval === 'month' ? 'active' : ''}`}
            onClick={() => setInterval('month')}
          >
            Monthly
          </button>
          <button
            className={`toggle-option ${interval === 'year' ? 'active' : ''}`}
            onClick={() => setInterval('year')}
          >
            Yearly
            <span className="toggle-badge">Save 17%</span>
          </button>
        </div>
      </header>

      {/* Tiers Grid */}
      <main className="tiers-container">
        <div className="tiers-grid">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              interval={interval}
              isPopular={tier.id === 'alpha'}
              isCurrent={tier.id === currentTier}
              isAuthenticated={isAuthenticated}
              onSelect={handleSelectTier}
            />
          ))}
        </div>
      </main>

      {/* FAQ Section */}
      <section className="faq-section">
        <h2 className="faq-title">Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Can I switch plans anytime?</h3>
            <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
          </div>
          <div className="faq-item">
            <h3>What payment methods do you accept?</h3>
            <p>We accept all major credit cards through Stripe. Enterprise plans can pay via invoice.</p>
          </div>
          <div className="faq-item">
            <h3>Is there a free trial?</h3>
            <p>The Free tier is available forever. Paid plans come with a 7-day money-back guarantee.</p>
          </div>
          <div className="faq-item">
            <h3>What is auto-execution?</h3>
            <p>Whale tier includes automated trade execution based on your configured signals and risk parameters.</p>
          </div>
        </div>
      </section>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Redirecting to checkout...</p>
        </div>
      )}

      <style jsx>{`
        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SUBSCRIPTION PAGE - Premium Pricing UI
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

        .subscription-page {
          min-height: 100dvh;
          background: linear-gradient(180deg, #080C14 0%, #0D1117 50%, #080C14 100%);
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ━━━ HERO ━━━ */
        .hero {
          position: relative;
          padding: 100px 24px 40px;
          text-align: center;
        }

        .back-link {
          position: absolute;
          top: 24px;
          left: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: all 0.2s;
        }
        .back-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .hero-title {
          font-size: 42px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.5);
          max-width: 480px;
          margin: 0 auto 32px;
        }

        /* ━━━ BILLING TOGGLE ━━━ */
        .billing-toggle {
          display: inline-flex;
          align-items: center;
          padding: 4px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .toggle-option {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-option:hover { color: rgba(255, 255, 255, 0.8); }
        .toggle-option.active {
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
        }

        .toggle-badge {
          padding: 2px 8px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* ━━━ TIERS GRID ━━━ */
        .tiers-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .tiers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        /* ━━━ TIER CARD ━━━ */
        .tier-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 28px 24px;
          background: rgba(14, 14, 18, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          transition: all 0.3s ease;
        }
        .tier-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.5);
        }
        .tier-card.popular {
          border-color: rgba(139, 92, 246, 0.4);
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(14, 14, 18, 0.95) 100%);
        }
        .tier-card.popular:hover {
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 20px 40px -20px rgba(139, 92, 246, 0.3);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 16px;
          background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .current-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 16px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .tier-card.current {
          border-color: rgba(16, 185, 129, 0.4);
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 14, 18, 0.95) 100%);
        }
        .tier-card.current:hover {
          border-color: rgba(16, 185, 129, 0.6);
          box-shadow: 0 20px 40px -20px rgba(16, 185, 129, 0.3);
        }

        .tier-cta:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        .tier-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .tier-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        .tier-name {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
        }

        .tier-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.4;
        }

        /* ━━━ PRICING ━━━ */
        .tier-pricing {
          text-align: center;
          padding: 20px 0;
          margin-bottom: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .price-free .price-amount,
        .price-paid .price-amount {
          font-size: 48px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
        }

        .price-free .price-period {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin-left: 4px;
        }

        .price-paid {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
        }

        .price-currency {
          font-size: 24px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          align-self: flex-start;
          margin-top: 8px;
        }

        .price-period {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
          margin-left: 4px;
        }

        .price-savings {
          margin-left: 12px;
          padding: 4px 10px;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
          color: #10B981;
        }

        .price-billed {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* ━━━ LIMITS ━━━ */
        .tier-limits {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .limit-item {
          text-align: center;
        }

        .limit-value {
          display: block;
          font-size: 16px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: #fff;
        }

        .limit-label {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-top: 2px;
        }

        /* ━━━ FEATURES ━━━ */
        .tier-features {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .feature-item.disabled { opacity: 0.4; }

        .feature-item :global(.check-icon) {
          flex-shrink: 0;
        }

        .feature-icon {
          font-size: 14px;
          width: 20px;
          text-align: center;
        }

        .feature-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }
        .feature-item.disabled .feature-label {
          color: rgba(255, 255, 255, 0.4);
        }

        /* ━━━ CTA BUTTON ━━━ */
        .tier-cta {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tier-cta.primary {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          color: #fff;
        }
        .tier-cta.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -8px rgba(16, 185, 129, 0.5);
        }

        .tier-cta.secondary {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
        }
        .tier-cta.secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.3);
          color: #fff;
        }

        /* ━━━ FAQ SECTION ━━━ */
        .faq-section {
          max-width: 1000px;
          margin: 80px auto 0;
          padding: 0 24px;
        }

        .faq-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          text-align: center;
          margin-bottom: 40px;
        }

        .faq-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .faq-item {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .faq-item h3 {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }

        .faq-item p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
        }

        /* ━━━ LOADING OVERLAY ━━━ */
        .loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(8, 12, 20, 0.95);
          backdrop-filter: blur(10px);
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid rgba(16, 185, 129, 0.2);
          border-top-color: #10B981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-overlay p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ━━━ RESPONSIVE ━━━ */
        @media (max-width: 768px) {
          .hero {
            padding: 80px 16px 32px;
          }

          .back-link {
            top: 16px;
            left: 16px;
            padding: 6px 12px;
            font-size: 13px;
          }

          .hero-title {
            font-size: 32px;
          }

          .hero-subtitle {
            font-size: 15px;
            margin-bottom: 24px;
          }

          .toggle-option {
            padding: 10px 16px;
            font-size: 13px;
          }

          .tiers-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .tier-card {
            padding: 24px 20px;
          }

          .price-free .price-amount,
          .price-paid .price-amount {
            font-size: 40px;
          }

          .faq-section {
            margin-top: 60px;
          }

          .faq-title {
            font-size: 24px;
            margin-bottom: 24px;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .tiers-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1025px) and (max-width: 1280px) {
          .tiers-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: 1281px) {
          .tiers-grid {
            grid-template-columns: repeat(5, 1fr);
          }

          .tier-card {
            padding: 32px 28px;
          }
        }
      `}</style>
    </div>
  );
}
