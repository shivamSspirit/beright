/**
 * Social Mention Detector
 *
 * Detects significant social media activity for prediction markets.
 * Triggers on:
 *   - Velocity spike (2x+ baseline mentions)
 *   - High engagement posts
 *   - Sentiment shift (bullish → bearish or vice versa)
 *
 * Strength calculation:
 *   - Base: velocity / 3 (3x baseline = 1.0)
 *   - Bonus: +0.2 for high engagement
 *   - Bonus: +0.1 for sentiment alignment with price
 */

import { RawSignal } from './types';
import { getSocialVelocity, getMarketMentions } from '../social';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';

// Thresholds
const VELOCITY_THRESHOLD = 1.5;    // 1.5x baseline triggers signal
const VELOCITY_MAX = 5.0;          // 5x baseline = max strength
const ENGAGEMENT_THRESHOLD = 50;   // Engagement score for bonus
const MIN_MENTIONS = 3;            // Min mentions to consider

/**
 * Detect social mention signals
 */
export async function detectSocialMention(): Promise<RawSignal[]> {
  if (!isSupabaseConfigured) return [];

  const signals: RawSignal[] = [];
  const now = new Date().toISOString();

  try {
    // Get all markets with recent social velocity
    const { data: velocities } = await supabaseAdmin
      .from('social_velocity')
      .select('*')
      .gte('mentions_24h', MIN_MENTIONS)
      .order('velocity_24h', { ascending: false })
      .limit(50);

    if (!velocities || velocities.length === 0) return [];

    for (const v of velocities) {
      // Check velocity threshold
      if (v.velocity_24h < VELOCITY_THRESHOLD) continue;

      // Calculate strength based on velocity
      const velocityRatio = Math.min(v.velocity_24h / VELOCITY_MAX, 1);
      let strength = velocityRatio * 0.7; // Base 70% from velocity

      // Bonus for high engagement
      const avgEngagement = v.top_mentions?.[0]?.engagement || 0;
      if (avgEngagement >= ENGAGEMENT_THRESHOLD) {
        strength += 0.2;
      }

      // Bonus for strong sentiment
      const sentiment = Math.abs(v.avg_sentiment_24h);
      if (sentiment > 0.3) {
        strength += 0.1;
      }

      strength = Math.min(1, strength);

      // Only signal if strength is meaningful
      if (strength < 0.3) continue;

      // Get top mention for context
      const topMention = v.top_mentions?.[0];
      const sentimentLabel = v.avg_sentiment_24h > 0.2 ? 'bullish' :
                             v.avg_sentiment_24h < -0.2 ? 'bearish' : 'neutral';

      signals.push({
        type: 'social_mention',
        marketId: v.market_id,
        marketTitle: `Social buzz: ${v.market_id}`, // Will be enriched later
        platform: v.platform,
        strength,
        rawData: {
          mentions1h: v.mentions_1h,
          mentions24h: v.mentions_24h,
          velocity1h: v.velocity_1h,
          velocity24h: v.velocity_24h,
          sentiment: v.avg_sentiment_24h,
          sentimentLabel,
          topAuthor: topMention?.author,
          topContent: topMention?.content?.slice(0, 100),
          topEngagement: topMention?.engagement,
        },
        detectedAt: now,
      });
    }

    return signals;
  } catch (err) {
    console.warn('[Social Detector] Failed:', err);
    return [];
  }
}

/**
 * Detect sentiment shift (from previous hour)
 *
 * Triggers when sentiment flips direction significantly.
 */
export async function detectSentimentShift(): Promise<RawSignal[]> {
  if (!isSupabaseConfigured) return [];

  const signals: RawSignal[] = [];
  const now = new Date().toISOString();

  try {
    // Get markets with significant sentiment data
    const { data: velocities } = await supabaseAdmin
      .from('social_velocity')
      .select('*')
      .gte('mentions_24h', 5)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (!velocities) return [];

    for (const v of velocities) {
      // Check for sentiment flip
      const sentiment1h = v.avg_sentiment_1h;
      const sentiment24h = v.avg_sentiment_24h;

      // Flip detection: signs are opposite AND both are significant
      const isFlip = (sentiment1h * sentiment24h < 0) &&
                     Math.abs(sentiment1h) > 0.3 &&
                     Math.abs(sentiment24h) > 0.2;

      if (!isFlip) continue;

      // Calculate strength based on magnitude of shift
      const shift = Math.abs(sentiment1h - sentiment24h);
      const strength = Math.min(1, shift);

      if (strength < 0.4) continue;

      const direction = sentiment1h > 0 ? 'bullish' : 'bearish';
      const previous = sentiment24h > 0 ? 'bullish' : 'bearish';

      signals.push({
        type: 'social_mention',
        marketId: v.market_id,
        marketTitle: `Sentiment shift: ${previous} → ${direction}`,
        platform: v.platform,
        strength,
        rawData: {
          shiftType: 'sentiment_flip',
          currentSentiment: sentiment1h,
          previousSentiment: sentiment24h,
          direction,
          previousDirection: previous,
          mentions24h: v.mentions_24h,
        },
        detectedAt: now,
      });
    }

    return signals;
  } catch (err) {
    console.warn('[Sentiment Shift Detector] Failed:', err);
    return [];
  }
}
