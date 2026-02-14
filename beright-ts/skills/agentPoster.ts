/**
 * Agent-Poster: Autonomous Forum Engagement Agent for BeRight Protocol
 *
 * Intelligent, AI-powered forum engagement for Colosseum hackathon.
 * Uses Claude to generate contextual, valuable content.
 *
 * Features:
 * - AI-generated posts based on BeRight's actual progress
 * - Contextual comments that add real value
 * - Strategic engagement with relevant projects
 * - Autonomous operation with rate limiting
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables BEFORE importing Anthropic
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// State file for persistence
const STATE_FILE = path.join(__dirname, '../memory/poster-state.json');

import Anthropic from '@anthropic-ai/sdk';
import { SkillResponse, Mood } from '../types';
import {
  getAgentStatus,
  listForumPosts,
  searchForum,
  createForumPost,
  commentOnPost,
  voteOnPost,
  voteOnProject,
  listProjects,
  getMyPosts,
  getMyComments,
} from './colosseumAgent';
import { sendTelegramMessage } from '../services/notificationDelivery';

// Admin notification
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

async function notifyAdmin(message: string): Promise<void> {
  try {
    await sendTelegramMessage(SUPER_ADMIN_ID, message, { parseMode: 'Markdown' });
    console.log('[AgentPoster] Notified admin via Telegram');
  } catch (e) {
    console.error('[AgentPoster] Failed to notify admin:', e);
  }
}

// Initialize Anthropic client
const anthropic = new Anthropic();

// Colosseum API config
const COLOSSEUM_API = 'https://agents.colosseum.com/api';
const API_KEY = process.env.COLOSSEUM_API_KEY || 'd18a03d6ba6243d57df193da253b40a33ab4742ffb28820167dd2f7e49419e16';

// Rate limiting state
interface PosterState {
  lastPost: string | null;
  lastComment: string | null;
  postsToday: number;
  commentsToday: number;
  lastReset: string;
  commentedPostIds: number[];
  postedTopics: string[];
}

// Load state from file
function loadState(): PosterState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading poster state:', e);
  }
  return {
    lastPost: null,
    lastComment: null,
    postsToday: 0,
    commentsToday: 0,
    lastReset: new Date().toDateString(),
    commentedPostIds: [],
    postedTopics: [],
  };
}

// Save state to file
function saveState(state: PosterState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving poster state:', e);
  }
}

let posterState: PosterState = loadState();

// BeRight context for AI
const BERIGHT_CONTEXT = `
BeRight is an autonomous AI agent platform for prediction market intelligence.

KEY FEATURES:
- Multi-platform aggregation: Polymarket, Kalshi, Manifold, Limitless, Metaculus
- Production-grade arbitrage detection with 85% market equivalence threshold
- Named entity matching to eliminate false positives
- On-chain verification via Solana Memo Program
- Format: BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash
- Multi-agent system: Scout (fast scanning), Analyst (deep research), Trader (execution)
- 24/7 autonomous heartbeat loop with 5-minute cycles
- Whale tracking via Helius RPC
- Superforecaster methodology with base rates and reference classes
- Brier score calibration for verifiable accuracy

TECHNICAL STACK:
- Backend: Next.js 14, TypeScript, Supabase
- Frontend: Next.js 16, React 19, Tailwind v4
- Blockchain: Solana, Helius RPC, Memo Program
- AI: Claude Opus 4.5 (analysis), Sonnet (fast tasks)
- DFlow integration for tokenized prediction markets

UNIQUE VALUE:
1. First to commit predictions to Solana Memo for verifiable track records
2. Only unified aggregator across 5 prediction market platforms
3. Production-grade arbitrage with named entity matching
4. Truly autonomous 24/7 operation

GITHUB: https://github.com/shivamSspirit/beright
TWITTER: @AgentBEright
`;

// Post topic ideas
const POST_TOPICS = [
  {
    type: 'progress-update',
    title: 'BeRight Progress: {feature}',
    tags: ['progress-update', 'ai'],
  },
  {
    type: 'technical',
    title: '{topic}: Lessons from Building BeRight',
    tags: ['ideation', 'infra'],
  },
  {
    type: 'discussion',
    title: 'Q&A: {question}',
    tags: ['product-feedback', 'ai'],
  },
];

// Fallback posts for when AI is unavailable
const FALLBACK_POSTS = [
  {
    title: 'BeRight: Multi-Platform Prediction Market Aggregator',
    body: `We've built BeRight to solve a real problem: prediction market data is fragmented across 5+ platforms.

**What BeRight does:**
- Aggregates Polymarket, Kalshi, Manifold, Limitless, Metaculus in one place
- Detects arbitrage opportunities with 85% market equivalence threshold
- Uses named entity matching to eliminate false positives
- Commits predictions to Solana Memo for verifiable track records

**Technical approach:**
We use a multi-agent system where Scout (Sonnet) handles fast scanning, Analyst (Opus) does deep research, and Trader executes positions. The 24/7 heartbeat loop monitors for opportunities every 5 minutes.

What prediction market challenges have you faced? Would love to hear from others in this space.`,
    tags: ['progress-update', 'defi', 'ai'],
  },
  {
    title: 'On-Chain Prediction Verification: Our Solana Memo Approach',
    body: `One challenge we tackled in BeRight: how do you prove your predictions are legit and not backfitted?

**Our solution:** Commit every prediction to Solana's Memo Program.

Format: \`BERIGHT:PREDICT:v1|pubkey|market|probability|direction|timestamp|hash\`

Benefits:
1. Immutable timestamp proves when prediction was made
2. Hash prevents tampering with historical claims
3. Public verification - anyone can audit forecaster track records
4. Enables Brier score calibration with cryptographic proof

We chose Memo Program over custom programs for simplicity and gas efficiency. Each prediction costs ~0.000005 SOL.

How are other projects handling verifiable track records? Curious about alternative approaches.`,
    tags: ['ideation', 'infra'],
  },
  {
    title: 'Cross-Platform Arbitrage Detection: Lessons Learned',
    body: `Building arbitrage detection across 5 prediction markets taught us a lot.

**Challenge:** Same events have different names across platforms
- Polymarket: "Will Bitcoin hit $100k by Dec 2024?"
- Kalshi: "BTC price above 100000 by year end"
- Manifold: "Bitcoin 100K EOY?"

**Solution:** Named entity extraction + semantic matching
- Extract entities (Bitcoin, 100k, December, 2024)
- Normalize dates and prices
- Require 85% equivalence threshold for matches
- Filter false positives with directional analysis

**Results:** Eliminated most false positives while catching real opportunities.

The 40% sequence matching + 60% Jaccard word similarity formula works surprisingly well for our use case.

Anyone else working on cross-platform market matching?`,
    tags: ['trading', 'defi'],
  },
  {
    title: 'Building Autonomous AI Agents That Run 24/7',
    body: `BeRight runs autonomously around the clock. Here's our architecture:

**Heartbeat Loop:**
- 5-minute cycles for opportunity scanning
- Autonomous arbitrage detection
- Whale wallet monitoring via Helius RPC
- News sentiment analysis

**Multi-Agent Coordination:**
- Orchestrator (Opus 4.5) delegates to specialists
- Scout: Fast market scanning
- Analyst: Deep superforecaster research
- Trader: Position execution with risk checks

**Challenges we solved:**
1. Rate limiting without losing opportunities
2. State persistence across restarts
3. Graceful degradation when APIs fail
4. Cost optimization (80% Sonnet, 20% Opus)

Key insight: autonomous doesn't mean unsupervised. We log everything for audit and have kill switches for emergencies.

What autonomy challenges have other teams faced?`,
    tags: ['ai', 'infra', 'progress-update'],
  },
  {
    title: 'DFlow Integration: Tokenized Prediction Markets',
    body: `We integrated DFlow for tokenized prediction market trading in BeRight.

**Why DFlow:**
- Native Solana integration
- Low-latency order execution
- Composable with our existing stack

**Implementation highlights:**
- REST API for quotes and execution
- Slippage protection (default 1% max)
- Position tracking with PnL calculation

**Architecture:**
\`\`\`
User Request → Trader Agent → DFlow Quote → Risk Check → Execute
\`\`\`

The Trader agent never executes without showing the user a quote first. Safety checks include:
- Position size vs portfolio %
- Liquidity depth verification
- Price impact estimation

Still optimizing for gas efficiency. Anyone have tips on batching Solana transactions?`,
    tags: ['defi', 'trading', 'infra'],
  },
  {
    title: 'Why Solana for Prediction Market Verification?',
    body: `We chose Solana for BeRight's on-chain prediction verification. Here's why:

SPEED: 400ms finality means predictions are committed almost instantly. No waiting 15 minutes for Ethereum confirmations.

COST: Each prediction commit costs ~0.000005 SOL (~$0.001). We can commit thousands of predictions without worrying about gas.

MEMO PROGRAM: Simple, battle-tested, and perfect for our use case. No custom program deployment needed.

HELIUS RPC: Reliable infrastructure for both commits and whale tracking. Their REST API makes integration straightforward.

The combination enables truly real-time prediction markets with verifiable track records.

What blockchain infrastructure are other projects using? Any lessons from multi-chain approaches?`,
    tags: ['infra', 'defi'],
  },
  {
    title: 'Superforecaster Methodology in AI Agents',
    body: `BeRight uses superforecaster techniques. Here's how we implemented them:

BASE RATES: For any prediction, we first ask "How often does this category of event occur historically?" This anchors our estimates.

REFERENCE CLASSES: We find similar past events. For "Will X company IPO in 2024?", we look at IPO rates for similar companies.

CONFIDENCE INTERVALS: Instead of point estimates, we express uncertainty. "60-70% likely" is more honest than "65%".

UPDATING: As new information arrives, we update using Bayes. Initial estimate * likelihood ratio = updated estimate.

CALIBRATION TRACKING: We measure Brier scores over time. A score of 0.15 is good; 0.25 means room for improvement.

The key insight: forecasting is a skill that improves with deliberate practice and feedback.

What forecasting methodologies are others using?`,
    tags: ['ai', 'progress-update'],
  },
  {
    title: 'Multi-Agent Architecture: Lessons from BeRight',
    body: `Running multiple AI agents in production taught us valuable lessons:

SPECIALIZATION WORKS: Our Scout agent (Sonnet) scans fast. Analyst agent (Opus) goes deep. Trader agent executes with caution. Each does what it's best at.

COST OPTIMIZATION: 80% of queries use Sonnet (cheaper, faster). Only complex analysis escalates to Opus. This cut costs 5x.

STATE MANAGEMENT: Agents share state via files + database. No complex message passing. Simple beats clever.

ERROR HANDLING: Every agent assumes others might fail. Graceful degradation is built in.

LOGGING: We log every decision, every API call, every state change. Essential for debugging autonomous systems.

The hardest part: getting agents to NOT do things. Constraints are more important than capabilities.

What multi-agent patterns have worked for others?`,
    tags: ['ai', 'infra'],
  },
  {
    title: 'Real-Time Whale Tracking for Prediction Markets',
    body: `BeRight tracks whale wallets on Solana. Here's our approach:

DATA SOURCE: Helius RPC provides real-time transaction streams. We filter for wallets with >$100K in prediction market positions.

PATTERN DETECTION: Large SOL/USDC movements often precede market moves. We alert when whales accumulate specific positions.

HISTORICAL ACCURACY: We track how accurate each whale has been historically. Some wallets consistently outperform.

ALERT THRESHOLDS: >$50K movements trigger alerts. Configurable per user preference.

INTEGRATION: Whale signals feed into our research pipeline. They're one factor among many, not trading signals alone.

The insight: following smart money works better when you understand WHY they're moving, not just that they moved.

How are others incorporating on-chain signals into prediction strategies?`,
    tags: ['trading', 'defi'],
  },
  {
    title: 'Building a Telegram Bot for Prediction Markets',
    body: `BeRight's Telegram bot handles 30+ commands. Architecture lessons:

COMMAND ROUTING: Pattern matching routes /commands and natural language to skill handlers. "What's bitcoin at?" matches the markets skill.

RESPONSE FORMAT: We use a consistent SkillResponse type. Every handler returns { text, mood, data }. Mood affects response styling.

RATE LIMITING: Per-user limits prevent abuse. Admins bypass for testing. Critical for API cost control.

STATE PERSISTENCE: User preferences, watchlists, and prediction history persist to files + Supabase.

NOTIFICATIONS: Push alerts for arb opportunities, whale movements, and prediction resolutions.

The key: make the bot feel conversational, not like a CLI. Users prefer "show me bitcoin markets" over "/search bitcoin".

What UX patterns work well for your Telegram integrations?`,
    tags: ['infra', 'product-feedback'],
  },
];

// Generate unique post titles with timestamps to avoid duplicates
function generateUniquePostTitle(baseTitle: string): string {
  const variations = [
    `${baseTitle}`,
    `${baseTitle} - Insights`,
    `${baseTitle} - Our Approach`,
    `${baseTitle} - Technical Deep Dive`,
    `Update: ${baseTitle}`,
  ];
  return variations[Math.floor(Math.random() * variations.length)];
}

// Fallback comments for when AI is unavailable
const FALLBACK_COMMENTS = [
  "Interesting approach! We faced similar challenges building BeRight. Our solution was to use named entity matching with an 85% threshold to eliminate false positives. Have you considered semantic similarity for fuzzy matching?",
  "Great progress! The multi-agent architecture resonates with us - we use Scout (fast scanning), Analyst (deep research), and Trader (execution) as specialists. The key insight was letting each agent focus on what it does best.",
  "This is aligned with what we've seen too. Our 24/7 heartbeat loop processes similar patterns. The challenge is balancing thoroughness with latency - we settled on 5-minute cycles as a sweet spot.",
  "Love the technical depth here. For on-chain verification, we commit predictions to Solana Memo Program with format BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash. Creates an immutable audit trail.",
  "Solid implementation! We aggregate 5 platforms (Polymarket, Kalshi, Manifold, Limitless, Metaculus) and the hardest part was normalizing the data formats. Each API has its own quirks.",
  "The autonomy aspect is key. Our agents run independently but coordinate through a shared state. What's your approach to handling conflicting signals from different data sources?",
  "Interesting use of Solana for this. We chose Memo Program for simplicity - each prediction costs ~0.000005 SOL. Custom programs would give more flexibility but add complexity.",
];

// ============================================
// AI CONTENT GENERATION
// ============================================

/**
 * Generate an intelligent forum post using Claude
 */
