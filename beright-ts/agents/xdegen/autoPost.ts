/**
 * xDegen Autonomous Posting System
 *
 * Runs on a schedule, fetches real market data, generates viral content,
 * and posts to X/Twitter automatically.
 *
 * Like AIXBT but for BeRight Protocol.
 */

import { llmChat } from '../../lib/llm';
import { getHotMarkets, searchMarkets } from '../../skills/markets';
import { arbitrage } from '../../skills/arbitrage';
import { Market } from '../../types/index';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AutoPostConfig {
  enabled: boolean;
  intervalMinutes: number;        // How often to post (default: 60)
  quietHoursStart: number;        // Don't post after this hour (0-23)
  quietHoursEnd: number;          // Resume posting after this hour
  maxPostsPerDay: number;         // Hard limit per day
  minSpreadForArbPost: number;    // Minimum arb spread to post about (e.g., 0.05 = 5%)
  minVolumeForHotPost: number;    // Minimum volume for hot market post
  contentMix: {                   // Probability distribution for post types
    arbitrage: number;
    hotMarket: number;
    education: number;
    aiNarrative: number;
    contrarian: number;
    breakingNews: number;
  };
}

const DEFAULT_CONFIG: AutoPostConfig = {
  enabled: false,
  intervalMinutes: 60,
  quietHoursStart: 2,   // 2 AM
  quietHoursEnd: 7,     // 7 AM
  maxPostsPerDay: 10,
  minSpreadForArbPost: 0.05,
  minVolumeForHotPost: 100000,
  contentMix: {
    arbitrage: 0.25,
    hotMarket: 0.25,
    education: 0.15,
    aiNarrative: 0.15,
    contrarian: 0.10,
    breakingNews: 0.10,
  },
};

// ============================================================================
// STATE
// ============================================================================

interface PostRecord {
  id: string;
  content: string;
  type: string;
  postedAt: Date;
  marketData?: any;
}

let config: AutoPostConfig = { ...DEFAULT_CONFIG };
let postHistory: PostRecord[] = [];
let autoPostTimer: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================================================
// TWITTER CLIENT (using twitter-api-v2)
// ============================================================================

interface TwitterClient {
  post: (content: string) => Promise<{ id: string; success: boolean }>;
  isConfigured: () => boolean;
}

async function getTwitterClient(): Promise<TwitterClient> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  const isConfigured = !!(apiKey && apiSecret && accessToken && accessSecret);

  if (isConfigured) {
    // Dynamic import to avoid errors if twitter-api-v2 not installed
    try {
      const { TwitterApi } = await import('twitter-api-v2');
      const client = new TwitterApi({
        appKey: apiKey!,
        appSecret: apiSecret!,
        accessToken: accessToken!,
        accessSecret: accessSecret!,
      });

      return {
        isConfigured: () => true,
        post: async (content: string) => {
          try {
            const tweet = await client.v2.tweet(content);
            console.log(`[xDegen] ✅ Posted to X: ${tweet.data.id}`);
            return { id: tweet.data.id, success: true };
          } catch (err) {
            console.error(`[xDegen] ❌ Twitter API error:`, err);
            return { id: '', success: false };
          }
        },
      };
    } catch (err) {
      console.warn('[xDegen] twitter-api-v2 not installed. Run: npm install twitter-api-v2');
    }
  }

  // Fallback: simulation mode
  return {
    isConfigured: () => false,
    post: async (content: string) => {
      const id = `sim_${Date.now()}`;
      console.log(`[xDegen] 📝 SIMULATED POST (configure Twitter API for live):`);
      console.log('─'.repeat(50));
      console.log(content);
      console.log('─'.repeat(50));
      return { id, success: true };
    },
  };
}

// ============================================================================
// CONTENT GENERATION
// ============================================================================

/**
 * Select post type based on content mix probabilities
 */
function selectPostType(): string {
  const rand = Math.random();
  let cumulative = 0;

  for (const [type, prob] of Object.entries(config.contentMix)) {
    cumulative += prob;
    if (rand <= cumulative) return type;
  }

  return 'hotMarket'; // fallback
}

/**
 * Fetch real market data for content generation
 */
async function fetchMarketIntel(): Promise<{
  hotMarkets: Market[];
  arbitrageOpps: any[];
  trendingTopics: string[];
}> {
  const [hotMarkets, arbResult] = await Promise.all([
    getHotMarkets(20).catch(() => []),
    arbitrage().catch(() => ({ opportunities: [] })),
  ]);

  // Extract trending topics from market titles
  const trendingTopics = hotMarkets
    .slice(0, 10)
    .map((m: Market) => m.title)
    .filter(Boolean);

  return {
    hotMarkets: hotMarkets as Market[],
    arbitrageOpps: arbResult.opportunities || [],
    trendingTopics,
  };
}

/**
 * Generate post content using LLM
 */
