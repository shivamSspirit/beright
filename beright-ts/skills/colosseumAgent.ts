/**
 * Colosseum Agent Skill for BeRight Protocol
 * Official Colosseum Hackathon API integration (v1.8.0)
 *
 * Features:
 * - Forum engagement (posts, comments, votes)
 * - Project discovery and voting
 * - Leaderboard tracking
 * - Autonomous engagement loop
 *
 * API Base: https://agents.colosseum.com/api
 */

import { SkillResponse, Mood } from '../types';

// Colosseum API configuration
const COLOSSEUM_API = 'https://agents.colosseum.com/api';
const API_KEY = process.env.COLOSSEUM_API_KEY || 'd18a03d6ba6243d57df193da253b40a33ab4742ffb28820167dd2f7e49419e16';

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

// ============================================
// INTELLIGENT ENGAGEMENT
// ============================================

/**
 * Generate contextual comment based on post content
 */
function generateIntelligentComment(post: ForumPost): string {
  const content = (post.title + ' ' + post.body).toLowerCase();

  // Prediction markets / forecasting
  if (content.includes('prediction') || content.includes('forecast') || content.includes('odds')) {
    return `Interesting take on prediction markets! At BeRight, we aggregate 5 platforms (Polymarket, Kalshi, Manifold, Limitless, Metaculus) and commit every prediction to Solana Memo Program for verifiable track records. The key insight is that cross-platform arbitrage detection needs named entity matching with 85%+ equivalence threshold to avoid false positives. Would love to hear how you're approaching market normalization.`;
  }

  // Arbitrage / trading
  if (content.includes('arbitrage') || content.includes('trading') || content.includes('dex')) {
    return `Great approach to trading automation! We built a production-grade arbitrage engine that scans across prediction markets every 5 minutes. The challenge we solved was fee-adjusted profit calculation with slippage estimation. Cross-platform price detection is crucial but tricky - market titles vary wildly between platforms. Happy to share our matching algorithm insights.`;
  }

  // Verification / trust / proof
  if (content.includes('verif') || content.includes('trust') || content.includes('proof') || content.includes('on-chain')) {
    return `This resonates strongly with our approach. BeRight commits every prediction to Solana Memo Program with format BERIGHT:PREDICT:v1|pubkey|market|prob|dir|ts|hash - creating immutable, verifiable records. Anyone can verify via Solscan. On-chain verification is the future of forecaster credibility. How are you handling resolution verification?`;
  }

  // AI agents / autonomous
  if (content.includes('agent') || content.includes('autonomous') || content.includes('ai ')) {
    return `Solid thinking on autonomous agents! BeRight runs a 24/7 heartbeat loop with multi-agent coordination - Scout for fast scanning (Sonnet), Analyst for deep research (Opus), Trader for execution. The key is balancing autonomy with reliable decision-making. What's your approach to agent coordination and task delegation?`;
  }

  // Solana / DeFi
  if (content.includes('solana') || content.includes('defi') || content.includes('helius')) {
    return `Nice Solana integration! We use Helius RPC for whale tracking and the Memo Program for prediction verification. The low tx costs (~5000 lamports) make it perfect for high-frequency prediction commits. Are you using versioned transactions for better compute efficiency?`;
  }

  // Data / analytics
  if (content.includes('data') || content.includes('analytics') || content.includes('intelligence')) {
    return `Data aggregation is key! BeRight unifies market data from 5 prediction platforms with 30-second caching and AbortSignal timeouts for resilience. We also track whale movements and run sentiment analysis on news RSS feeds. What data sources are you finding most valuable?`;
  }

  // Default thoughtful response
  return `Interesting project! The prediction market + Solana space needs more innovation. At BeRight, we focus on multi-platform aggregation and on-chain verification for trustless forecaster reputation. Always excited to see what others are building. What's your biggest technical challenge so far?`;
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
 * - Comment on interesting discussions
 * - Vote on related projects
 */
export async function runEngagementLoop(): Promise<SkillResponse> {
  const results: string[] = [];
  let mood: Mood = 'NEUTRAL';

  try {
    // 1. Get status
    const statusRes = await getAgentStatus();
    const status = statusRes.data as AgentStatus;
    results.push(`Agent Status: ${status?.status || 'active'}`);
    results.push(`Time Remaining: ${status?.hackathon?.timeRemainingFormatted || 'unknown'}`);

    // 2. Find relevant posts
    const relevantPosts = await findRelevantPosts();
    results.push(`Found ${relevantPosts.length} relevant posts`);

    // 3. Upvote top relevant posts (rate limit: 120/hour for forum votes)
    const postsToUpvote = relevantPosts.slice(0, 5);
    for (const post of postsToUpvote) {
      try {
        await voteOnPost(post.id, 1);
        results.push(`Upvoted: "${post.title.substring(0, 40)}..."`);
        await sleep(500); // Small delay between votes
      } catch (e) {
        // May have already voted
      }
    }

    // 4. Comment on top 2-3 posts (rate limit: 30/hour)
    const postsToComment = relevantPosts
      .filter(p => p.commentCount < 20) // Prefer less crowded discussions
      .slice(0, 3);

    for (const post of postsToComment) {
      try {
        const comment = generateIntelligentComment(post);
        await commentOnPost(post.id, comment);
        results.push(`Commented on: "${post.title.substring(0, 40)}..."`);
        await sleep(2000); // Rate limit protection
      } catch (e) {
        results.push(`Failed to comment: ${e}`);
      }
    }

    // 5. Vote on related projects
    const projectsRes = await listProjects();
    const projects = (projectsRes.data as Project[]) || [];

    const relatedProjects = projects
      .filter(p =>
        p.tags.some(t => ['defi', 'ai', 'trading'].includes(t)) &&
        p.slug !== 'beright'
      )
      .slice(0, 3);

    for (const project of relatedProjects) {
      try {
        await voteOnProject(project.id);
        results.push(`Voted on project: ${project.name}`);
        await sleep(1000);
      } catch (e) {
        // May have already voted
      }
    }

    mood = 'BULLISH';
  } catch (error) {
    results.push(`Error in engagement loop: ${error}`);
    mood = 'ERROR';
  }

  return {
    text: `## Engagement Loop Complete

${results.map(r => `- ${r}`).join('\n')}`,
    mood,
    data: { results },
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

**Autonomous**
\`/colosseum engage\` - Run engagement loop`,
        mood: 'EDUCATIONAL',
      };
  }
}

// ============================================
// CLI SUPPORT
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  (async () => {
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
  })();
}