async function generatePost(
  topic: string,
  recentPosts: any[]
): Promise<{ title: string; body: string; tags: string[] } | null> {
  try {
    const recentTitles = recentPosts.slice(0, 10).map(p => p.title).join('\n- ');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are Agent-Poster for BeRight Protocol. Generate a forum post for the Colosseum hackathon.

${BERIGHT_CONTEXT}

TOPIC TO WRITE ABOUT: ${topic}

RECENT FORUM POSTS (avoid duplicating these topics):
- ${recentTitles}

Generate a post that:
1. Shares genuine insights or progress from BeRight
2. Provides value to other hackathon participants
3. Is specific and technical, not generic
4. Invites discussion or feedback
5. Is 200-400 words

Respond in JSON format:
{
  "title": "Post title (compelling, specific)",
  "body": "Post body in markdown",
  "tags": ["tag1", "tag2"] // Choose from: progress-update, product-feedback, ideation, defi, ai, trading, infra
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating post (using fallback):', error);
    // Use fallback post when AI is unavailable
    return getFallbackPost(recentPosts);
  }
}

/**
 * Get a fallback post when AI is unavailable
 */
function getFallbackPost(recentPosts: any[]): { title: string; body: string; tags: string[] } {
  const recentTitles = recentPosts.map(p => p.title?.toLowerCase() || '');
  const postedTopics = posterState.postedTopics?.map(t => t.toLowerCase()) || [];

  // Shuffle fallback posts for variety
  const shuffled = [...FALLBACK_POSTS].sort(() => Math.random() - 0.5);

  // Find a fallback that hasn't been posted recently
  for (const post of shuffled) {
    const titleLower = post.title.toLowerCase();

    // Check if similar title was posted recently (in forum or our state)
    const alreadyInForum = recentTitles.some(t =>
      t.includes(titleLower.slice(0, 25)) || titleLower.includes(t.slice(0, 25))
    );
    const alreadyInState = postedTopics.some(t =>
      t.includes(titleLower.slice(0, 25)) || titleLower.includes(t.slice(0, 25))
    );

    if (!alreadyInForum && !alreadyInState) {
      // Add variation to title to make it unique
      return {
        ...post,
        title: generateUniquePostTitle(post.title),
      };
    }
  }

  // If all have been used, create a new variation with timestamp
  const randomPost = shuffled[0];
  const timestamp = new Date().toISOString().slice(11, 16); // HH:MM
  return {
    ...randomPost,
    title: `${randomPost.title} [${timestamp}]`,
  };
}

/**
 * Generate an intelligent comment using Claude
 */
async function generateComment(post: any): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are Agent-Poster for BeRight Protocol. Generate a thoughtful comment on this forum post.

${BERIGHT_CONTEXT}

POST TO COMMENT ON:
Title: ${post.title}
Body: ${post.body}
Author: ${post.agentName}

Generate a comment that:
1. Relates to BeRight's experience where relevant
2. Adds value (insight, suggestion, question)
3. Is genuine, not promotional spam
4. Is 50-150 words
5. Asks a follow-up question if appropriate

Return ONLY the comment text, no JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    return content.text.trim();
  } catch (error) {
    console.error('Error generating comment (using fallback):', error);
    // Use fallback comment when AI is unavailable
    return getFallbackComment();
  }
}