async function generatePost(
  type: string,
  intel: { hotMarkets: Market[]; arbitrageOpps: any[]; trendingTopics: string[] }
): Promise<{ content: string; marketData: any } | null> {

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let contextData: any = {};
  let specificInstructions = '';

  switch (type) {
    case 'arbitrage':
      if (intel.arbitrageOpps.length === 0) {
        // Fallback to hot market if no arbs
        return generatePost('hotMarket', intel);
      }
      const bestArb = intel.arbitrageOpps[0];
      contextData = bestArb;
      specificInstructions = `
Generate an ARB ALERT post about this arbitrage opportunity:
${JSON.stringify(bestArb, null, 2)}

Format:
🚨 ARB ALERT
[Market name]
🟣 Polymarket: X% YES
🔵 Kalshi: Y% YES
Spread: Z%
[One punchy line about free money]
$BERIGHT`;
      break;

    case 'hotMarket':
      const topMarket = intel.hotMarkets[0];
      if (!topMarket) return null;
      contextData = topMarket;
      specificInstructions = `
Generate a TRENDING NOW post about this hot market:
Title: ${topMarket.title}
YES Price: ${Math.round(topMarket.yesPrice * 100)}%
Volume: $${formatVolume(topMarket.volume || 0)}
Platform: ${topMarket.platform}

Format:
📈 TRENDING NOW
[Market question]
Current: X% YES
Volume: $X (24h)
Platform: [emoji] [name]
[One sharp insight about why this matters]
$BERIGHT | beright.fun`;
      break;

    case 'education':
      specificInstructions = `
Generate an educational post about prediction markets.
Topics to choose from:
- Why Brier scores matter for reputation
- How arbitrage works across platforms
- Why prediction markets beat polls
- The math behind Kelly criterion betting
- Base rates vs inside view

Keep it punchy. Data over hype. End with $BERIGHT | beright.fun`;
      break;

    case 'aiNarrative':
      specificInstructions = `
Generate a post about BeRight's AI agent capabilities in 2026.
Emphasize:
- AI scans multiple platforms in seconds
- Finds opportunities humans miss
- Autonomous intelligence, not chatbot
- Works while you sleep

End with $BERIGHT`;
      break;

    case 'contrarian':
      specificInstructions = `
Generate a provocative/contrarian take about:
- Prediction markets vs traditional betting
- Why most crypto projects fail but BeRight is different
- Why Polymarket/Kalshi have weaknesses BeRight solves
- A bold prediction about prediction markets in 2026

Be sharp but not cringe. End with $BERIGHT`;
      break;

    case 'breakingNews':
      // Use the most recent high-volume market as "breaking"
      const newsMarket = intel.hotMarkets.find(m => (m.volume || 0) > 500000);
      if (!newsMarket) return generatePost('hotMarket', intel);
      contextData = newsMarket;
      specificInstructions = `
Generate a MARKET MOVING post about:
${newsMarket.title}
Current odds: ${Math.round(newsMarket.yesPrice * 100)}% YES
Volume: $${formatVolume(newsMarket.volume || 0)}

Format:
🔴 MARKET MOVING
[What's happening]
Current odds: X% YES
[Why this matters]
Track it live: beright.fun
$BERIGHT`;
      break;
  }

  const prompt = `You are xDegen, the autonomous X/Twitter posting bot for BeRight Protocol.

DATE: ${currentDate}

BRAND:
- Token: $BERIGHT on Pump.fun (Solana)
- Platform: beright.fun
- Voice: Sharp. Confident. Data-driven. Not cringe.

CURRENT MARKET INTEL:
- Hot markets: ${intel.hotMarkets.slice(0, 5).map(m => m.title).join(', ')}
- Trending topics: ${intel.trendingTopics.slice(0, 5).join(', ')}

TASK:
${specificInstructions}

RULES:
1. MAX 280 characters (Twitter limit)
2. Include $BERIGHT or beright.fun
3. No "wen moon", "lfg", "wagmi" cringe
4. Use real data when available
5. Be screenshot-worthy

Return ONLY the tweet text, nothing else.`;

  try {
    const response = await llmChat({
      system: 'You are xDegen, a viral content bot. Sharp, data-driven, no fluff.',
      user: prompt,
      maxTokens: 400,
      temperature: 0.8,
      quality: 'fast',
    });

    let content = response.text.trim();

    // Ensure it fits Twitter
    if (content.length > 280) {
      content = content.slice(0, 277) + '...';
    }

    return { content, marketData: contextData };
  } catch (err) {
    console.error('[xDegen] Content generation failed:', err);
    return null;
  }
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}

// ============================================================================
// AUTONOMOUS LOOP
// ============================================================================

/**
 * Check if we're in quiet hours
 */
