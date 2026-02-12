'use client';

import { useState, useEffect, useCallback } from 'react';
import { animated, useSpring, useTrail } from '@react-spring/web';
import { MoodFilter } from './MoodPills';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface Challenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  current: number;
  reward: string;
  expiresAt: Date;
  type: 'daily' | 'weekly' | 'special';
}

export interface StreakData {
  current: number;
  longest: number;
  todayPredictions: number;
  lastPredictionAt: Date | null;
}

// ═══════════════════════════════════════════════════════════
// DAILY CHALLENGE BANNER
// ═══════════════════════════════════════════════════════════

const defaultChallenges: Challenge[] = [
  {
    id: 'predict-5',
    title: 'Quick Caller',
    description: 'Make 5 predictions today',
    emoji: '🎯',
    target: 5,
    current: 0,
    reward: '+50 XP',
    expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
    type: 'daily',
  },
  {
    id: 'easy-money',
    title: 'Easy Money Hunter',
    description: 'Find & predict on an Easy Money market',
    emoji: '💰',
    target: 1,
    current: 0,
    reward: '+25 XP',
    expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
    type: 'daily',
  },
  {
    id: 'ai-agree',
    title: 'AI Whisperer',
    description: 'Agree with AI on 3 markets',
    emoji: '🧠',
    target: 3,
    current: 0,
    reward: '+75 XP',
    expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
    type: 'daily',
  },
  {
    id: 'contrarian',
    title: 'Contrarian',
    description: 'Disagree with market consensus on 2 predictions',
    emoji: '🔮',
    target: 2,
    current: 0,
    reward: '+100 XP',
    expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
    type: 'daily',
  },
];

interface DailyChallengeBannerProps {
  challenges?: Challenge[];
  onChallengeClick?: (challenge: Challenge) => void;
}

