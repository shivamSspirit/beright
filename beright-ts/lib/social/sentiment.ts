/**
 * Social Listener - Sentiment Analysis
 *
 * Simple rule-based sentiment analysis for prediction market mentions.
 * No external API needed - fast local execution.
 *
 * Returns: -1 (bearish) to +1 (bullish)
 */

import { SentimentLabel, DEFAULT_SOCIAL_CONFIG } from './types';

// Bullish keywords (prediction markets context)
const BULLISH_WORDS = new Set([
  'bullish', 'long', 'buy', 'buying', 'moon', 'pump', 'rally', 'surge',
  'breakout', 'upside', 'gains', 'profit', 'winner', 'winning', 'yes',
  'likely', 'probable', 'confident', 'certain', 'definitely', 'guaranteed',
  'undervalued', 'opportunity', 'cheap', 'steal', 'alpha', 'edge',
  'strong', 'momentum', 'trending', 'hot', 'fire', '🚀', '📈', '💰', '🔥',
  'will happen', 'going to', 'inevitable', 'obvious', 'easy money',
]);

// Bearish keywords
const BEARISH_WORDS = new Set([
  'bearish', 'short', 'sell', 'selling', 'dump', 'crash', 'drop', 'fall',
  'downside', 'losses', 'loser', 'losing', 'no', 'unlikely', 'improbable',
  'doubtful', 'uncertain', 'risky', 'overvalued', 'expensive', 'trap',
  'weak', 'fading', 'dying', '📉', '💀', '🔻',
  'won\'t happen', 'not going to', 'impossible', 'no chance', 'waste',
  'scam', 'fake', 'manipulation', 'manipulated',
]);

// Intensifiers multiply sentiment
const INTENSIFIERS: Record<string, number> = {
  'very': 1.5,
  'extremely': 2.0,
  'incredibly': 2.0,
  'absolutely': 2.0,
  'definitely': 1.5,
  'certainly': 1.5,
  'probably': 0.8,
  'maybe': 0.5,
  'might': 0.5,
  'could': 0.6,
  'possibly': 0.5,
  'slightly': 0.5,
  'somewhat': 0.7,
};

// Negations flip sentiment
const NEGATIONS = new Set([
  'not', 'no', 'never', 'neither', 'nobody', 'nothing', 'nowhere',
  'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'wouldn\'t', 'can\'t',
  'couldn\'t', 'shouldn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t',
]);

/**
 * Analyze sentiment of text
 *
 * @param text - The text to analyze
 * @returns Sentiment score from -1 (bearish) to +1 (bullish)
 */
export function analyzeSentiment(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  let multiplier = 1;
  let negated = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z0-9]/g, '');
    const fullWord = words[i]; // Keep emojis

    // Check for negations (affect next few words)
    if (NEGATIONS.has(word)) {
      negated = true;
      continue;
    }

    // Check for intensifiers
    if (INTENSIFIERS[word]) {
      multiplier = INTENSIFIERS[word];
      continue;
    }

    // Check for sentiment words
    let wordScore = 0;
    if (BULLISH_WORDS.has(word) || BULLISH_WORDS.has(fullWord)) {
      wordScore = 0.3;
    } else if (BEARISH_WORDS.has(word) || BEARISH_WORDS.has(fullWord)) {
      wordScore = -0.3;
    }

    if (wordScore !== 0) {
      // Apply negation
      if (negated) {
        wordScore = -wordScore;
        negated = false; // Reset after use
      }

      // Apply intensifier
      wordScore *= multiplier;
      multiplier = 1; // Reset after use

      score += wordScore;
    }

    // Reset negation after 3 words
    if (i > 0 && NEGATIONS.has(words[i - 3]?.replace(/[^a-z]/g, '') || '')) {
      negated = false;
    }
  }

  // Normalize to -1 to +1 range
  return Math.max(-1, Math.min(1, score));
}

/**
 * Get sentiment label from score
 */
export function getSentimentLabel(score: number): SentimentLabel {
  const config = DEFAULT_SOCIAL_CONFIG;

  if (score > config.bullishThreshold) return 'bullish';
  if (score < config.bearishThreshold) return 'bearish';
  return 'neutral';
}

/**
 * Analyze sentiment with label
 */
export function analyzeSentimentWithLabel(text: string): {
  score: number;
  label: SentimentLabel;
} {
  const score = analyzeSentiment(text);
  const label = getSentimentLabel(score);
  return { score, label };
}

/**
 * Aggregate sentiment from multiple texts
 */
export function aggregateSentiment(texts: string[]): {
  avgScore: number;
  label: SentimentLabel;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
} {
  if (texts.length === 0) {
    return {
      avgScore: 0,
      label: 'neutral',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
    };
  }

  let totalScore = 0;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const text of texts) {
    const { score, label } = analyzeSentimentWithLabel(text);
    totalScore += score;

    if (label === 'bullish') bullishCount++;
    else if (label === 'bearish') bearishCount++;
    else neutralCount++;
  }

  const avgScore = totalScore / texts.length;
  const label = getSentimentLabel(avgScore);

  return { avgScore, label, bullishCount, bearishCount, neutralCount };
}

/**
 * Check if text is likely spam
 */
export function isLikelySpam(text: string): boolean {
  const lower = text.toLowerCase();

  // Too many caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 20) return true;

  // Too many emojis
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 10) return true;

  // Spam patterns
  const spamPatterns = [
    /free money/i,
    /guaranteed profit/i,
    /dm me/i,
    /follow me/i,
    /click here/i,
    /bit\.ly/i,
    /t\.co/i,
    /giveaway/i,
    /airdrop/i,
    /limited time/i,
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(text)) return true;
  }

  return false;
}