function isQuietHours(): boolean {
  const hour = new Date().getHours();
  if (config.quietHoursStart < config.quietHoursEnd) {
    return hour >= config.quietHoursStart && hour < config.quietHoursEnd;
  } else {
    // Handles wrap-around (e.g., 22:00 - 06:00)
    return hour >= config.quietHoursStart || hour < config.quietHoursEnd;
  }
}

/**
 * Get today's post count
 */
function getTodayPostCount(): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return postHistory.filter(p => p.postedAt >= todayStart).length;
}

/**
 * Main autonomous posting cycle
 */
async function runPostingCycle(): Promise<void> {
  if (!config.enabled) {
    console.log('[xDegen] Auto-posting disabled');
    return;
  }

  if (isQuietHours()) {
    console.log('[xDegen] Quiet hours - skipping post');
    return;
  }

  if (getTodayPostCount() >= config.maxPostsPerDay) {
    console.log('[xDegen] Daily limit reached - skipping post');
    return;
  }

  console.log('[xDegen] 🚀 Starting autonomous posting cycle...');

  try {
    // 1. Fetch market intel
    const intel = await fetchMarketIntel();
    console.log(`[xDegen] Fetched ${intel.hotMarkets.length} markets, ${intel.arbitrageOpps.length} arbs`);

    // 2. Select post type
    const postType = selectPostType();
    console.log(`[xDegen] Selected post type: ${postType}`);

    // 3. Generate content
    const generated = await generatePost(postType, intel);
    if (!generated) {
      console.log('[xDegen] Failed to generate content - skipping');
      return;
    }

    console.log(`[xDegen] Generated ${generated.content.length} char post`);

    // 4. Post to Twitter
    const twitter = await getTwitterClient();
    const result = await twitter.post(generated.content);

    // 5. Record the post
    if (result.success) {
      postHistory.push({
        id: result.id,
        content: generated.content,
        type: postType,
        postedAt: new Date(),
        marketData: generated.marketData,
      });
      console.log(`[xDegen] ✅ Post successful! ID: ${result.id}`);
    }

  } catch (err) {
    console.error('[xDegen] Posting cycle failed:', err);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start autonomous posting
 */
export function startAutoPosting(customConfig?: Partial<AutoPostConfig>): void {
  if (autoPostTimer) {
    console.log('[xDegen] Already running - stopping first');
    stopAutoPosting();
  }

  config = { ...DEFAULT_CONFIG, ...customConfig, enabled: true };

  console.log('[xDegen] 🟢 Starting autonomous posting');
  console.log(`[xDegen] Interval: ${config.intervalMinutes} minutes`);
  console.log(`[xDegen] Quiet hours: ${config.quietHoursStart}:00 - ${config.quietHoursEnd}:00`);
  console.log(`[xDegen] Max posts/day: ${config.maxPostsPerDay}`);

  // Run immediately
  runPostingCycle();

  // Schedule future runs
  autoPostTimer = setInterval(
    runPostingCycle,
    config.intervalMinutes * 60 * 1000
  );

  isRunning = true;
}

/**
 * Stop autonomous posting
 */
export function stopAutoPosting(): void {
  if (autoPostTimer) {
    clearInterval(autoPostTimer);
    autoPostTimer = null;
  }
  config.enabled = false;
  isRunning = false;
  console.log('[xDegen] 🔴 Autonomous posting stopped');
}

/**
 * Get current status
 */
export function getStatus(): {
  running: boolean;
  config: AutoPostConfig;
  todayPosts: number;
  totalPosts: number;
  lastPost: PostRecord | null;
  nextPostIn: number | null;
} {
  return {
    running: isRunning,
    config,
    todayPosts: getTodayPostCount(),
    totalPosts: postHistory.length,
    lastPost: postHistory[postHistory.length - 1] || null,
    nextPostIn: isRunning ? config.intervalMinutes : null,
  };
}

/**
 * Force a post immediately
 */
export async function forcePost(type?: string): Promise<{ success: boolean; content?: string }> {
  console.log('[xDegen] Force posting...');

  const intel = await fetchMarketIntel();
  const postType = type || selectPostType();
  const generated = await generatePost(postType, intel);

  if (!generated) {
    return { success: false };
  }

  const twitter = await getTwitterClient();
  const result = await twitter.post(generated.content);

  if (result.success) {
    postHistory.push({
      id: result.id,
      content: generated.content,
      type: postType,
      postedAt: new Date(),
      marketData: generated.marketData,
    });
  }

  return { success: result.success, content: generated.content };
}

/**
 * Get post history
 */
export function getPostHistory(limit: number = 10): PostRecord[] {
  return postHistory.slice(-limit);
}

/**
 * Update configuration
 */
export function updateConfig(newConfig: Partial<AutoPostConfig>): void {
  config = { ...config, ...newConfig };
  console.log('[xDegen] Config updated:', config);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  start: startAutoPosting,
  stop: stopAutoPosting,
  status: getStatus,
  force: forcePost,
  history: getPostHistory,
  config: updateConfig,
};
