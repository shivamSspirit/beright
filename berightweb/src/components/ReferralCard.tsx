'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Users, Gift, ChevronRight } from 'lucide-react';
import {
  generateReferralCode,
  getReferralLink,
  getCurrentReferralTier,
  getNextReferralTier,
  REFERRAL_TIERS,
} from '@/lib/referral';
import ShareButton from './ShareButton';
import styles from './ReferralCard.module.css';

interface ReferralCardProps {
  walletAddress?: string;
  referralCount?: number;
  variant?: 'compact' | 'full';
}

export default function ReferralCard({
  walletAddress,
  referralCount = 0,
  variant = 'compact',
}: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const referralCode = generateReferralCode(walletAddress);
  const referralLink = getReferralLink(referralCode);

  const currentTier = getCurrentReferralTier(referralCount);
  const nextTier = getNextReferralTier(referralCount);
  const progress = nextTier
    ? ((referralCount - (currentTier?.count || 0)) /
        (nextTier.count - (currentTier?.count || 0))) *
      100
    : 100;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }, [referralLink]);

  if (variant === 'compact') {
    return (
      <div className={styles.compactCard}>
        <div className={styles.compactHeader}>
          <div className={styles.compactIcon}>
            <Gift size={16} />
          </div>
          <div className={styles.compactInfo}>
            <span className={styles.compactTitle}>Invite Friends</span>
            <span className={styles.compactSubtitle}>Earn XP for each referral</span>
          </div>
          <ChevronRight size={16} className={styles.compactArrow} />
        </div>
        <div className={styles.compactCode}>
          <span className={styles.codeText}>{referralCode}</span>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Users size={18} />
        </div>
        <div>
          <h3 className={styles.title}>Invite Friends</h3>
          <p className={styles.subtitle}>
            Earn {REFERRAL_TIERS[0].xp} XP for each friend who joins
          </p>
        </div>
      </div>

      {/* Referral Link */}
      <div className={styles.linkBox}>
        <div className={styles.linkContent}>
          <span className={styles.linkLabel}>Your referral link</span>
          <span className={styles.linkUrl}>{referralLink}</span>
        </div>
        <button
          className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Share Buttons */}
      <ShareButton
        context={{ type: 'referral' }}
        referralCode={referralCode}
        variant="expanded"
      />

      {/* Progress */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>
            {currentTier ? (
              <>
                {currentTier.badge} {currentTier.reward}
              </>
            ) : (
              'Start inviting!'
            )}
          </span>
          <span className={styles.progressCount}>
            {referralCount} referral{referralCount !== 1 ? 's' : ''}
          </span>
        </div>

        {nextTier && (
          <>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className={styles.progressNext}>
              <span>Next: {nextTier.badge} {nextTier.reward}</span>
              <span>{nextTier.count - referralCount} more to go</span>
            </div>
          </>
        )}
      </div>

      {/* Rewards Tiers */}
      <div className={styles.tiersSection}>
        <span className={styles.tiersTitle}>Rewards</span>
        <div className={styles.tiersList}>
          {REFERRAL_TIERS.slice(0, 4).map((tier) => {
            const isUnlocked = referralCount >= tier.count;
            const isCurrent = currentTier?.count === tier.count;
            return (
              <div
                key={tier.count}
                className={`${styles.tierItem} ${isUnlocked ? styles.unlocked : ''} ${isCurrent ? styles.current : ''}`}
              >
                <span className={styles.tierBadge}>{tier.badge}</span>
                <span className={styles.tierCount}>{tier.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
