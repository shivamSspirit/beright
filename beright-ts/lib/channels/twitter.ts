/**
 * Twitter/X Posting Agent
 *
 * Posts market intelligence to Twitter/X.
 * Supports:
 *   - Signal alerts (ALERT only)
 *   - Daily synthesis summaries
 *   - Arbitrage opportunities (high confidence)
 *   - Market hot takes
 *
 * Setup:
 *   1. Create Twitter developer account
 *   2. Create app with OAuth 1.0a credentials
 *   3. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 *
 * Usage:
 *   await postSignalToTwitter(signal);
 *   await postDailySummary();
 */

import { EvaluatedSignal, SIGNAL_META } from '../signals/types';
import { SynthesisReport } from '../synthesis/types';
import { llmChat } from '../llm';
import * as crypto from 'crypto';

// Twitter API v2
const TWITTER_API = 'https://api.twitter.com/2';

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Get Twitter credentials from environment
 */
function getTwitterConfig(): TwitterConfig | null {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return null;
  }

  return { apiKey, apiSecret, accessToken, accessSecret };
}

/**
 * Generate OAuth 1.0a signature
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  config: TwitterConfig
): string {
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.entries(params)
        .sort()
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    ),
  ].join('&');

  const signingKey = `${encodeURIComponent(config.apiSecret)}&${encodeURIComponent(config.accessSecret)}`;

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');
}

/**
 * Build OAuth Authorization header
 */
function buildOAuthHeader(
  method: string,
  url: string,
  config: TwitterConfig
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_token: config.accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, config);
  oauthParams['oauth_signature'] = signature;

  return 'OAuth ' + Object.entries(oauthParams)
    .sort()
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');
}

/**
 * Post tweet to Twitter
 */
async function postTweet(text: string): Promise<boolean> {
  const config = getTwitterConfig();
  if (!config) {
    console.warn('[Twitter] Credentials not configured');
    return false;
  }

  const url = `${TWITTER_API}/tweets`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': buildOAuthHeader('POST', url, config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn('[Twitter] API error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Twitter] Post failed:', err);
    return false;
  }
}

/**
 * Format signal for Twitter (280 char limit)
 */
function formatSignalForTwitter(signal: EvaluatedSignal): string {
  const meta = SIGNAL_META[signal.type];
  const emoji = meta.emoji;

  // Build compact tweet
  let tweet = `${emoji} ${signal.action}: ${signal.marketTitle.slice(0, 100)}\n\n`;
  tweet += `📊 ${signal.confidence}% confidence\n`;
  tweet += `🔗 ${signal.platform}\n\n`;
  tweet += `#predictions #${signal.platform}`;

  // Ensure under 280 chars
  if (tweet.length > 280) {
    tweet = tweet.slice(0, 277) + '...';
  }

  return tweet;
}

/**
 * Post signal alert to Twitter
 */
export async function postSignalToTwitter(signal: EvaluatedSignal): Promise<boolean> {
  // Only post ALERT signals with high confidence
  if (signal.action !== 'ALERT' || signal.confidence < 70) {
    return false;
  }

  const tweet = formatSignalForTwitter(signal);
  return postTweet(tweet);
}

/**
 * Generate and post daily summary using LLM
 */
export async function postDailySummary(report: SynthesisReport): Promise<boolean> {
  // Use LLM to generate Twitter-friendly summary
  try {
    const response = await llmChat({
      system: `You create viral prediction market tweets. Be concise, use emojis, include numbers. Max 270 characters.`,
      user: `Create a tweet summarizing this market intel:\n\nHeadline: ${report.headline}\nSentiment: ${report.overallSentiment}\nTop theme: ${report.themes[0]?.name || 'Markets'}\n\nDo NOT use hashtags.`,
      maxTokens: 100,
      temperature: 0.7,
      quality: 'fast',
    });

    if (response.provider === 'none') return false;

    let tweet = response.text.trim();

    // Add hashtags
    tweet += '\n\n#predictionmarkets #beright';

    if (tweet.length > 280) {
      tweet = tweet.slice(0, 277) + '...';
    }

    return postTweet(tweet);
  } catch (err) {
    console.warn('[Twitter] Summary generation failed:', err);
    return false;
  }
}

/**
 * Post arbitrage opportunity to Twitter
 */
export async function postArbToTwitter(arb: {
  topic: string;
  profitPercent: number;
  platformA: string;
  platformB: string;
}): Promise<boolean> {
  // Only post significant opportunities
  if (arb.profitPercent < 3) return false;

  const tweet = `🚨 ARB ALERT: ${arb.profitPercent.toFixed(1)}% profit potential\n\n${arb.topic.slice(0, 100)}\n\n${arb.platformA} ↔️ ${arb.platformB}\n\n#arbitrage #predictions`;

  return postTweet(tweet);
}

/**
 * Check if Twitter is configured
 */
export function isTwitterConfigured(): boolean {
  return getTwitterConfig() !== null;
}

/**
 * Post thread (multiple tweets)
 */
export async function postThread(tweets: string[]): Promise<number> {
  let posted = 0;

  for (const tweet of tweets) {
    if (await postTweet(tweet)) {
      posted++;
      // Rate limit between tweets
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return posted;
}