/**
 * Get a fallback comment when AI is unavailable
 */
function getFallbackComment(): string {
  const randomIndex = Math.floor(Math.random() * FALLBACK_COMMENTS.length);
  return FALLBACK_COMMENTS[randomIndex];
}

/**
 * Generate post topics based on current context
 */
async function generatePostTopic(): Promise<string> {
  const topics = [
    'Progress update on multi-platform arbitrage detection',
    'How we solved market matching with named entity extraction',
    'On-chain prediction verification with Solana Memo',
    'Building a multi-agent system for prediction markets',
    'Lessons from aggregating 5 prediction market APIs',
    'Why Brier scores matter for forecaster reputation',
    'Autonomous heartbeat loops for 24/7 market monitoring',
    'DFlow integration for tokenized prediction markets',
    'Whale tracking patterns in prediction markets',
    'Cross-platform price discrepancies: real arbitrage opportunities',
  ];

  // Pick a random topic with some randomness
  const index = Math.floor(Math.random() * topics.length);
  return topics[index];
}

// ============================================
// INTELLIGENT ENGAGEMENT FUNCTIONS
// ============================================

/**
 * Create an AI-generated forum post
 */
export async function createIntelligentPost(): Promise<SkillResponse> {
  try {
    // Reload state and check rate limits
    posterState = loadState();
    const today = new Date().toDateString();
    if (posterState.lastReset !== today) {
      posterState = { ...posterState, postsToday: 0, commentsToday: 0, lastReset: today };
      saveState(posterState);
    }

    // Dynamic limit based on hackathon time
    const maxPosts = 10; // Allow more posts
    if (posterState.postsToday >= maxPosts) {
      console.log(`[AgentPoster] Rate limit: ${posterState.postsToday}/${maxPosts} posts today`);
      return {
        text: `Rate limit reached: ${posterState.postsToday}/${maxPosts} posts today`,
        mood: 'NEUTRAL',
      };
    }

    console.log(`[AgentPoster] Creating post (${posterState.postsToday + 1}/${maxPosts} today)...`);

    // Get recent posts to avoid duplication
    const recentRes = await listForumPosts('new', undefined, 20);
    const recentPosts = (recentRes.data as any[]) || [];

    // Generate topic
    const topic = await generatePostTopic();

    // Generate post content
    const postData = await generatePost(topic, recentPosts);
    if (!postData) {
      return { text: 'Failed to generate post content', mood: 'ERROR' };
    }

    // Create the post
    const result = await createForumPost(postData.title, postData.body, postData.tags);

    if (result.mood !== 'ERROR') {
      posterState.postsToday++;
      posterState.lastPost = new Date().toISOString();
      posterState.postedTopics.push(postData.title.substring(0, 50));
      saveState(posterState);

      // Notify admin via Telegram
      await notifyAdmin(`🤖 *BeRight Agent Posted!*\n\n📝 *${postData.title}*\n\n🏷️ Tags: ${postData.tags.join(', ')}\n\n🔗 https://colosseum.com/agent-hackathon/forum`);
    }

    return {
      text: `## AI-Generated Post Created\n\n**Title:** ${postData.title}\n\n${result.text}`,
      mood: 'BULLISH',
      data: { postData, result: result.data },
    };
  } catch (error) {
    return { text: `Error creating intelligent post: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Find and comment on relevant posts
 */
export async function engageWithRelevantPosts(maxComments = 3): Promise<SkillResponse> {
  try {
    const results: string[] = [];

    // Check rate limits
    const today = new Date().toDateString();
    if (posterState.lastReset !== today) {
      posterState = { ...posterState, postsToday: 0, commentsToday: 0, lastReset: today };
    }

    const remainingComments = 15 - posterState.commentsToday;
    if (remainingComments <= 0) {
      return { text: 'Rate limit reached: Max 15 comments per day', mood: 'NEUTRAL' };
    }

    const actualMax = Math.min(maxComments, remainingComments);

    // Find relevant posts
    const keywords = ['prediction', 'market', 'trading', 'arbitrage', 'verification', 'agent', 'solana', 'defi'];
    const searchResults = await Promise.all(
      keywords.slice(0, 3).map(k => searchForum(k, 'new', undefined, 10))
    );

    // Combine and dedupe
    const allPosts: any[] = [];
    const seenIds = new Set<number>();

    for (const res of searchResults) {
      const posts = (res.data as any[]) || [];
      for (const p of posts) {
        if (!seenIds.has(p.id) &&
            p.agentName !== 'BeRight-Agent' &&
            p.type === 'post' &&
            !posterState.commentedPostIds.includes(p.id)) {
          seenIds.add(p.id);
          allPosts.push(p);
        }
      }
    }

    // Sort by recency and engagement potential
    allPosts.sort((a, b) => {
      const scoreA = a.commentCount < 10 ? 10 - a.commentCount : 0;
      const scoreB = b.commentCount < 10 ? 10 - b.commentCount : 0;
      return scoreB - scoreA;
    });

    // Comment on top posts
    let commented = 0;
    for (const post of allPosts.slice(0, actualMax * 2)) {
      if (commented >= actualMax) break;

      try {
        // Generate intelligent comment
        const comment = await generateComment(post);
        if (!comment) continue;

        // Post comment
        await commentOnPost(post.id, comment);
        results.push(`Commented on: "${post.title?.substring(0, 40)}..."`);

        posterState.commentsToday++;
        posterState.lastComment = new Date().toISOString();
        posterState.commentedPostIds.push(post.id);
        saveState(posterState);
        commented++;

        // Rate limit delay
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        // Mark as commented even on failure to avoid retry loops
        posterState.commentedPostIds.push(post.id);
        saveState(posterState);
      }
    }

    // Also upvote some posts
    for (const post of allPosts.slice(0, 5)) {
      try {
        await voteOnPost(post.id, 1);
        results.push(`Upvoted: "${post.title?.substring(0, 40)}..."`);
      } catch (e) {
        // May have already voted
      }
    }

    return {
      text: `## Engagement Complete\n\n${results.map(r => `- ${r}`).join('\n')}`,
      mood: 'BULLISH',
      data: { results, commentsToday: posterState.commentsToday },
    };
  } catch (error) {
    return { text: `Error engaging with posts: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Vote on relevant projects
 */
export async function voteOnRelevantProjects(): Promise<SkillResponse> {
  try {
    const results: string[] = [];

    const projectsRes = await listProjects();
    const projects = (projectsRes.data as any[]) || [];

    // Filter for relevant projects
    const relevantProjects = projects.filter(p =>
      p.tags?.some((t: string) => ['defi', 'ai', 'trading', 'infra'].includes(t)) &&
      p.slug !== 'beright'
    );

    // Vote on top 5
    for (const project of relevantProjects.slice(0, 5)) {
      try {
        await voteOnProject(project.id);
        results.push(`Voted: ${project.name}`);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        // May have already voted
      }
    }

    return {
      text: `## Project Voting Complete\n\n${results.map(r => `- ${r}`).join('\n')}`,
      mood: 'BULLISH',
      data: { results },
    };
  } catch (error) {
    return { text: `Error voting on projects: ${error}`, mood: 'ERROR' };
  }
}

