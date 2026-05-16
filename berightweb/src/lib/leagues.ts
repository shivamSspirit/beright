/**
 * BeRight League System
 *
 * Centralized league tier calculation used across all pages:
 * - Leaderboard (ranking display)
 * - Profile (user stats)
 * - Home (streak badges)
 */

export type LeagueName = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface LeagueInfo {
  name: LeagueName;
  minXp: number;
  maxXp: number | null;
  color: string;
  colorDim: string;
  icon: string;
  level: number;
}

// League thresholds in ascending order
export const LEAGUES: LeagueInfo[] = [
  {
    name: 'BRONZE',
    minXp: 0,
    maxXp: 499,
    color: '#CD7F32',
    colorDim: 'rgba(205, 127, 50, 0.15)',
    icon: '🥉',
    level: 1,
  },
  {
    name: 'SILVER',
    minXp: 500,
    maxXp: 999,
    color: '#C0C0C0',
    colorDim: 'rgba(192, 192, 192, 0.15)',
    icon: '🥈',
    level: 2,
  },
  {
    name: 'GOLD',
    minXp: 1000,
    maxXp: 2499,
    color: '#FFD700',
    colorDim: 'rgba(255, 215, 0, 0.15)',
    icon: '🥇',
    level: 3,
  },
  {
    name: 'PLATINUM',
    minXp: 2500,
    maxXp: 4999,
    color: '#E5E4E2',
    colorDim: 'rgba(229, 228, 226, 0.15)',
    icon: '💎',
    level: 4,
  },
  {
    name: 'DIAMOND',
    minXp: 5000,
    maxXp: null,
    color: '#B9F2FF',
    colorDim: 'rgba(185, 242, 255, 0.15)',
    icon: '💠',
    level: 5,
  },
];

/**
 * Compute league from XP value
 * @param xp User's total XP
 * @returns League name
 */
export function computeLeague(xp: number): LeagueName {
  // Find the highest league the user qualifies for
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXp) {
      return LEAGUES[i].name;
    }
  }
  return 'BRONZE';
}

/**
 * Get full league info from XP
 * @param xp User's total XP
 * @returns Complete league information
 */
export function getLeagueInfo(xp: number): LeagueInfo {
  const leagueName = computeLeague(xp);
  return LEAGUES.find(l => l.name === leagueName) || LEAGUES[0];
}

/**
 * Get league info by name
 * @param name League name
 * @returns Complete league information
 */
export function getLeagueByName(name: LeagueName): LeagueInfo {
  return LEAGUES.find(l => l.name === name) || LEAGUES[0];
}

/**
 * Compute level from XP (1 level per 1000 XP)
 * @param xp User's total XP
 * @returns User level (1-based)
 */
export function computeLevel(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

/**
 * Get XP progress toward next level
 * @param xp User's total XP
 * @returns Object with current level XP, target XP, and percentage
 */
export function getLevelProgress(xp: number): {
  currentLevelXp: number;
  targetXp: number;
  percentage: number;
} {
  const level = computeLevel(xp);
  const currentLevelStartXp = (level - 1) * 1000;
  const nextLevelXp = level * 1000;
  const currentLevelXp = xp - currentLevelStartXp;
  const targetXp = 1000;
  const percentage = (currentLevelXp / targetXp) * 100;

  return { currentLevelXp, targetXp, percentage };
}

/**
 * Get XP needed for next league
 * @param xp User's total XP
 * @returns XP needed or null if at highest league
 */
export function getXpToNextLeague(xp: number): {
  xpNeeded: number | null;
  nextLeague: LeagueName | null;
} {
  const currentLeague = getLeagueInfo(xp);
  const currentIndex = LEAGUES.findIndex(l => l.name === currentLeague.name);

  if (currentIndex >= LEAGUES.length - 1) {
    return { xpNeeded: null, nextLeague: null };
  }

  const nextLeague = LEAGUES[currentIndex + 1];
  return {
    xpNeeded: nextLeague.minXp - xp,
    nextLeague: nextLeague.name,
  };
}

/**
 * Compute league from accuracy percentage (alternative method)
 * Used when XP isn't available but accuracy is
 * @param accuracy User's accuracy percentage (0-100)
 * @returns League name
 */
export function computeLeagueFromAccuracy(accuracy: number): LeagueName {
  if (accuracy >= 90) return 'DIAMOND';
  if (accuracy >= 80) return 'PLATINUM';
  if (accuracy >= 70) return 'GOLD';
  if (accuracy >= 50) return 'SILVER';
  return 'BRONZE';
}