export function DailyChallengeBanner({
  challenges = defaultChallenges.slice(0, 2),
  onChallengeClick
}: DailyChallengeBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate time until midnight
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(23, 59, 59, 999);
      const diff = midnight.getTime() - now.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${hours}h ${minutes}m`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const [spring] = useSpring(() => ({
    from: { opacity: 0, y: -20 },
    to: { opacity: 1, y: 0 },
    config: { tension: 300, friction: 24 },
  }));

  const completedCount = challenges.filter(c => c.current >= c.target).length;
  const totalXP = challenges.reduce((sum, c) => {
    if (c.current >= c.target) {
      const xp = parseInt(c.reward.replace(/[^0-9]/g, ''));
      return sum + xp;
    }
    return sum;
  }, 0);

  return (
    <animated.div className="challenge-banner" style={spring}>
      <div className="challenge-header" onClick={() => setExpanded(!expanded)}>
        <div className="challenge-left">
          <span className="challenge-icon">🎯</span>
          <div className="challenge-info">
            <span className="challenge-title">Daily Challenges</span>
            <span className="challenge-meta">
              {completedCount}/{challenges.length} done
              {totalXP > 0 && <span className="xp-earned">+{totalXP} XP</span>}
            </span>
          </div>
        </div>
        <div className="challenge-right">
          <span className="challenge-timer">{timeLeft}</span>
          <span className={`challenge-expand ${expanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {expanded && (
        <div className="challenge-list">
          {challenges.map((challenge) => {
            const progress = Math.min((challenge.current / challenge.target) * 100, 100);
            const isComplete = challenge.current >= challenge.target;

            return (
              <div
                key={challenge.id}
                className={`challenge-item ${isComplete ? 'complete' : ''}`}
                onClick={() => onChallengeClick?.(challenge)}
              >
                <span className="challenge-emoji">{challenge.emoji}</span>
                <div className="challenge-details">
                  <span className="challenge-name">{challenge.title}</span>
                  <span className="challenge-desc">{challenge.description}</span>
                  <div className="challenge-progress-bar">
                    <div
                      className="challenge-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="challenge-reward">
                  {isComplete ? (
                    <span className="reward-claimed">✓</span>
                  ) : (
                    <>
                      <span className="reward-value">{challenge.reward}</span>
                      <span className="reward-progress">{challenge.current}/{challenge.target}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .challenge-banner {
          width: 100%;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .challenge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .challenge-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .challenge-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .challenge-icon {
          font-size: 20px;
        }

        .challenge-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .challenge-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .challenge-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .xp-earned {
          color: #00E676;
          margin-left: 6px;
          font-weight: 600;
        }

        .challenge-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .challenge-timer {
          font-size: 11px;
          font-family: var(--font-mono);
          color: rgba(255, 255, 255, 0.4);
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .challenge-expand {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s;
        }

        .challenge-expand.expanded {
          transform: rotate(180deg);
        }

        .challenge-list {
          padding: 0 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .challenge-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .challenge-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .challenge-item.complete {
          background: rgba(0, 230, 118, 0.08);
          border-color: rgba(0, 230, 118, 0.2);
        }

        .challenge-emoji {
          font-size: 20px;
          flex-shrink: 0;
        }

        .challenge-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .challenge-name {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .challenge-desc {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }

        .challenge-progress-bar {
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }

        .challenge-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8B5CF6, #3B82F6);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .challenge-item.complete .challenge-progress-fill {
          background: #00E676;
        }

        .challenge-reward {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }

        .reward-value {
          font-size: 11px;
          font-weight: 700;
          color: #8B5CF6;
        }

        .reward-progress {
          font-size: 10px;
          font-family: var(--font-mono);
          color: rgba(255, 255, 255, 0.4);
        }

        .reward-claimed {
          font-size: 16px;
          color: #00E676;
        }
      `}</style>
    </animated.div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHAREABLE FILTER BUTTON
// ═══════════════════════════════════════════════════════════

interface ShareFilterButtonProps {
  mood: MoodFilter;
  count: number;
  onShare?: () => void;
}

export function ShareFilterButton({ mood, count, onShare }: ShareFilterButtonProps) {
  const [copied, setCopied] = useState(false);

  const moodLabels: Record<MoodFilter, { emoji: string; label: string; tagline: string }> = {
    all: { emoji: '✨', label: 'All Markets', tagline: 'Check out these prediction markets' },
    hot: { emoji: '🔥', label: 'Hot Markets', tagline: "Markets that are on fire right now" },
    easy: { emoji: '💰', label: 'Easy Money', tagline: 'High probability markets to bet on' },
    soon: { emoji: '⏰', label: 'Resolving Soon', tagline: 'Markets resolving this week' },
    risky: { emoji: '🎲', label: 'Risky Bets', tagline: 'Coin flip markets for the bold' },
    'ai-edge': { emoji: '🧠', label: 'AI Edge', tagline: 'Where AI disagrees with the market' },
    crypto: { emoji: '₿', label: 'Crypto', tagline: 'Crypto prediction markets' },
    politics: { emoji: '🏛', label: 'Politics', tagline: 'Political prediction markets' },
  };

  const { emoji, label, tagline } = moodLabels[mood];

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?filter=${mood}`;
    const shareText = `${emoji} ${tagline}\n\n${count} markets available on BeRight`;

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `BeRight - ${label}`,
          text: shareText,
          url: shareUrl,
        });
        onShare?.();
        return;
      } catch (e) {
        // User cancelled or share failed
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.();
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  if (mood === 'all') return null;

  return (
    <button className="share-filter-btn" onClick={handleShare}>
      <span className="share-icon">{copied ? '✓' : '↗'}</span>
      <span className="share-text">{copied ? 'Copied!' : 'Share'}</span>

      <style jsx>{`
        .share-filter-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
          color: #A78BFA;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .share-filter-btn:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.5);
        }

        .share-filter-btn:active {
          transform: scale(0.96);
        }

        .share-icon {
          font-size: 14px;
        }

        .share-text {
          letter-spacing: 0.3px;
        }
      `}</style>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// STREAK CELEBRATION
// ═══════════════════════════════════════════════════════════

interface StreakCelebrationProps {
  streak: number;
  isNew?: boolean;
  onDismiss?: () => void;
}

export function StreakCelebration({ streak, isNew = false, onDismiss }: StreakCelebrationProps) {
  const [spring] = useSpring(() => ({
    from: { opacity: 0, scale: 0.8, y: 20 },
    to: { opacity: 1, scale: 1, y: 0 },
    config: { tension: 300, friction: 20 },
  }));

  useEffect(() => {
    if (isNew && onDismiss) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew, onDismiss]);

  if (!isNew) return null;

  const milestones: Record<number, { emoji: string; message: string }> = {
    3: { emoji: '🔥', message: "You're on fire!" },
    5: { emoji: '⚡', message: 'Unstoppable!' },
    7: { emoji: '🌟', message: 'Weekly warrior!' },
    10: { emoji: '💎', message: 'Diamond hands!' },
    14: { emoji: '🏆', message: 'Two week streak!' },
    30: { emoji: '👑', message: 'Monthly master!' },
  };

  const milestone = milestones[streak] || { emoji: '🔥', message: `${streak} day streak!` };

  return (
    <animated.div className="streak-celebration" style={spring} onClick={onDismiss}>
      <div className="streak-glow" />
      <span className="streak-emoji">{milestone.emoji}</span>
      <div className="streak-content">
        <span className="streak-number">{streak}</span>
        <span className="streak-label">Day Streak</span>
      </div>
      <span className="streak-message">{milestone.message}</span>

      <style jsx>{`
        .streak-celebration {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 48px;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 193, 7, 0.2) 100%);
          border: 2px solid rgba(255, 107, 53, 0.5);
          border-radius: 24px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 1000;
          cursor: pointer;
        }

        .streak-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(255, 107, 53, 0.3) 0%, transparent 70%);
          pointer-events: none;
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .streak-emoji {
          font-size: 56px;
          margin-bottom: 12px;
          animation: bounce 0.5s ease infinite alternate;
        }

        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }

        .streak-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 8px;
        }

        .streak-number {
          font-size: 48px;
          font-weight: 900;
          background: linear-gradient(135deg, #FF6B35, #FFC107);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1;
        }

        .streak-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .streak-message {
          font-size: 16px;
          font-weight: 600;
          color: #FFC107;
        }
      `}</style>
    </animated.div>
  );
}

// ═══════════════════════════════════════════════════════════
// ACHIEVEMENT TOAST
// ═══════════════════════════════════════════════════════════

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xp: number;
}

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const [spring] = useSpring(() => ({
    from: { opacity: 0, y: 50, scale: 0.9 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: { tension: 300, friction: 20 },
  }));

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <animated.div className="achievement-toast" style={spring} onClick={onDismiss}>
      <div className="achievement-icon">
        <span className="achievement-emoji">{achievement.emoji}</span>
        <div className="achievement-ring" />
      </div>
      <div className="achievement-content">
        <span className="achievement-label">Achievement Unlocked!</span>
        <span className="achievement-title">{achievement.title}</span>
        <span className="achievement-desc">{achievement.description}</span>
      </div>
      <div className="achievement-xp">+{achievement.xp} XP</div>

      <style jsx>{`
        .achievement-toast {
          position: fixed;
          bottom: calc(100px + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
          border: 1px solid rgba(0, 230, 118, 0.3);
          border-radius: 16px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 1000;
          cursor: pointer;
          max-width: calc(100% - 32px);
        }

        .achievement-icon {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .achievement-emoji {
          font-size: 24px;
          z-index: 1;
        }

        .achievement-ring {
          position: absolute;
          inset: 0;
          border: 2px solid rgba(0, 230, 118, 0.5);
          border-radius: 50%;
          animation: ring-pulse 1s ease-out infinite;
        }

        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        .achievement-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .achievement-label {
          font-size: 10px;
          font-weight: 600;
          color: #00E676;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .achievement-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .achievement-desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .achievement-xp {
          font-size: 14px;
          font-weight: 700;
          color: #00E676;
          padding: 6px 10px;
          background: rgba(0, 230, 118, 0.15);
          border-radius: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </animated.div>
  );
}

// ═══════════════════════════════════════════════════════════
// VIRAL ACTION BAR (Appears after prediction)
// ═══════════════════════════════════════════════════════════

interface ViralActionBarProps {
  question: string;
  userPick: 'yes' | 'no';
  marketOdds: number;
  onShare?: () => void;
  onChallengeFriend?: () => void;
}

export function ViralActionBar({
  question,
  userPick,
  marketOdds,
  onShare,
  onChallengeFriend
}: ViralActionBarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const pickEmoji = userPick === 'yes' ? '✅' : '❌';
    const shareText = `${pickEmoji} I said ${userPick.toUpperCase()} to:\n\n"${question}"\n\nMarket says ${marketOdds}% YES. What do you think?`;
    const shareUrl = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Prediction on BeRight',
          text: shareText,
          url: shareUrl,
        });
        onShare?.();
        return;
      } catch (e) {
        // Cancelled
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.();
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="viral-action-bar">
      <button className="viral-btn share" onClick={handleShare}>
        <span className="btn-icon">{copied ? '✓' : '↗'}</span>
        <span className="btn-label">{copied ? 'Copied!' : 'Share Take'}</span>
      </button>

      <button className="viral-btn challenge" onClick={onChallengeFriend}>
        <span className="btn-icon">⚔️</span>
        <span className="btn-label">Challenge Friend</span>
      </button>

      <style jsx>{`
        .viral-action-bar {
          display: flex;
          gap: 8px;
          padding: 12px 0;
        }

        .viral-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .viral-btn.share {
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #A78BFA;
        }

        .viral-btn.share:hover {
          background: rgba(139, 92, 246, 0.25);
        }

        .viral-btn.challenge {
          background: rgba(255, 107, 53, 0.15);
          border: 1px solid rgba(255, 107, 53, 0.3);
          color: #FF6B35;
        }

        .viral-btn.challenge:hover {
          background: rgba(255, 107, 53, 0.25);
        }

        .viral-btn:active {
          transform: scale(0.98);
        }

        .btn-icon {
          font-size: 16px;
        }

        .btn-label {
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════

// Hook to manage challenges
export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>(defaultChallenges);

  const updateProgress = useCallback((challengeId: string, increment: number = 1) => {
    setChallenges(prev => prev.map(c => {
      if (c.id === challengeId) {
        return { ...c, current: Math.min(c.current + increment, c.target) };
      }
      return c;
    }));
  }, []);

  const checkChallengeCompletion = useCallback((prediction: {
    marketOdds: number;
    aiPrediction?: number;
    direction: 'yes' | 'no';
  }) => {
    // Check each challenge type
    const completedIds: string[] = [];

    // Quick Caller - any prediction
    updateProgress('predict-5');

    // Easy Money - high probability markets
    if (prediction.marketOdds >= 75 || prediction.marketOdds <= 25) {
      updateProgress('easy-money');
    }

    // AI Whisperer - agree with AI
    if (prediction.aiPrediction) {
      const aiSaysYes = prediction.aiPrediction > 50;
      const userSaysYes = prediction.direction === 'yes';
      if (aiSaysYes === userSaysYes) {
        updateProgress('ai-agree');
      }
    }

    // Contrarian - disagree with market
    const marketSaysYes = prediction.marketOdds > 50;
    const userSaysYes = prediction.direction === 'yes';
    if (marketSaysYes !== userSaysYes) {
      updateProgress('contrarian');
    }

    return completedIds;
  }, [updateProgress]);

  return { challenges, updateProgress, checkChallengeCompletion };
}
