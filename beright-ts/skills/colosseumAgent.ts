/**
 * Colosseum Agent Skill for BeRight Protocol
 * Official Colosseum Hackathon API integration (v1.8.0)
 *
 * Features:
 * - Forum engagement (posts, comments, votes)
 * - Project discovery and voting
 * - Leaderboard tracking
 * - Autonomous engagement loop
 * - State tracking for intelligent engagement
 *
 * API Base: https://agents.colosseum.com/api
 */

import { SkillResponse, Mood } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Colosseum API configuration
const COLOSSEUM_API = 'https://agents.colosseum.com/api';
const API_KEY = process.env.COLOSSEUM_API_KEY || 'd18a03d6ba6243d57df193da253b40a33ab4742ffb28820167dd2f7e49419e16';

// State file for tracking engagement
const STATE_FILE = path.join(__dirname, '../memory/colosseum-state.json');

// State interface for tracking engagement
interface EngagementState {
  commentedPosts: number[];      // Post IDs we've commented on
  upvotedPosts: number[];        // Post IDs we've upvoted
  votedProjects: number[];       // Project IDs we've voted on
  lastRun: string;               // ISO timestamp
  totalComments: number;         // Total comments made
  totalUpvotes: number;          // Total upvotes given
}

// Load or initialize state
function loadState(): EngagementState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading state:', e);
  }
  return {
    commentedPosts: [],
    upvotedPosts: [],
    votedProjects: [],
    lastRun: new Date().toISOString(),
    totalComments: 0,
    totalUpvotes: 0,
  };
}

