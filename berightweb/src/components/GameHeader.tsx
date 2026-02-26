'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/context/UserContext';

interface GameStats {
  streak: number;
  xp: number;
  rank: number;
  totalPredictions: number;
  winRate: number;
  level: number;
}

// Generate fun username from wallet address
function generateUsername(address: string): string {
  const adjectives = [
    'Swift', 'Sharp', 'Wise', 'Bold', 'Cosmic', 'Stellar', 'Mystic', 'Noble',
    'Lucky', 'Golden', 'Crystal', 'Shadow', 'Iron', 'Silver', 'Thunder', 'Storm'
  ];
  const nouns = [
    'Fox', 'Owl', 'Wolf', 'Eagle', 'Dragon', 'Phoenix', 'Falcon', 'Tiger',
    'Shark', 'Hawk', 'Raven', 'Lion', 'Bear', 'Viper', 'Panther', 'Cobra'
  ];

  const hash = address.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const adjective = adjectives[hash % adjectives.length];
  const noun = nouns[(hash * 13) % nouns.length];
  const num = (hash % 9999).toString().padStart(4, '0');

  return `${adjective}${noun}#${num}`;
}

// Level thresholds
const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];

function getLevelProgress(xp: number): { level: number; progress: number; nextThreshold: number } {
  let level = 1;
  for (let i = levelThresholds.length - 1; i >= 0; i--) {
    if (xp >= levelThresholds[i]) {
      level = i + 1;
      break;
    }
  }

  const currentThreshold = levelThresholds[level - 1] || 0;
  const nextThreshold = levelThresholds[level] || currentThreshold + 1000;
  const progress = (xp - currentThreshold) / (nextThreshold - currentThreshold);

  return { level, progress: Math.min(progress, 1), nextThreshold };
}

export default function GameHeader() {
  const { user, isAuthenticated, walletAddress } = useUser();
  const [stats, setStats] = useState<GameStats>({
    streak: 0,
    xp: 0,
    rank: 0,
    totalPredictions: 0,
    winRate: 0,
    level: 1,
  });
  const [showTooltip, setShowTooltip] = useState<'streak' | 'xp' | 'rank' | null>(null);

  // Generate username from wallet address
  const username = useMemo(() => {
    if (walletAddress) {
      return generateUsername(walletAddress);
    }
    return 'Anonymous';
  }, [walletAddress]);

  // Mock stats - in production, fetch from API
  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      // Generate consistent stats based on wallet address
      const hash = walletAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const mockStats: GameStats = {
        streak: (hash % 15),
        xp: (hash * 7) % 2500,
        rank: 100 + (hash % 500),
        totalPredictions: (hash % 200),
        winRate: 45 + (hash % 30),
        level: Math.floor(((hash * 7) % 2500) / 300) + 1,
      };
      setStats(mockStats);
    }
  }, [isAuthenticated, walletAddress]);

  const { level, progress, nextThreshold } = getLevelProgress(stats.xp);

  if (!isAuthenticated) return null;

  return (
    <header className="game-header">
      <div className="header-inner">
        {/* Username & Level */}
        <div className="user-section">
          <div className="avatar">
            <span className="avatar-emoji">🎯</span>
            <span className="level-badge">{level}</span>
          </div>
          <div className="user-info">
            <span className="username">{username}</span>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-section">
          {/* Streak */}
          <button
            className="stat-badge streak-badge"
            onMouseEnter={() => setShowTooltip('streak')}
            onMouseLeave={() => setShowTooltip(null)}
            onTouchStart={() => setShowTooltip('streak')}
            onTouchEnd={() => setShowTooltip(null)}
          >
            <span className="stat-icon">🔥</span>
            <span className="stat-value">{stats.streak}</span>
            {showTooltip === 'streak' && (
              <div className="tooltip">
                <span className="tooltip-title">{stats.streak} Day Streak!</span>
                <span className="tooltip-desc">Keep predicting daily</span>
              </div>
            )}
          </button>

          {/* XP */}
          <button
            className="stat-badge xp-badge"
            onMouseEnter={() => setShowTooltip('xp')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="stat-icon">⚡</span>
            <span className="stat-value">{stats.xp.toLocaleString()}</span>
            {showTooltip === 'xp' && (
              <div className="tooltip">
                <span className="tooltip-title">{stats.xp} XP</span>
                <span className="tooltip-desc">{nextThreshold - stats.xp} to level {level + 1}</span>
              </div>
            )}
          </button>

          {/* Rank */}
          <button
            className="stat-badge rank-badge"
            onMouseEnter={() => setShowTooltip('rank')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="stat-icon">🏆</span>
            <span className="stat-value">#{stats.rank}</span>
            {showTooltip === 'rank' && (
              <div className="tooltip">
                <span className="tooltip-title">Rank #{stats.rank}</span>
                <span className="tooltip-desc">{stats.winRate}% win rate</span>
              </div>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .game-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          padding: 10px 16px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          background: linear-gradient(180deg, rgba(3, 3, 5, 0.98) 0%, rgba(3, 3, 5, 0.9) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 500px;
          margin: 0 auto;
        }

        /* User Section */
        .user-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          position: relative;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(139, 92, 246, 0.15));
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-emoji {
          font-size: 18px;
        }

        .level-badge {
          position: absolute;
          bottom: -4px;
          right: -4px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          background: linear-gradient(135deg, #10B981, #10B981);
          border-radius: 8px;
          font-size: 9px;
          font-weight: 800;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .username {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .xp-bar {
          width: 60px;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .xp-fill {
          height: 100%;
          background: linear-gradient(90deg, #10B981, #10B981);
          border-radius: 2px;
          transition: width 0.5s ease-out;
        }

        /* Stats Section */
        .stats-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-badge {
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .stat-badge:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .stat-icon {
          font-size: 12px;
        }

        .stat-value {
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .streak-badge {
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(255, 59, 48, 0.12));
          border-color: rgba(255, 107, 53, 0.25);
        }

        .streak-badge .stat-value {
          color: #FF6B35;
        }

        .xp-badge {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 193, 7, 0.12));
          border-color: rgba(255, 215, 0, 0.25);
        }

        .xp-badge .stat-value {
          color: #FFD700;
        }

        .rank-badge {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(167, 139, 250, 0.12));
          border-color: rgba(139, 92, 246, 0.25);
        }

        .rank-badge .stat-value {
          color: #A78BFA;
        }

        /* Tooltip */
        .tooltip {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 14px;
          background: rgba(20, 20, 30, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          white-space: nowrap;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: tooltipIn 0.2s ease-out;
        }

        .tooltip::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid rgba(255, 255, 255, 0.1);
        }

        @keyframes tooltipIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .tooltip-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .tooltip-desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Responsive */
        @media (max-width: 380px) {
          .user-info {
            display: none;
          }

          .stat-badge {
            padding: 5px 8px;
          }

          .stat-value {
            font-size: 11px;
          }

          .stat-icon {
            font-size: 11px;
          }
        }

        @media (max-width: 340px) {
          .xp-badge {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
