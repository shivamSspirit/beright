/**
 * Social Listener - Main Orchestrator
 *
 * Monitors Twitter/X and Reddit for prediction market mentions.
 * Feeds into momentum score and signal intelligence pipeline.
 *
 * Usage:
 *   // Single run (from orchestrator)
 *   const result = await runSocialIngestion();
 *
 *   // Get velocity for a market
 *   const velocity = await getSocialVelocity(marketId, platform);
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { SocialMention, SocialVelocity, SocialSearchResult } from './types';
import { searchTwitter } from './twitter';
import { fetchPredictionSubreddits, searchRedditMentions } from './reddit';
import { matchMentionsToMarkets, generateContentHash } from './matcher';
import { analyzeSentimentWithLabel, isLikelySpam } from './sentiment';

// Re-export types and utilities
export * from './types';
export * from './sentiment';
export * from './matcher';

/**
 * Save mentions to database
 */
async function saveMentions(mentions: SocialMention[]): Promise<number> {
  if (!isSupabaseConfigured || mentions.length === 0) return 0;

  try {
    const rows = mentions.map(m => ({
      source: m.source,
      source_id: m.sourceId,
      source_url: m.sourceUrl,
      author: m.author,
      author_handle: m.authorHandle,
      author_followers: m.authorFollowers,
      is_verified: m.isVerified,
      content: m.content,
      content_hash: m.contentHash || generateContentHash(m.content),
      market_id: m.marketId,
      market_title: m.marketTitle,
      platform: m.platform,
      match_confidence: m.matchConfidence,
      sentiment: m.sentiment,
      sentiment_label: m.sentimentLabel,
      likes: m.likes,
      retweets: m.retweets,
      comments: m.comments,
      engagement_score: m.engagementScore,
      posted_at: m.postedAt?.toISOString(),
      fetched_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('social_mentions')
      .upsert(rows, { onConflict: 'content_hash', ignoreDuplicates: true });

    if (error) {
      console.warn('[Social] Failed to save mentions:', error.message);
      return 0;
    }

    return rows.length;
  } catch (err) {
    console.warn('[Social] Save error:', err);
    return 0;
  }
}

/**
 * Update social velocity for markets
 */
async function updateSocialVelocity(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all markets with recent mentions
    const { data: marketMentions } = await supabaseAdmin
      .from('social_mentions')
      .select('market_id, platform, sentiment, created_at')
      .not('market_id', 'is', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (!marketMentions || marketMentions.length === 0) return 0;

    // Group by market
    const marketGroups = new Map<string, typeof marketMentions>();
    for (const m of marketMentions) {
      const key = `${m.market_id}:${m.platform}`;
      if (!marketGroups.has(key)) {
        marketGroups.set(key, []);
      }
      marketGroups.get(key)!.push(m);
    }

    let updated = 0;

    for (const [key, mentions] of marketGroups) {
      const [marketId, platform] = key.split(':');

      // Count mentions in time windows
      const mentions1h = mentions.filter(m =>
        new Date(m.created_at) >= oneHourAgo
      ).length;

      const mentions24h = mentions.filter(m =>
        new Date(m.created_at) >= oneDayAgo
      ).length;

      const mentions7d = mentions.length;

      // Calculate velocity (vs baseline)
      const avgHourly = mentions7d / (7 * 24);
      const avgDaily = mentions7d / 7;

      const velocity1h = avgHourly > 0 ? mentions1h / avgHourly : 0;
      const velocity24h = avgDaily > 0 ? mentions24h / avgDaily : 0;

      // Calculate sentiment
      const recentMentions = mentions.filter(m =>
        new Date(m.created_at) >= oneHourAgo
      );
      const avgSentiment1h = recentMentions.length > 0
        ? recentMentions.reduce((sum, m) => sum + (m.sentiment || 0), 0) / recentMentions.length
        : 0;

      const dayMentions = mentions.filter(m =>
        new Date(m.created_at) >= oneDayAgo
      );
      const avgSentiment24h = dayMentions.length > 0
        ? dayMentions.reduce((sum, m) => sum + (m.sentiment || 0), 0) / dayMentions.length
        : 0;

      // Get top mentions
      const topMentions = mentions
        .sort((a, b) => (b as any).engagement_score - (a as any).engagement_score)
        .slice(0, 5)
        .map(m => ({
          source: (m as any).source,
          author: (m as any).author,
          content: (m as any).content?.slice(0, 200),
          engagement: (m as any).engagement_score,
        }));

      // Upsert velocity record
      const { error } = await supabaseAdmin
        .from('social_velocity')
        .upsert({
          market_id: marketId,
          platform,
          mentions_1h: mentions1h,
          mentions_24h: mentions24h,
          mentions_7d: mentions7d,
          velocity_1h: velocity1h,
          velocity_24h: velocity24h,
          avg_sentiment_1h: avgSentiment1h,
          avg_sentiment_24h: avgSentiment24h,
          top_mentions: topMentions,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'market_id,platform',
        });

      if (!error) updated++;
    }

    return updated;
  } catch (err) {
    console.warn('[Social] Velocity update failed:', err);
    return 0;
  }
}

/**
 * Get social velocity for a market
 */
export async function getSocialVelocity(
  marketId: string,
  platform: string
): Promise<SocialVelocity | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('social_velocity')
      .select('*')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .single();

    if (error || !data) return null;

    return {
      marketId: data.market_id,
      platform: data.platform,
      mentions1h: data.mentions_1h,
      mentions24h: data.mentions_24h,
      mentions7d: data.mentions_7d,
      velocity1h: data.velocity_1h,
      velocity24h: data.velocity_24h,
      avgSentiment1h: data.avg_sentiment_1h,
      avgSentiment24h: data.avg_sentiment_24h,
      topMentions: data.top_mentions || [],
      updatedAt: new Date(data.updated_at),
    };
  } catch (err) {
    return null;
  }
}

/**
 * Get recent mentions for a market
 */
export async function getMarketMentions(
  marketId: string,
  options?: { limit?: number; source?: string }
): Promise<SocialMention[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabaseAdmin
      .from('social_mentions')
      .select('*')
      .eq('market_id', marketId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 20);

    if (options?.source) {
      query = query.eq('source', options.source);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      author: row.author,
      authorHandle: row.author_handle,
      content: row.content,
      marketId: row.market_id,
      marketTitle: row.market_title,
      platform: row.platform,
      matchConfidence: row.match_confidence,
      sentiment: row.sentiment,
      sentimentLabel: row.sentiment_label,
      likes: row.likes,
      retweets: row.retweets,
      comments: row.comments,
      engagementScore: row.engagement_score,
      postedAt: row.posted_at ? new Date(row.posted_at) : undefined,
      fetchedAt: row.fetched_at ? new Date(row.fetched_at) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Run social ingestion pipeline
 *
 * Called by orchestrator every 5 minutes.
 * Returns count of new mentions saved.
 */
export async function runSocialIngestion(): Promise<{
  mentionsFetched: number;
  mentionsSaved: number;
  marketsUpdated: number;
}> {
  console.log('[Social] Running social ingestion...');
  const startTime = Date.now();

  let allMentions: SocialMention[] = [];

  // 1. Fetch from Twitter (via Tavily)
  try {
    const twitterKeywords = [
      'polymarket',
      'kalshi',
      'prediction market',
      '"will win"',
      '"betting odds"',
    ];

    const twitterResult = await searchTwitter(twitterKeywords, { limit: 30 });
    allMentions.push(...twitterResult.mentions);
    console.log(`[Social] Twitter: ${twitterResult.mentions.length} mentions`);
  } catch (err) {
    console.warn('[Social] Twitter fetch failed:', err);
  }

  // 2. Fetch from Reddit
  try {
    const redditResult = await fetchPredictionSubreddits({ limit: 50 });
    allMentions.push(...redditResult.mentions);
    console.log(`[Social] Reddit: ${redditResult.mentions.length} mentions`);
  } catch (err) {
    console.warn('[Social] Reddit fetch failed:', err);
  }

  // 3. Filter spam
  allMentions = allMentions.filter(m => !isLikelySpam(m.content));

  // 4. Match to markets
  const matchedMentions = await matchMentionsToMarkets(allMentions);
  const linkedCount = matchedMentions.filter(m => m.marketId).length;
  console.log(`[Social] Matched ${linkedCount}/${matchedMentions.length} to markets`);

  // 5. Save to database
  const saved = await saveMentions(matchedMentions);

  // 6. Update velocity metrics
  const marketsUpdated = await updateSocialVelocity();

  console.log(`[Social] Completed in ${Date.now() - startTime}ms: ${saved} saved, ${marketsUpdated} markets updated`);

  return {
    mentionsFetched: allMentions.length,
    mentionsSaved: saved,
    marketsUpdated,
  };
}

/**
 * Format social activity for Telegram
 */
export function formatSocialReport(mentions: SocialMention[], limit: number = 5): string {
  if (mentions.length === 0) {
    return '*No recent social mentions*';
  }

  let text = '*📱 SOCIAL ACTIVITY*\n';
  text += '─'.repeat(32) + '\n\n';

  const bullish = mentions.filter(m => m.sentimentLabel === 'bullish');
  const bearish = mentions.filter(m => m.sentimentLabel === 'bearish');

  text += `📊 Sentiment: ${bullish.length} bullish, ${bearish.length} bearish\n\n`;

  for (const m of mentions.slice(0, limit)) {
    const emoji = m.source === 'twitter' ? '𝕏' : '🔶';
    const sentiment = m.sentimentLabel === 'bullish' ? '📈' :
                      m.sentimentLabel === 'bearish' ? '📉' : '➡️';

    text += `${emoji} ${sentiment} @${m.authorHandle || 'unknown'}\n`;
    text += `_${m.content.slice(0, 100)}_\n`;
    text += `❤️ ${m.likes || 0} | 🔁 ${m.retweets || 0} | 💬 ${m.comments || 0}\n\n`;
  }

  text += `_${mentions.length} total mentions_`;
  return text;
}