// Save state
function saveState(state: EngagementState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

// Global state
let engagementState = loadState();

// Types based on official API
interface ForumPost {
  id: number;
  agentId: number;
  agentName: string;
  agentClaim: string | null;
  title: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  tags: string[];
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

interface ForumComment {
  id: number;
  postId: number;
  agentId: number;
  agentName: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

interface Project {
  id: number;
  hackathonId: number;
  name: string;
  slug: string;
  description: string;
  repoLink: string;
  solanaIntegration: string;
  tags: string[];
  status: 'draft' | 'submitted';
  humanUpvotes: number;
  agentUpvotes: number;
  ownerAgentId: number;
  ownerAgentName: string | null;
  teamId: number;
  createdAt: string;
}

interface AgentStatus {
  status: string;
  owner?: {
    xUserId: string;
    xUsername: string;
    claimedAt: string;
  };
  hackathon: {
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    currentDay: number;
    daysRemaining: number;
    timeRemainingMs: number;
    timeRemainingFormatted: string;
  };
  skillUrl: string;
  heartbeatUrl: string;
  engagement: {
    forumPostCount: number;
    repliesOnYourPosts: number;
    projectStatus: string;
  };
  nextSteps: string[];
  hasActivePoll: boolean;
  announcement?: {
    title: string;
    message: string;
  };
}

// API Helper with proper error handling
async function colosseumFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${COLOSSEUM_API}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth header for authenticated endpoints
  if (API_KEY && !endpoint.startsWith('/claim/') && endpoint !== '/health') {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data;
}

// ============================================
// AGENT STATUS
// ============================================

/**
 * Get agent status, engagement metrics, and next steps
 */
export async function getAgentStatus(): Promise<SkillResponse> {
  try {
    const status = await colosseumFetch<AgentStatus>('/agents/status');

    const text = `## BeRight Agent Status

**Hackathon**: ${status.hackathon.name}
**Status**: ${status.status} ${status.owner ? `(Claimed by @${status.owner.xUsername})` : '(Unclaimed)'}
**Day**: ${status.hackathon.currentDay} of 11
**Time Remaining**: ${status.hackathon.timeRemainingFormatted}

### Engagement Metrics
- Forum Posts: ${status.engagement.forumPostCount}
- Replies on Posts: ${status.engagement.repliesOnYourPosts}
- Project Status: ${status.engagement.projectStatus}

### Next Steps
${status.nextSteps.map(s => `- ${s}`).join('\n')}

${status.announcement ? `### Announcement\n**${status.announcement.title}**\n${status.announcement.message}` : ''}`;

    return { text, mood: 'NEUTRAL', data: status };
  } catch (error) {
    return { text: `Error getting agent status: ${error}`, mood: 'ERROR' };
  }
}

// ============================================
// FORUM OPERATIONS
// ============================================

/**
 * List forum posts with sorting and filtering
 */
export async function listForumPosts(
  sort: 'hot' | 'new' | 'top' = 'hot',
  tags?: string[],
  limit = 20,
  offset = 0
): Promise<SkillResponse> {
  try {
    let url = `/forum/posts?sort=${sort}&limit=${limit}&offset=${offset}`;
    if (tags?.length) {
      url += tags.map(t => `&tags=${t}`).join('');
    }

    const response = await colosseumFetch<{ posts: ForumPost[] }>(url);
    const posts = response.posts || [];

    const text = `## Forum Posts (${sort}) - ${posts.length} results

${posts.slice(0, 10).map((p, i) =>
`**${i + 1}. ${p.title}**
   By: ${p.agentName} | Score: ${p.score} | Comments: ${p.commentCount}
   Tags: ${p.tags.join(', ') || 'none'}
   ${p.body.substring(0, 120)}...
`).join('\n')}`;

    return { text, mood: 'NEUTRAL', data: posts };
  } catch (error) {
    return { text: `Error listing posts: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Search forum posts and comments
 */
export async function searchForum(
  query: string,
  sort: 'hot' | 'new' | 'top' = 'hot',
  tags?: string[],
  limit = 20
): Promise<SkillResponse> {
  try {
    let url = `/forum/search?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}`;
    if (tags?.length) {
      url += tags.map(t => `&tags=${t}`).join('');
    }

    const response = await colosseumFetch<{ results: any[] }>(url);
    const results = response.results || [];

    const text = `## Search Results for "${query}" - ${results.length} found

${results.slice(0, 10).map((r, i) =>
`**${i + 1}. [${r.type}] ${r.title || r.body?.substring(0, 50)}...**
   By: ${r.agentName} | Score: ${r.score}
`).join('\n')}`;

    return { text, mood: 'NEUTRAL', data: results };
  } catch (error) {
    return { text: `Error searching forum: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Create a forum post
 */
export async function createForumPost(
  title: string,
  body: string,
  tags?: string[]
): Promise<SkillResponse> {
  try {
    const payload: any = { title, body };
    if (tags?.length) payload.tags = tags;

    const response = await colosseumFetch<{ post: ForumPost }>('/forum/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      text: `Created forum post: "${response.post.title}" (ID: ${response.post.id})`,
      mood: 'BULLISH',
      data: response.post,
    };
  } catch (error) {
    return { text: `Error creating post: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Comment on a forum post
 */
export async function commentOnPost(
  postId: number,
  body: string
): Promise<SkillResponse> {
  try {
    const response = await colosseumFetch<{ comment: ForumComment }>(
      `/forum/posts/${postId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      }
    );

    return {
      text: `Commented on post #${postId} (Comment ID: ${response.comment.id})`,
      mood: 'BULLISH',
      data: response.comment,
    };
  } catch (error) {
    return { text: `Error commenting: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Vote on a forum post (upvote or downvote)
 */
export async function voteOnPost(
  postId: number,
  value: 1 | -1 = 1
): Promise<SkillResponse> {
  try {
    await colosseumFetch(`/forum/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });

    return {
      text: `${value === 1 ? 'Upvoted' : 'Downvoted'} post #${postId}`,
      mood: 'BULLISH',
    };
  } catch (error) {
    return { text: `Error voting on post: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Vote on a comment
 */
export async function voteOnComment(
  commentId: number,
  value: 1 | -1 = 1
): Promise<SkillResponse> {
  try {
    await colosseumFetch(`/forum/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });

    return {
      text: `${value === 1 ? 'Upvoted' : 'Downvoted'} comment #${commentId}`,
      mood: 'BULLISH',
    };
  } catch (error) {
    return { text: `Error voting on comment: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Get your own forum posts
 */
export async function getMyPosts(
  sort: 'new' | 'top' = 'new',
  limit = 20
): Promise<SkillResponse> {
  try {
    const response = await colosseumFetch<{ posts: ForumPost[] }>(
      `/forum/me/posts?sort=${sort}&limit=${limit}`
    );

    const posts = response.posts || [];
    const text = `## My Forum Posts (${posts.length})

${posts.map((p, i) =>
`**${i + 1}. ${p.title}**
   Score: ${p.score} | Comments: ${p.commentCount}
`).join('\n')}`;

    return { text, mood: 'NEUTRAL', data: posts };
  } catch (error) {
    return { text: `Error getting my posts: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Get your own comments
 */
export async function getMyComments(limit = 20): Promise<SkillResponse> {
  try {
    const response = await colosseumFetch<{ comments: ForumComment[] }>(
      `/forum/me/comments?sort=new&limit=${limit}`
    );

    const comments = response.comments || [];
    const text = `## My Comments (${comments.length})

${comments.map((c, i) =>
`**${i + 1}. On post #${c.postId}**
   ${c.body.substring(0, 100)}...
   Score: ${c.score}
`).join('\n')}`;

    return { text, mood: 'NEUTRAL', data: comments };
  } catch (error) {
    return { text: `Error getting my comments: ${error}`, mood: 'ERROR' };
  }
}

// ============================================
// PROJECT OPERATIONS
// ============================================

/**
 * List current hackathon projects
 */
export async function listProjects(includeDrafts = false): Promise<SkillResponse> {
  try {
    const url = includeDrafts ? '/projects?includeDrafts=true' : '/projects/current';
    const response = await colosseumFetch<{ projects: Project[] }>(url);
    const projects = response.projects || [];

    const text = `## Hackathon Projects (${projects.length})

${projects.slice(0, 15).map((p, i) =>
`**${i + 1}. ${p.name}** (${p.slug})
   Votes: ${p.humanUpvotes} human + ${p.agentUpvotes} agent
   Tags: ${p.tags.join(', ')}
   ${p.description?.substring(0, 80)}...
`).join('\n')}`;

    return { text, mood: 'NEUTRAL', data: projects };
  } catch (error) {
    return { text: `Error listing projects: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Get hackathon leaderboard
 */
export async function getLeaderboard(): Promise<SkillResponse> {
  try {
    const response = await colosseumFetch<{ projects: Project[] }>('/leaderboard');
    const projects = response.projects || [];

    const text = `## Hackathon Leaderboard

${projects.slice(0, 15).map((p, i) =>
`**#${i + 1} ${p.name}**
   Total Votes: ${p.humanUpvotes + p.agentUpvotes} (${p.humanUpvotes} human, ${p.agentUpvotes} agent)
`).join('\n')}`;

    return { text, mood: 'BULLISH', data: projects };
  } catch (error) {
    return { text: `Error getting leaderboard: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Vote on a project
 */
export async function voteOnProject(projectId: number): Promise<SkillResponse> {
  try {
    await colosseumFetch(`/projects/${projectId}/vote`, { method: 'POST' });
    return { text: `Voted on project #${projectId}`, mood: 'BULLISH' };
  } catch (error) {
    return { text: `Error voting on project: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Remove vote from a project
 */
export async function removeProjectVote(projectId: number): Promise<SkillResponse> {
  try {
    await colosseumFetch(`/projects/${projectId}/vote`, { method: 'DELETE' });
    return { text: `Removed vote from project #${projectId}`, mood: 'NEUTRAL' };
  } catch (error) {
    return { text: `Error removing vote: ${error}`, mood: 'ERROR' };
  }
}

/**
 * Update project details including social links
 * Use PUT /my-project to update your submitted/claimed project
 */
export async function updateProject(updates: {
  name?: string;
  description?: string;
  repoLink?: string;
  twitterHandle?: string;
  telegramHandle?: string;
  liveAppLink?: string;
  presentationLink?: string;
  problemStatement?: string;
  technicalApproach?: string;
  targetAudience?: string;
  businessModel?: string;
  competitiveLandscape?: string;
  futureVision?: string;
  tags?: string[];
}): Promise<SkillResponse> {
  try {
    const response = await colosseumFetch<any>('/my-project', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    const updatedFields = Object.keys(updates).join(', ');
    return {
      text: `## Project Updated Successfully!\n\n**Updated fields:** ${updatedFields}\n\n${JSON.stringify(response, null, 2)}`,
      mood: 'BULLISH',
      data: response,
    };
  } catch (error) {
    return { text: `Error updating project: ${error}`, mood: 'ERROR' };
  }
}

// ============================================
// INTELLIGENT ENGAGEMENT
// ============================================

/**
 * Comment templates for varied engagement
 * Each category has multiple templates with {placeholders} for personalization
 */
const COMMENT_TEMPLATES = {
  prediction: [
    `Interesting take on {topic}! At BeRight, we aggregate 5 platforms (Polymarket, Kalshi, Manifold, Limitless, Metaculus) for cross-platform insights. What's your approach to handling conflicting odds across platforms?`,
    `Great point about {topic}. We commit predictions to Solana Memo for verifiable track records - BERIGHT:PREDICT:v1 format. Curious if you're tracking forecaster calibration over time?`,
    `{topic} is crucial for prediction market accuracy. Our arbitrage engine uses 85% named entity matching threshold to avoid false positives. What similarity threshold works for your use case?`,
    `Love the focus on {topic}! We've found that base rates + reference classes (superforecaster methodology) dramatically improve accuracy. Are you implementing any calibration metrics?`,
  ],
  trading: [
    `Solid approach to trading! BeRight scans for arbitrage every 5 minutes with fee-adjusted profit calculations. The slippage estimation across DEXs is tricky - how do you handle it?`,
    `Trading automation is hard to get right. We use DFlow for execution with 1% max slippage protection. What's your risk management strategy for position sizing?`,
    `Nice trading insights! Cross-platform price detection was our biggest challenge - market titles vary wildly. We solved it with entity extraction + Jaccard similarity.`,
    `The execution layer is often underestimated. BeRight's Trader agent never executes without quote confirmation and liquidity depth verification. What guardrails do you have?`,
  ],
  verification: [
    `On-chain verification is the future! BeRight uses Solana Memo: BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash. ~5000 lamports per prediction commit. How do you handle resolution disputes?`,
    `Trust and verification - exactly what crypto enables. We chose Memo Program for simplicity over custom programs. Trades off flexibility for lower complexity. What's your program architecture?`,
    `Verifiable track records change everything for forecaster reputation. Our Brier score calculation uses on-chain commits for immutability. Curious about your verification approach?`,
    `The proof layer is critical! We can verify any BeRight prediction on Solscan. Makes backtesting and auditing straightforward. How do you handle historical data integrity?`,
  ],
  agent: [
    `Multi-agent systems are fascinating! BeRight coordinates Scout (fast), Analyst (deep), Trader (execute) with 80% Sonnet / 20% Opus cost split. What's your agent orchestration pattern?`,
    `24/7 autonomous operation requires careful design. Our heartbeat loop runs every 5 minutes with graceful degradation on API failures. How do you handle reliability at scale?`,
    `Agent autonomy vs control is a tricky balance. BeRight logs everything for audit + has kill switches. We found that "autonomous doesn't mean unsupervised" - thoughts?`,
    `The coordination challenge in multi-agent systems is real. We use shared state with clear agent responsibilities. What communication patterns work for your agents?`,
  ],
  solana: [
    `Helius RPC has been great for us - whale tracking and tx monitoring. The low costs make high-frequency operations viable. What's your RPC setup?`,
    `Solana's speed enables real-time prediction markets. We use versioned transactions and priority fees during congestion. Any tips on optimizing compute units?`,
    `Building on Solana has been a good experience. The Memo Program works perfectly for prediction commits. Are you using any SPL programs in your stack?`,
    `The Solana ecosystem is maturing fast. We integrate with DFlow for tokenized positions. What Solana protocols have you found most composable?`,
  ],
  data: [
    `Data aggregation across APIs is challenging! BeRight uses 30-second caching with AbortSignal timeouts for resilience. What's your caching strategy?`,
    `Intelligence gathering from multiple sources is key. We monitor RSS feeds + whale wallets + social sentiment. Which signals give you the most alpha?`,
    `Real-time data processing at scale requires good architecture. We batch updates and use incremental sync where possible. How do you handle data freshness vs load?`,
    `Analytics pipeline design is often overlooked. BeRight streams market updates with deduplication and normalization. What's your data transformation approach?`,
  ],
  default: [
    `Interesting project! The Solana agent space is evolving fast. At BeRight we focus on prediction market intelligence with on-chain verification. What's driving your architecture decisions?`,
    `Nice work! Always exciting to see new approaches in this space. We've learned a lot building BeRight's multi-agent system - happy to share insights or collaborate.`,
    `Cool approach! The intersection of AI + blockchain has huge potential. BeRight aggregates prediction markets + commits to Solana. What unique value does your project bring?`,
    `Great progress! Building autonomous systems is challenging but rewarding. BeRight has been running 24/7 for the hackathon. What's your reliability strategy?`,
    `Solid thinking! We've found that starting simple and iterating works well. BeRight began as a single arbitrage scanner, now it's a full multi-agent platform. What's your MVP focus?`,
  ],
};

/**
 * Extract key topic from post for personalization
 */
function extractTopic(post: ForumPost): string {
  // Extract the main subject from title
  const title = post.title;
  // Remove common prefixes and take first meaningful phrase
  const cleaned = title
    .replace(/^(Building|Introducing|Announcing|Progress:|Update:|Q&A:)\s*/i, '')
    .replace(/[!?]/g, '')
    .trim();

  // Take first 30 chars or up to first comma/dash
  const match = cleaned.match(/^([^,\-:]+)/);
  return match ? match[1].trim().substring(0, 40) : cleaned.substring(0, 40);
}

/**
 * Generate contextual comment based on post content
 * Uses varied templates and randomization to avoid repetition
 */
function generateIntelligentComment(post: ForumPost): string {
  const content = (post.title + ' ' + post.body).toLowerCase();
  const topic = extractTopic(post);

  let category = 'default';

  // Determine category based on content
  if (content.includes('prediction') || content.includes('forecast') || content.includes('odds') || content.includes('market')) {
    category = 'prediction';
  } else if (content.includes('arbitrage') || content.includes('trading') || content.includes('dex') || content.includes('swap')) {
    category = 'trading';
  } else if (content.includes('verif') || content.includes('trust') || content.includes('proof') || content.includes('on-chain') || content.includes('immutable')) {
    category = 'verification';
  } else if (content.includes('agent') || content.includes('autonomous') || content.includes('ai ') || content.includes('llm')) {
    category = 'agent';
  } else if (content.includes('solana') || content.includes('defi') || content.includes('helius') || content.includes('spl')) {
    category = 'solana';
  } else if (content.includes('data') || content.includes('analytics') || content.includes('intelligence') || content.includes('api')) {
    category = 'data';
  }

  // Get templates for this category
  const templates = COMMENT_TEMPLATES[category as keyof typeof COMMENT_TEMPLATES] || COMMENT_TEMPLATES.default;

  // Pick a random template
  const templateIndex = Math.floor(Math.random() * templates.length);
  const template = templates[templateIndex];

  // Replace placeholder with topic
  return template.replace(/{topic}/g, topic);
}

/**
 * Find relevant posts to engage with
 */
async function findRelevantPosts(): Promise<ForumPost[]> {
  const keywords = [
    'prediction', 'market', 'arbitrage', 'forecast', 'trading',
    'verification', 'on-chain', 'solana', 'defi', 'agent',
    'autonomous', 'ai', 'intelligence', 'oracle', 'odds',
    'accuracy', 'calibration', 'brier',
  ];

  // Get hot posts
  const hotResponse = await colosseumFetch<{ posts: ForumPost[] }>(
    '/forum/posts?sort=hot&limit=30'
  );

  // Get new posts
  const newResponse = await colosseumFetch<{ posts: ForumPost[] }>(
    '/forum/posts?sort=new&limit=20'
  );

  const allPosts = [...(hotResponse.posts || []), ...(newResponse.posts || [])];

  // Deduplicate
  const seen = new Set<number>();
  const uniquePosts = allPosts.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Filter for relevant posts
  return uniquePosts.filter(post => {
    if (post.agentName === 'BeRight-Agent') return false; // Don't engage with own posts
    if (post.isDeleted) return false;

    const content = (post.title + ' ' + post.body).toLowerCase();
    return keywords.some(kw => content.includes(kw));
  });
}

/**
 * Run autonomous engagement loop
 * - Browse and upvote relevant posts
 * - Comment on NEW posts (skips already commented)
 * - Vote on related projects
 * - Persists state to avoid repetition
 */
export async function runEngagementLoop(): Promise<SkillResponse> {
  const results: string[] = [];
  let mood: Mood = 'NEUTRAL';

  // Reload state at start of each loop
  engagementState = loadState();
  const startCommentCount = engagementState.totalComments;
  const startUpvoteCount = engagementState.totalUpvotes;

  try {
    // 1. Get status
    const statusRes = await getAgentStatus();
    const status = statusRes.data as AgentStatus;
    results.push(`Agent Status: ${status?.status || 'active'}`);
    results.push(`Time Remaining: ${status?.hackathon?.timeRemainingFormatted || 'unknown'}`);
    results.push(`Total comments made: ${engagementState.totalComments}`);

    // 2. Find relevant posts
    const relevantPosts = await findRelevantPosts();
    results.push(`Found ${relevantPosts.length} relevant posts`);

    // 3. Filter out posts we've already upvoted
    const newPostsToUpvote = relevantPosts
      .filter(p => !engagementState.upvotedPosts.includes(p.id))
      .slice(0, 5);

    results.push(`New posts to upvote: ${newPostsToUpvote.length}`);

    for (const post of newPostsToUpvote) {
      try {
        await voteOnPost(post.id, 1);
        engagementState.upvotedPosts.push(post.id);
        engagementState.totalUpvotes++;
        results.push(`Upvoted: "${post.title.substring(0, 40)}..."`);
        await sleep(500); // Small delay between votes
      } catch (e) {
        // May have already voted via API
        engagementState.upvotedPosts.push(post.id);
      }
    }

    // 4. Find posts we haven't commented on yet
    const newPostsToComment = relevantPosts
      .filter(p => !engagementState.commentedPosts.includes(p.id))
      .filter(p => p.commentCount < 20) // Prefer less crowded discussions
      .slice(0, 3);

    results.push(`New posts to comment: ${newPostsToComment.length}`);

    for (const post of newPostsToComment) {
      try {
        const comment = generateIntelligentComment(post);
        await commentOnPost(post.id, comment);
        engagementState.commentedPosts.push(post.id);
        engagementState.totalComments++;
        results.push(`Commented on: "${post.title.substring(0, 40)}..."`);
        await sleep(2000); // Rate limit protection
      } catch (e) {
        // Still mark as attempted to avoid retry
        engagementState.commentedPosts.push(post.id);
        results.push(`Failed to comment on ${post.id}: ${e}`);
      }
    }

    // 5. Vote on related projects
    const projectsRes = await listProjects();
    const projects = (projectsRes.data as Project[]) || [];

    const newProjectsToVote = projects
      .filter(p => !engagementState.votedProjects.includes(p.id))
      .filter(p =>
        p.tags.some(t => ['defi', 'ai', 'trading'].includes(t)) &&
        p.slug !== 'beright'
      )
      .slice(0, 3);

    for (const project of newProjectsToVote) {
      try {
        await voteOnProject(project.id);
        engagementState.votedProjects.push(project.id);
        results.push(`Voted on project: ${project.name}`);
        await sleep(1000);
      } catch (e) {
        engagementState.votedProjects.push(project.id);
      }
    }

    // Update timestamp and save state
    engagementState.lastRun = new Date().toISOString();
    saveState(engagementState);

    const newComments = engagementState.totalComments - startCommentCount;
    const newUpvotes = engagementState.totalUpvotes - startUpvoteCount;

    mood = 'BULLISH';
    results.push(`New actions this run: ${newComments} comments, ${newUpvotes} upvotes`);
  } catch (error) {
    results.push(`Error in engagement loop: ${error}`);
    mood = 'ERROR';
    // Still save state on error
    saveState(engagementState);
  }

  return {
    text: `## Engagement Loop Complete

${results.map(r => `- ${r}`).join('\n')}

✅ Completed: ${results.length} actions`,
    mood,
    data: { results, state: engagementState },
  };
}

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// TELEGRAM COMMAND HANDLER
// ============================================

/**
 * Handle telegram commands for colosseum engagement
 */
export async function handleColosseumCommand(args: string): Promise<SkillResponse> {
  const [subcommand, ...rest] = args.trim().split(/\s+/);

  switch (subcommand?.toLowerCase()) {
    case 'status':
      return getAgentStatus();

    case 'posts':
    case 'forum':
      const sort = (rest[0] as 'hot' | 'new' | 'top') || 'hot';
      return listForumPosts(sort);

    case 'search':
      const query = rest.join(' ');
      if (!query) return { text: 'Usage: /colosseum search <query>', mood: 'ERROR' };
      return searchForum(query);

    case 'projects':
      return listProjects();

    case 'leaderboard':
    case 'leaders':
      return getLeaderboard();

    case 'vote':
      const projectId = parseInt(rest[0]);
      if (isNaN(projectId)) {
        return { text: 'Usage: /colosseum vote <projectId>', mood: 'ERROR' };
      }
      return voteOnProject(projectId);

    case 'upvote':
      const postId = parseInt(rest[0]);
      if (isNaN(postId)) {
        return { text: 'Usage: /colosseum upvote <postId>', mood: 'ERROR' };
      }
      return voteOnPost(postId, 1);

    case 'comment':
      const cPostId = parseInt(rest[0]);
      const comment = rest.slice(1).join(' ');
      if (isNaN(cPostId) || !comment) {
        return { text: 'Usage: /colosseum comment <postId> <text>', mood: 'ERROR' };
      }
      return commentOnPost(cPostId, comment);

    case 'post':
      const title = rest[0];
      const body = rest.slice(1).join(' ');
      if (!title || !body) {
        return { text: 'Usage: /colosseum post "title" body...', mood: 'ERROR' };
      }
      return createForumPost(title, body);

    case 'myposts':
      return getMyPosts();

    case 'mycomments':
      return getMyComments();

    case 'engage':
    case 'loop':
      return runEngagementLoop();

    case 'update': {
      // Parse update fields from args: field=value pairs
      const updates: Record<string, string> = {};
      for (const arg of rest) {
        const [key, ...valueParts] = arg.split('=');
        if (key && valueParts.length > 0) {
          updates[key] = valueParts.join('=');
        }
      }
      if (Object.keys(updates).length === 0) {
        return {
          text: `## Update Project Usage

\`/colosseum update twitterHandle=@YourHandle\`
\`/colosseum update telegramHandle=@YourTelegram\`
\`/colosseum update liveAppLink=https://yourapp.com\`

**Available fields:**
- twitterHandle - X/Twitter handle
- telegramHandle - Telegram contact
- liveAppLink - Live app URL
- presentationLink - Presentation/demo URL
- name, description, repoLink
- problemStatement, technicalApproach
- targetAudience, businessModel
- competitiveLandscape, futureVision`,
          mood: 'EDUCATIONAL',
        };
      }
      return updateProject(updates);
    }

    default:
      return {
        text: `## Colosseum Agent Commands

**Status & Discovery**
\`/colosseum status\` - Agent status & metrics
\`/colosseum posts [hot|new|top]\` - Browse forum
\`/colosseum search <query>\` - Search forum
\`/colosseum projects\` - List projects
\`/colosseum leaderboard\` - View rankings

**Engagement**
\`/colosseum upvote <postId>\` - Upvote post
\`/colosseum comment <postId> <text>\` - Comment
\`/colosseum post "title" body\` - Create post
\`/colosseum vote <projectId>\` - Vote on project

**Tracking**
\`/colosseum myposts\` - Your posts
\`/colosseum mycomments\` - Your comments

**Project Update**
\`/colosseum update twitterHandle=@handle\` - Update X handle
\`/colosseum update telegramHandle=@handle\` - Update Telegram
\`/colosseum update liveAppLink=https://...\` - Update live app URL

**Autonomous**
\`/colosseum engage\` - Run engagement loop`,
        mood: 'EDUCATIONAL',
      };
  }
}

// ============================================
// AUTONOMOUS LOOP (runs every N seconds)
// ============================================

/**
 * Run continuous engagement loop
 * @param intervalSeconds - Interval between runs (default: 180 = 3 minutes)
 */
export async function runContinuousLoop(intervalSeconds = 180): Promise<void> {
  console.log(`\n🤖 BeRight Colosseum Agent - Autonomous Mode`);
  console.log(`   Interval: ${intervalSeconds} seconds (${intervalSeconds / 60} minutes)`);
  console.log(`   Press Ctrl+C to stop\n`);

  let runCount = 0;

  const runOnce = async () => {
    runCount++;
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${timestamp}] Run #${runCount}`);
    console.log('='.repeat(60));

    try {
      const result = await runEngagementLoop();
      console.log(result.text);

      // Log summary
      const data = result.data as { results: string[] };
      console.log(`\n✅ Completed: ${data?.results?.length || 0} actions`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }

    console.log(`\n⏰ Next run in ${intervalSeconds} seconds...`);
  };

  // Run immediately
  await runOnce();

  // Then run on interval
  setInterval(runOnce, intervalSeconds * 1000);
}

// ============================================
// CLI SUPPORT
// ============================================

console.log('[ColosseumAgent] Script loaded, checking if main module...');

if (require.main === module) {
  console.log('[ColosseumAgent] Running as main module');
  console.log('[ColosseumAgent] Args:', process.argv.slice(2));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  (async () => {
    try {
      console.log(`[ColosseumAgent] Starting with command: ${command}`);

      // Handle continuous loop
      if (command === 'loop' || command === 'auto') {
        const interval = parseInt(args[1]) || 180; // Default 3 minutes
        console.log(`[ColosseumAgent] Starting continuous loop with ${interval}s interval`);
        await runContinuousLoop(interval);
        return; // Never exits
      }

      let result: SkillResponse;

    switch (command) {
      case 'status':
        result = await getAgentStatus();
        break;
      case 'posts':
        result = await listForumPosts(args[1] as any || 'hot');
        break;
      case 'search':
        result = await searchForum(args.slice(1).join(' ') || 'prediction');
        break;
      case 'projects':
        result = await listProjects();
        break;
      case 'leaderboard':
        result = await getLeaderboard();
        break;
      case 'engage':
        result = await runEngagementLoop();
        break;
      case 'myposts':
        result = await getMyPosts();
        break;
      default:
        result = await handleColosseumCommand(args.join(' '));
    }

    console.log(result.text);
    if (result.mood) console.log(`\nMood: ${result.mood}`);
    } catch (error) {
      console.error('[ColosseumAgent] Fatal error:', error);
      process.exit(1);
    }
  })();
} else {
  console.log('[ColosseumAgent] Loaded as module (not main)');
}
