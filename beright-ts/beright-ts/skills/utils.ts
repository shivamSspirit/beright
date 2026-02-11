/**
 * Utility functions for BeRight Protocol
 */

import { SYNONYM_GROUPS } from '../config/synonyms';

/**
 * Format USD amount
 */
export function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

/**
 * Format percentage
 */
export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Calculate similarity between two strings using hybrid approach:
 * - 40% sequence similarity (longest common substring)
 * - 60% Jaccard similarity (token overlap)
 */
export function calculateSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();

  // Sequence similarity (LCS-based)
  const lcs = longestCommonSubstring(aNorm, bNorm);
  const seqSim = lcs / Math.max(aNorm.length, bNorm.length);

  // Jaccard similarity (token-based)
  const aTokens = new Set(aNorm.split(/\s+/));
  const bTokens = new Set(bNorm.split(/\s+/));
  const intersection = new Set([...aTokens].filter(x => bTokens.has(x)));
  const union = new Set([...aTokens, ...bTokens]);
  const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;

  // Weighted combination
  return 0.4 * seqSim + 0.6 * jaccardSim;
}

function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let maxLen = 0;
  const dp: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        maxLen = Math.max(maxLen, dp[i][j]);
      }
    }
  }
  return maxLen;
}

/**
 * Expand query with synonyms
 */
export function expandWithSynonyms(query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/);
  const expanded = new Set([query.toLowerCase()]);

  for (const term of terms) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(term)) {
        for (const synonym of group) {
          expanded.add(query.toLowerCase().replace(term, synonym));
        }
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Returns 'Hello World'
 */
export function helloWorld(): string {
  return 'Hello World';
}
