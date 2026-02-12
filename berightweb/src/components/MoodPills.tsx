'use client';

import { useState, useRef, useEffect } from 'react';
import { animated, useSpring, useSprings } from '@react-spring/web';

export type MoodFilter =
  | 'all'
  | 'hot'
  | 'easy'
  | 'soon'
  | 'risky'
  | 'ai-edge'
  | 'crypto'
  | 'politics';

interface MoodPill {
  id: MoodFilter;
  emoji: string;
  label: string;
  description: string;
}

const moods: MoodPill[] = [
  { id: 'all', emoji: '✨', label: 'All', description: 'All markets' },
  { id: 'hot', emoji: '🔥', label: 'Hot', description: 'High volume, trending' },
  { id: 'easy', emoji: '💰', label: 'Easy', description: '75%+ odds' },
  { id: 'soon', emoji: '⏰', label: 'Soon', description: 'Resolves <7 days' },
  { id: 'risky', emoji: '🎲', label: 'Risky', description: '40-60% odds' },
  { id: 'ai-edge', emoji: '🧠', label: 'AI Edge', description: 'AI disagrees' },
  { id: 'crypto', emoji: '₿', label: 'Crypto', description: 'Crypto markets' },
  { id: 'politics', emoji: '🏛', label: 'Politics', description: 'Political markets' },
];

interface MoodPillsProps {
  selected: MoodFilter;
  onSelect: (mood: MoodFilter) => void;
  counts?: Partial<Record<MoodFilter, number>>;
}

