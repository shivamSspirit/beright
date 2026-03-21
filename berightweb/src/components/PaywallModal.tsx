'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSubscription, SubscriptionTier, TIER_CONFIG } from '@/hooks/useSubscription';
import { X, Crown, Zap, Lock, ArrowRight } from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type PaywallReason =
  | 'feature'
  | 'agent'
  | 'rate_limit'
  | 'upgrade';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: PaywallReason;
  featureName?: string;
  requiredTier?: SubscriptionTier;
  currentUsage?: number;
  limit?: number;
}

// Tier order for comparison
const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'alpha', 'whale', 'enterprise'];

// Feature highlights per tier
const TIER_HIGHLIGHTS: Record<SubscriptionTier, string[]> = {
  free: ['Basic dashboard access', 'Scout agent (5/day)', 'Community support'],
  pro: ['Full Scout agent', 'Arbitrage alerts', 'Signal intelligence', 'API access'],
  alpha: ['All 4 AI agents', 'Deep research', '500 queries/day', 'Priority alerts'],
  whale: ['Unlimited queries', 'Auto-execution', 'Priority support', 'Advanced analytics'],
  enterprise: ['Custom solutions', 'White-glove service', 'Dedicated support', 'SLA guarantees'],
};

// Pricing info
const TIER_PRICING: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 29, yearly: 290 },
  alpha: { monthly: 79, yearly: 790 },
  whale: { monthly: 199, yearly: 1990 },
  enterprise: { monthly: 499, yearly: 4990 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PaywallModal({
  isOpen,
  onClose,
  reason = 'upgrade',
  featureName,
  requiredTier = 'pro',
  currentUsage,
  limit,
}: PaywallModalProps) {
  const { tier: currentTier, tierConfig: currentTierConfig } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(requiredTier);

  if (!isOpen) return null;

  // Get the recommended tier (required or next tier up)
  const recommendedTier = requiredTier || getNextTier(currentTier);
  const recommendedConfig = TIER_CONFIG[recommendedTier];

  // Get title and message based on reason
  const getContent = () => {
    switch (reason) {
      case 'feature':
        return {
          icon: <Lock size={32} />,
          title: 'Premium Feature',
          message: `${featureName || 'This feature'} requires a ${recommendedConfig.name} subscription or higher.`,
        };
      case 'agent':
        return {
          icon: <Zap size={32} />,
          title: 'Agent Access Required',
          message: `The ${featureName || 'requested agent'} is available on ${recommendedConfig.name} and higher tiers.`,
        };
      case 'rate_limit':
        return {
          icon: <Crown size={32} />,
          title: 'Daily Limit Reached',
          message: `You've used ${currentUsage}/${limit} queries today. Upgrade for more queries.`,
        };
      default:
        return {
          icon: <Crown size={32} />,
          title: 'Upgrade Your Plan',
          message: 'Unlock more features and higher limits with a premium subscription.',
        };
    }
  };

  const content = getContent();

  // Get available upgrade tiers
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  const upgradeTiers = TIER_ORDER.filter((_, index) => index > currentTierIndex && index < 4); // Exclude enterprise for now

  return (
    <>
      <div className="paywall-overlay" onClick={onClose} />
      <div className="paywall-modal">
        {/* Close Button */}
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Header */}
        <div className="modal-header">
          <div className="icon-container" style={{ '--tier-color': recommendedConfig.color } as React.CSSProperties}>
            {content.icon}
          </div>
          <h2 className="modal-title">{content.title}</h2>
          <p className="modal-message">{content.message}</p>
        </div>

        {/* Current Tier Badge */}
        <div className="current-tier">
          <span className="current-tier-label">Current Plan:</span>
          <span
            className="current-tier-badge"
            style={{
              background: `${currentTierConfig.color}20`,
              color: currentTierConfig.color,
              border: `1px solid ${currentTierConfig.color}40`,
            }}
          >
            {currentTierConfig.badge}
          </span>
        </div>

        {/* Upgrade Options */}
        <div className="upgrade-options">
          {upgradeTiers.map((tierKey) => {
            const config = TIER_CONFIG[tierKey];
            const pricing = TIER_PRICING[tierKey];
            const highlights = TIER_HIGHLIGHTS[tierKey];
            const isRecommended = tierKey === recommendedTier;
            const isSelected = tierKey === selectedTier;

            return (
              <button
                key={tierKey}
                className={`tier-option ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                onClick={() => setSelectedTier(tierKey)}
                style={{ '--tier-color': config.color } as React.CSSProperties}
              >
                {isRecommended && <span className="recommended-badge">Recommended</span>}
                <div className="tier-option-header">
                  <span className="tier-name">{config.name}</span>
                  <span className="tier-price">
                    <span className="price-amount">${pricing.monthly}</span>
                    <span className="price-period">/mo</span>
                  </span>
                </div>
                <ul className="tier-highlights">
                  {highlights.slice(0, 3).map((highlight, i) => (
                    <li key={i}>{highlight}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <Link href="/subscription" className="upgrade-cta" onClick={onClose}>
          <Crown size={18} />
          View All Plans
          <ArrowRight size={18} />
        </Link>

        {/* Footer */}
        <p className="modal-footer">
          7-day money-back guarantee. Cancel anytime.
        </p>
      </div>

      <style jsx>{`
        .paywall-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          z-index: 9998;
          animation: fadeIn 0.2s ease;
        }

        .paywall-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          background: linear-gradient(180deg, #0E0E12 0%, #0A0A0E 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 32px 24px;
          z-index: 9999;
          animation: slideUp 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        .close-button {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .modal-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .icon-container {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--tier-color) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--tier-color) 30%, transparent);
          border-radius: 16px;
          color: var(--tier-color);
        }

        .modal-title {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
        }

        .modal-message {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }

        .current-tier {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .current-tier-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .current-tier-badge {
          padding: 3px 10px;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .upgrade-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .tier-option {
          position: relative;
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tier-option:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .tier-option.selected {
          border-color: var(--tier-color);
          background: color-mix(in srgb, var(--tier-color) 5%, transparent);
        }

        .tier-option.recommended {
          border-color: var(--tier-color);
        }

        .recommended-badge {
          position: absolute;
          top: -10px;
          left: 16px;
          padding: 3px 10px;
          background: var(--tier-color);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .tier-option-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .tier-name {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .tier-price {
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .price-amount {
          font-size: 18px;
          font-weight: 800;
          color: var(--tier-color);
        }

        .price-period {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .tier-highlights {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tier-highlights li {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          padding-left: 16px;
          position: relative;
        }

        .tier-highlights li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: var(--tier-color);
          font-size: 10px;
        }

        .upgrade-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upgrade-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -8px rgba(16, 185, 129, 0.5);
        }

        .modal-footer {
          margin-top: 16px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
        }

        @media (max-width: 480px) {
          .paywall-modal {
            width: 95%;
            padding: 24px 16px;
          }

          .modal-title {
            font-size: 20px;
          }

          .icon-container {
            width: 56px;
            height: 56px;
          }
        }
      `}</style>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNextTier(currentTier: SubscriptionTier): SubscriptionTier {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex < TIER_ORDER.length - 1) {
    return TIER_ORDER[currentIndex + 1];
  }
  return currentTier;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK FOR EASY USAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function usePaywall() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<PaywallModalProps, 'isOpen' | 'onClose'>>({});

  const showPaywall = (options: Omit<PaywallModalProps, 'isOpen' | 'onClose'>) => {
    setConfig(options);
    setIsOpen(true);
  };

  const hidePaywall = () => {
    setIsOpen(false);
  };

  const showFeaturePaywall = (featureName: string, requiredTier: SubscriptionTier) => {
    showPaywall({ reason: 'feature', featureName, requiredTier });
  };

  const showAgentPaywall = (agentName: string, requiredTier: SubscriptionTier) => {
    showPaywall({ reason: 'agent', featureName: agentName, requiredTier });
  };

  const showRateLimitPaywall = (currentUsage: number, limit: number) => {
    showPaywall({ reason: 'rate_limit', currentUsage, limit });
  };

  const showUpgradePaywall = () => {
    showPaywall({ reason: 'upgrade' });
  };

  return {
    isOpen,
    config,
    showPaywall,
    hidePaywall,
    showFeaturePaywall,
    showAgentPaywall,
    showRateLimitPaywall,
    showUpgradePaywall,
    PaywallModal: () => (
      <PaywallModal
        isOpen={isOpen}
        onClose={hidePaywall}
        {...config}
      />
    ),
  };
}

export default PaywallModal;
