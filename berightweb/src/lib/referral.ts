/**
 * BeRight Referral System
 *
 * Handles referral tracking, link generation, and rewards.
 * Designed for viral growth with shareable links.
 */

// Referral code generation (uses wallet address or random)
export function generateReferralCode(walletAddress?: string): string {
  if (walletAddress) {
    // Use first 4 and last 4 chars of wallet for recognizable code
    return `BR${walletAddress.slice(0, 4)}${walletAddress.slice(-4)}`.toUpperCase();
  }
  // Random fallback
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BR';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate shareable referral link
export function getReferralLink(referralCode: string): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://beright.ai';
  return `${baseUrl}?ref=${referralCode}`;
}

// Extract referral code from URL
export function extractReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

// Store referral in localStorage for attribution
export function storeReferralAttribution(referralCode: string): void {
  if (typeof window === 'undefined') return;
  // Only store if not already attributed
  if (!localStorage.getItem('br_referrer')) {
    localStorage.setItem('br_referrer', referralCode);
    localStorage.setItem('br_referrer_time', Date.now().toString());
  }
}

// Get stored referral attribution
export function getReferralAttribution(): { code: string; timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  const code = localStorage.getItem('br_referrer');
  const timestamp = localStorage.getItem('br_referrer_time');
  if (!code) return null;
  return { code, timestamp: parseInt(timestamp || '0', 10) };
}

// Share text generators for different contexts
export interface ShareContext {
  type: 'prediction' | 'profile' | 'leaderboard' | 'market' | 'referral';
  data?: Record<string, unknown>;
}

export function generateShareText(context: ShareContext, referralCode?: string): {
  title: string;
  text: string;
  url: string;
} {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://beright.ai';
  const refParam = referralCode ? `?ref=${referralCode}` : '';

  switch (context.type) {
    case 'prediction': {
      const { question, direction, confidence } = context.data as {
        question: string;
        direction: 'yes' | 'no';
        confidence: number;
      };
      const emoji = direction === 'yes' ? '✅' : '❌';
      return {
        title: 'My Prediction on BeRight',
        text: `${emoji} I'm ${confidence}% confident ${direction.toUpperCase()} on:\n\n"${question}"\n\nThink you can beat my prediction?`,
        url: `${baseUrl}${refParam}`,
      };
    }

    case 'profile': {
      const { username, accuracy, totalPredictions, rank } = context.data as {
        username: string;
        accuracy: number;
        totalPredictions: number;
        rank?: number;
      };
      return {
        title: `${username}'s BeRight Stats`,
        text: `🎯 ${accuracy.toFixed(1)}% accuracy\n📊 ${totalPredictions} predictions${rank ? `\n🏆 Rank #${rank}` : ''}\n\nCan you beat my record?`,
        url: `${baseUrl}/profile${refParam}`,
      };
    }

    case 'leaderboard': {
      const { rank, username, xp } = context.data as {
        rank: number;
        username: string;
        xp: number;
      };
      return {
        title: 'BeRight Leaderboard',
        text: `🏆 I'm ranked #${rank} on BeRight!\n\n${username} • ${xp.toLocaleString()} XP\n\nJoin me and start predicting!`,
        url: `${baseUrl}/leaderboard${refParam}`,
      };
    }

    case 'market': {
      const { question, yesOdds, volume } = context.data as {
        question: string;
        yesOdds: number;
        volume?: number;
      };
      return {
        title: 'Prediction Market',
        text: `🔮 "${question}"\n\n📈 ${yesOdds}% YES${volume ? `\n💰 $${volume.toLocaleString()} volume` : ''}\n\nWhat's your take?`,
        url: `${baseUrl}${refParam}`,
      };
    }

    case 'referral':
    default:
      return {
        title: 'Join BeRight',
        text: `🧠 I'm using BeRight to make predictions and track my accuracy.\n\n🎯 AI-powered insights\n🏆 Compete on leaderboards\n💰 Real prediction markets\n\nJoin me!`,
        url: `${baseUrl}${refParam}`,
      };
  }
}

// Native share API wrapper
export async function shareNative(
  context: ShareContext,
  referralCode?: string
): Promise<boolean> {
  const shareData = generateShareText(context, referralCode);

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.text,
        url: shareData.url,
      });
      return true;
    } catch (e) {
      // User cancelled or share failed
      return false;
    }
  }
  return false;
}

// Copy to clipboard fallback
export async function copyShareLink(
  context: ShareContext,
  referralCode?: string
): Promise<boolean> {
  const shareData = generateShareText(context, referralCode);
  try {
    await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
    return true;
  } catch (e) {
    console.error('Failed to copy:', e);
    return false;
  }
}

// Social share URLs
export function getTwitterShareUrl(
  context: ShareContext,
  referralCode?: string
): string {
  const shareData = generateShareText(context, referralCode);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
}

export function getTelegramShareUrl(
  context: ShareContext,
  referralCode?: string
): string {
  const shareData = generateShareText(context, referralCode);
  return `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`;
}

// Referral rewards tiers
export interface ReferralTier {
  count: number;
  reward: string;
  xp: number;
  badge?: string;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { count: 1, reward: 'First Referral', xp: 100, badge: '🌱' },
  { count: 5, reward: 'Recruiter', xp: 500, badge: '🌿' },
  { count: 10, reward: 'Ambassador', xp: 1000, badge: '🌳' },
  { count: 25, reward: 'Evangelist', xp: 2500, badge: '🔥' },
  { count: 50, reward: 'Legend', xp: 5000, badge: '👑' },
  { count: 100, reward: 'OG', xp: 10000, badge: '💎' },
];

export function getCurrentReferralTier(referralCount: number): ReferralTier | null {
  for (let i = REFERRAL_TIERS.length - 1; i >= 0; i--) {
    if (referralCount >= REFERRAL_TIERS[i].count) {
      return REFERRAL_TIERS[i];
    }
  }
  return null;
}

export function getNextReferralTier(referralCount: number): ReferralTier | null {
  for (const tier of REFERRAL_TIERS) {
    if (referralCount < tier.count) {
      return tier;
    }
  }
  return null;
}