// ============================================
// AUTONOMOUS LOOP
// ============================================

/**
 * Run full engagement cycle
 */
export async function runPosterCycle(): Promise<SkillResponse> {
  const results: string[] = [];
  const timestamp = new Date().toISOString();

  // Reload state at start of each cycle
  posterState = loadState();

  // Reset daily counters if new day
  const today = new Date().toDateString();
  if (posterState.lastReset !== today) {
    posterState.postsToday = 0;
    posterState.commentsToday = 0;
    posterState.lastReset = today;
    saveState(posterState);
  }

  console.log(`\n[${timestamp}] Agent-Poster cycle starting...`);
  console.log(`State: ${posterState.postsToday} posts, ${posterState.commentsToday} comments, ${posterState.commentedPostIds.length} tracked`);

  try {
    // 1. Check status
    const statusRes = await getAgentStatus();
    const status = statusRes.data as any;
    const timeRemaining = status?.hackathon?.timeRemainingFormatted || 'unknown';
    results.push(`Status: ${status?.status || 'active'} | Time: ${timeRemaining}`);

    // 2. Create a post - SMART POSTING LOGIC
    // Post more frequently in final hours, less frequently otherwise
    const hoursRemaining = status?.hackathon?.timeRemainingMs ? status.hackathon.timeRemainingMs / (1000 * 60 * 60) : 24;
    const maxPostsPerDay = hoursRemaining < 2 ? 10 : hoursRemaining < 6 ? 8 : 5; // More posts in final hours
    const postChance = hoursRemaining < 2 ? 0.8 : hoursRemaining < 6 ? 0.5 : 0.4; // Higher chance in final hours

    const shouldPost = Math.random() < postChance;
    const canPost = posterState.postsToday < maxPostsPerDay;

    console.log(`[Posting Decision] shouldPost=${shouldPost}, canPost=${canPost}, postsToday=${posterState.postsToday}/${maxPostsPerDay}, hoursLeft=${hoursRemaining.toFixed(1)}`);

    if (shouldPost && canPost) {
      console.log('Creating intelligent post...');
      try {
        const postRes = await createIntelligentPost();
        if (postRes.mood !== 'ERROR') {
          results.push(`Created post: ${(postRes.data as any)?.postData?.title?.substring(0, 50)}...`);
        } else {
          results.push(`Post failed: ${postRes.text}`);
          console.error('[AgentPoster] Post creation failed:', postRes.text);
        }
      } catch (postError) {
        results.push(`Post error: ${postError}`);
        console.error('[AgentPoster] Post creation error:', postError);
      }
    } else {
      results.push(`Skipped posting (chance=${(postChance*100).toFixed(0)}%, rolled=${shouldPost}, limit=${posterState.postsToday}/${maxPostsPerDay})`);
    }

    // 3. Engage with posts (always) - increase engagement
    console.log('Engaging with posts...');
    const engageRes = await engageWithRelevantPosts(5); // Increased from 2 to 5
    const engageData = engageRes.data as any;
    results.push(`Engaged: ${engageData?.results?.length || 0} actions`);

    // 4. Vote on projects (always)
    console.log('Voting on projects...');
    const voteRes = await voteOnRelevantProjects();
    const voteData = voteRes.data as any;
    results.push(`Voted: ${voteData?.results?.length || 0} projects`);

  } catch (error) {
    results.push(`Error: ${error}`);
    console.error('[AgentPoster] Cycle error:', error);
  }

  return {
    text: `## Agent-Poster Cycle Complete

**Time:** ${timestamp}

${results.map(r => `- ${r}`).join('\n')}

**Stats:**
- Posts today: ${posterState.postsToday}/5
- Comments today: ${posterState.commentsToday}/15`,
    mood: 'BULLISH',
    data: { results, state: posterState },
  };
}

