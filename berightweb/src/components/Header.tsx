'use client';

import { useState, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/web';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';

interface HeaderProps {
  streak?: number;
  completedToday?: number;
  totalToday?: number;
  showDailyChallenge?: boolean;
}

// Streak Badge with flame animation
function StreakBadge({ streak }: { streak: number }) {
  const [spring] = useSpring(() => ({
    from: { scale: 0.8, opacity: 0 },
    to: { scale: 1, opacity: 1 },
    config: { tension: 300, friction: 20 },
  }));

  if (streak === 0) return null;

  return (
    <animated.div className="streak-badge" style={spring}>
      <span className="text-lg animate-flame">🔥</span>
      <span className="font-mono text-sm">{streak}</span>
    </animated.div>
  );
}

// Progress Dots for daily challenge
function ProgressDots({ completed, total }: { completed: number; total: number }) {
  const dots = Array.from({ length: Math.min(total, 7) }, (_, i) => i);

  return (
    <div className="progress-dots">
      {dots.map((i) => (
        <div
          key={i}
          className={`progress-dot ${
            i < completed ? 'filled' : i === completed ? 'current' : ''
          }`}
        />
      ))}
    </div>
  );
}

// Countdown Timer
function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const reset = new Date();
      reset.setHours(24, 0, 0, 0);

      const diff = reset.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}h ${minutes}m`;
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
      Resets in {timeLeft}
    </span>
  );
}

// Auth Button Component
function AuthButton() {
  const { user, isAuthenticated, isLoading, login, logout, walletAddress } = useUser();

  if (isLoading) {
    return (
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center animate-pulse"
        style={{ background: 'var(--glass-bg)' }}
      >
        <div className="w-4 h-4 rounded-full bg-gray-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={login}
        className="px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)',
          color: '#000',
        }}
      >
        Connect
      </button>
    );
  }

  // Authenticated - show avatar with wallet address
  const displayName = user?.username ||
    (walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'User');

  return (
    <div className="flex items-center gap-2">
      {/* Wallet indicator */}
      {walletAddress && (
        <div
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{ background: 'rgba(0, 230, 118, 0.15)', color: '#00E676' }}
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-mono">{walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}</span>
        </div>
      )}

      {/* Profile Avatar - Links to profile */}
      <Link href="/profile">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          style={{
            background: user?.avatar
              ? `url(${user.avatar})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            border: '2px solid var(--glass-border)',
          }}
        >
          {!user?.avatar && (
            <span className="text-sm font-bold">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

export default function Header({
  streak = 0,
  completedToday = 0,
  totalToday = 7,
  showDailyChallenge = true,
}: HeaderProps) {
  const { user } = useUser();
  const userStreak = user?.streak || streak;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 safe-top">
      {/* Blur background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      />

      {/* Header content */}
      <div className="relative max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left - Streak Badge */}
          <StreakBadge streak={userStreak} />

          {/* Center - Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--yes) 0%, var(--accent) 100%)',
                color: '#000',
              }}
            >
              B
            </div>
            <span className="font-bold text-lg">BeRight</span>
          </Link>

          {/* Right - Auth & Notifications */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              className="relative p-2 rounded-full hover:bg-white/5 transition-colors"
              style={{ background: 'var(--glass-bg)' }}
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {/* Red dot indicator */}
              <div
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'var(--no)' }}
              />
            </button>

            {/* Auth Button */}
            <AuthButton />
          </div>
        </div>

        {/* Daily Challenge Banner - Compact */}
        {showDailyChallenge && totalToday > 0 && (
          <div
            className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 107, 53, 0.1) 100%)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎯</span>
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                  Daily Challenge
                </div>
                <ProgressDots completed={completedToday} total={totalToday} />
              </div>
            </div>
            <CountdownTimer />
          </div>
        )}
      </div>

      {/* Header Styles */}
      <style jsx>{`
        .streak-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(255, 107, 53, 0.15);
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: 20px;
        }

        .animate-flame {
          animation: flame 0.5s ease-in-out infinite alternate;
        }

        @keyframes flame {
          from { transform: scale(1) rotate(-3deg); }
          to { transform: scale(1.1) rotate(3deg); }
        }

        .progress-dots {
          display: flex;
          gap: 4px;
          margin-top: 4px;
        }

        .progress-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s;
        }

        .progress-dot.filled {
          background: var(--gold, #FFD700);
        }

        .progress-dot.current {
          background: var(--gold, #FFD700);
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </header>
  );
}