export default function MoodPills({ selected, onSelect, counts }: MoodPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Handle scroll to show/hide fades
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    handleScroll();
  }, []);

  // Pill animations
  const springs = useSprings(
    moods.length,
    moods.map((mood, i) => ({
      scale: selected === mood.id ? 1 : 1,
      background: selected === mood.id
        ? 'rgba(0, 230, 118, 1)'
        : 'rgba(255, 255, 255, 0.06)',
      borderColor: selected === mood.id
        ? 'rgba(0, 230, 118, 1)'
        : 'rgba(255, 255, 255, 0.1)',
      config: { tension: 400, friction: 26 },
    }))
  );

  return (
    <div className="mood-pills-container">
      {/* Left fade */}
      <div className={`mood-fade mood-fade-left ${showLeftFade ? 'visible' : ''}`} />

      {/* Scrollable pills */}
      <div
        ref={scrollRef}
        className="mood-pills-scroll"
        onScroll={handleScroll}
      >
        {moods.map((mood, index) => {
          const count = counts?.[mood.id];
          const isSelected = selected === mood.id;

          return (
            <button
              key={mood.id}
              className={`mood-pill ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(mood.id)}
              title={mood.description}
            >
              <span className="mood-emoji">{mood.emoji}</span>
              <span className="mood-label">{mood.label}</span>
              {count !== undefined && count > 0 && (
                <span className="mood-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right fade */}
      <div className={`mood-fade mood-fade-right ${showRightFade ? 'visible' : ''}`} />

      <style jsx>{`
        .mood-pills-container {
          position: relative;
          width: 100%;
          margin-bottom: 12px;
        }

        .mood-pills-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 4px 8px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mood-pills-scroll::-webkit-scrollbar {
          display: none;
        }

        .mood-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .mood-pill:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .mood-pill:active {
          transform: scale(0.96);
        }

        .mood-pill.selected {
          background: #00E676;
          border-color: #00E676;
          color: #000;
        }

        .mood-pill.selected:hover {
          background: #00C853;
          border-color: #00C853;
        }

        .mood-emoji {
          font-size: 14px;
          line-height: 1;
        }

        .mood-label {
          font-size: 12px;
          letter-spacing: 0.2px;
        }

        .mood-count {
          padding: 2px 6px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
        }

        .mood-pill.selected .mood-count {
          background: rgba(0, 0, 0, 0.15);
        }

        /* Fade indicators */
        .mood-fade {
          position: absolute;
          top: 0;
          bottom: 8px;
          width: 24px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 2;
        }

        .mood-fade.visible {
          opacity: 1;
        }

        .mood-fade-left {
          left: 0;
          background: linear-gradient(90deg, rgba(10, 10, 15, 1) 0%, transparent 100%);
        }

        .mood-fade-right {
          right: 0;
          background: linear-gradient(-90deg, rgba(10, 10, 15, 1) 0%, transparent 100%);
        }

        /* ─── RESPONSIVE ─── */

        /* Very small phones (< 360px) */
        @media (max-width: 359px) {
          .mood-pills-container {
            margin-bottom: 8px;
          }

          .mood-pills-scroll {
            gap: 6px;
            padding: 2px 2px 6px;
          }

          .mood-pill {
            padding: 5px 8px;
            gap: 3px;
            border-radius: 16px;
          }

          .mood-emoji {
            font-size: 11px;
          }

          .mood-label {
            font-size: 10px;
          }

          .mood-count {
            padding: 1px 4px;
            font-size: 9px;
          }

          .mood-fade {
            width: 16px;
          }
        }

        /* Small phones (360-400px) */
        @media (min-width: 360px) and (max-width: 399px) {
          .mood-pills-scroll {
            gap: 6px;
          }

          .mood-pill {
            padding: 6px 10px;
            gap: 4px;
          }

          .mood-emoji {
            font-size: 12px;
          }

          .mood-label {
            font-size: 11px;
          }
        }

        /* Tablets (640px+) */
        @media (min-width: 640px) {
          .mood-pills-container {
            margin-bottom: 14px;
          }

          .mood-pills-scroll {
            gap: 10px;
            padding: 4px 4px 10px;
            justify-content: center;
          }

          .mood-pill {
            padding: 10px 16px;
            gap: 6px;
            border-radius: 24px;
            font-size: 14px;
          }

          .mood-emoji {
            font-size: 16px;
          }

          .mood-label {
            font-size: 13px;
          }

          .mood-count {
            padding: 2px 8px;
            font-size: 11px;
          }

          .mood-fade {
            width: 32px;
          }
        }

        /* Tablets portrait (768px+) */
        @media (min-width: 768px) {
          .mood-pills-scroll {
            gap: 12px;
          }

          .mood-pill {
            padding: 12px 18px;
          }

          .mood-label {
            font-size: 14px;
          }

          .mood-count {
            font-size: 12px;
          }
        }

        /* Desktop (768px+) - Compact minimal pills */
        @media (min-width: 768px) {
          .mood-pills-container {
            display: flex;
            justify-content: center;
            margin-bottom: 12px;
          }

          .mood-pills-scroll {
            display: inline-flex;
            gap: 5px;
            padding: 0;
            background: transparent;
            overflow-x: visible;
            scrollbar-width: none;
          }

          .mood-fade {
            display: none;
          }

          .mood-pill {
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            color: rgba(255, 255, 255, 0.5);
            transition: all 0.15s ease;
            gap: 4px;
          }

          .mood-pill:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.8);
          }

          .mood-pill.selected {
            background: #00E676;
            border-color: #00E676;
            color: #000;
          }

          .mood-pill.selected:hover {
            background: #00C853;
            border-color: #00C853;
          }

          .mood-emoji {
            font-size: 11px;
          }

          .mood-label {
            font-size: 11px;
            font-weight: 600;
          }

          .mood-count {
            padding: 1px 5px;
            background: rgba(0, 0, 0, 0.12);
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
          }

          .mood-pill.selected .mood-count {
            background: rgba(0, 0, 0, 0.15);
            color: #000;
          }
        }

        /* Landscape - compact */
        @media (max-height: 500px) and (orientation: landscape) {
          .mood-pills-container {
            margin-bottom: 4px;
          }

          .mood-pills-scroll {
            gap: 4px;
            padding: 2px 2px 4px;
          }

          .mood-pill {
            padding: 4px 8px;
            gap: 3px;
          }

          .mood-emoji {
            font-size: 10px;
          }

          .mood-label {
            font-size: 9px;
          }

          .mood-count {
            padding: 1px 4px;
            font-size: 8px;
          }
        }
      `}</style>
    </div>
  );
}

// Filter function to apply mood filters to predictions
export function filterByMood<T extends {
  marketOdds: number;
  volume: string;
  resolvesAt: string;
  category: string;
  aiPrediction?: number;
}>(predictions: T[], mood: MoodFilter): T[] {
  if (mood === 'all') return predictions;

  return predictions.filter(p => {
    switch (mood) {
      case 'hot': {
        // High volume markets
        const vol = parseVolume(p.volume);
        return vol > 500000;
      }
      case 'easy': {
        // 75%+ odds (either direction)
        return p.marketOdds >= 75 || p.marketOdds <= 25;
      }
      case 'soon': {
        // Resolves within 7 days
        const days = getDaysUntil(p.resolvesAt);
        return days !== null && days <= 7 && days >= 0;
      }
      case 'risky': {
        // 40-60% odds (coin flip territory)
        return p.marketOdds >= 40 && p.marketOdds <= 60;
      }
      case 'ai-edge': {
        // AI disagrees with market by 10%+
        if (!p.aiPrediction) return false;
        const diff = Math.abs(p.marketOdds - p.aiPrediction);
        return diff >= 10;
      }
      case 'crypto': {
        return p.category === 'crypto';
      }
      case 'politics': {
        return p.category === 'politics';
      }
      default:
        return true;
    }
  });
}

// Get counts for each mood filter
export function getMoodCounts<T extends {
  marketOdds: number;
  volume: string;
  resolvesAt: string;
  category: string;
  aiPrediction?: number;
}>(predictions: T[]): Partial<Record<MoodFilter, number>> {
  const counts: Partial<Record<MoodFilter, number>> = {
    all: predictions.length,
  };

  const moodKeys: MoodFilter[] = ['hot', 'easy', 'soon', 'risky', 'ai-edge', 'crypto', 'politics'];

  for (const mood of moodKeys) {
    counts[mood] = filterByMood(predictions, mood).length;
  }

  return counts;
}

// Helper: Parse volume string to number
function parseVolume(vol: string): number {
  const match = vol.match(/[\d.]+/);
  if (!match) return 0;
  const n = parseFloat(match[0]);
  if (vol.toLowerCase().includes('m')) return n * 1e6;
  if (vol.toLowerCase().includes('k')) return n * 1e3;
  return n;
}

// Helper: Get days until resolution
function getDaysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr === 'TBD') return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