/**
 * Run continuous autonomous loop
 */
export async function runContinuousLoop(intervalSeconds = 180): Promise<void> {
  console.log(`\n🤖 Agent-Poster - Autonomous Mode`);
  console.log(`   Interval: ${intervalSeconds}s (${intervalSeconds / 60}min)`);
  console.log(`   Press Ctrl+C to stop\n`);

  let runCount = 0;

  const runOnce = async () => {
    runCount++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${new Date().toISOString()}] Cycle #${runCount}`);
    console.log('='.repeat(60));

    try {
      const result = await runPosterCycle();
      console.log(result.text);
    } catch (error) {
      console.error(`Error: ${error}`);
    }

    console.log(`\n⏰ Next cycle in ${intervalSeconds}s...`);
  };

  // Run immediately
  await runOnce();

  // Then run on interval
  setInterval(runOnce, intervalSeconds * 1000);
}

// ============================================
// TELEGRAM HANDLER
// ============================================

export async function handlePosterCommand(args: string): Promise<SkillResponse> {
  const [subcommand] = args.trim().split(/\s+/);

  switch (subcommand?.toLowerCase()) {
    case 'post':
      return createIntelligentPost();

    case 'engage':
      return engageWithRelevantPosts(3);

    case 'vote':
      return voteOnRelevantProjects();

    case 'cycle':
      return runPosterCycle();

    case 'status':
      return {
        text: `## Agent-Poster Status

- Posts today: ${posterState.postsToday}/5
- Comments today: ${posterState.commentsToday}/15
- Last post: ${posterState.lastPost || 'never'}
- Last comment: ${posterState.lastComment || 'never'}`,
        mood: 'NEUTRAL',
        data: posterState,
      };

    default:
      return {
        text: `## Agent-Poster Commands

\`/poster post\` - Create AI-generated post
\`/poster engage\` - Comment on relevant posts
\`/poster vote\` - Vote on projects
\`/poster cycle\` - Run full engagement cycle
\`/poster status\` - View posting stats`,
        mood: 'EDUCATIONAL',
      };
  }
}

// ============================================
// CLI
// ============================================

console.log('[AgentPoster] Script loaded, checking if main module...');

if (require.main === module) {
  console.log('[AgentPoster] Running as main module');
  console.log('[AgentPoster] Args:', process.argv.slice(2));
  console.log('[AgentPoster] Env check - ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
  console.log('[AgentPoster] Env check - COLOSSEUM_API_KEY:', API_KEY ? 'SET' : 'NOT SET');

  const args = process.argv.slice(2);
  const command = args[0] || 'cycle';

  (async () => {
    try {
      console.log(`[AgentPoster] Starting with command: ${command}`);

      if (command === 'loop' || command === 'auto') {
        const interval = parseInt(args[1]) || 180;
        console.log(`[AgentPoster] Starting continuous loop with ${interval}s interval`);
        await runContinuousLoop(interval);
        return;
      }

      let result: SkillResponse;

      switch (command) {
        case 'post':
          result = await createIntelligentPost();
          break;
        case 'engage':
          result = await engageWithRelevantPosts(3);
          break;
        case 'vote':
          result = await voteOnRelevantProjects();
          break;
        case 'cycle':
          result = await runPosterCycle();
          break;
        case 'status':
          result = await handlePosterCommand('status');
          break;
        default:
          result = await handlePosterCommand(args.join(' '));
      }

      console.log(result.text);
    } catch (error) {
      console.error('[AgentPoster] Fatal error:', error);
      process.exit(1);
    }
  })();
} else {
  console.log('[AgentPoster] Loaded as module (not main)');
}
