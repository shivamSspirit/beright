/**
 * Unified Gateway API
 *
 * This endpoint provides the same command routing as Telegram,
 * allowing the web terminal to use the full agent/skill system.
 *
 * POST /api/gateway
 * Body: { message: string, userId?: string, sessionId?: string }
 *
 * For long-running operations (analyze, research, etc.), returns immediately
 * with a job ID. Client polls /api/jobs/:id for status and result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureTelegramHandler } from '../../../lib/secureHandler';
import { TelegramMessage } from '../../../types/index';
import { createJob, updateJob } from '../../../lib/jobs/jobQueue';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Patterns that trigger async processing (operations that take 10+ seconds)
const LONG_RUNNING_PATTERNS = [
  /^analyze\b/i,
  /^research\b/i,
  /^\/research\b/i,
  /^\/intelligence\b/i,
  /^\/odds\b/i,
  /deep\s*(dive|analysis)/i,
  /probability.*estimate/i,
  /superforecaster/i,
  /calibrat(e|ion)/i,
];

function isLongRunningRequest(message: string): boolean {
  return LONG_RUNNING_PATTERNS.some(p => p.test(message.trim()));
}

// Session context cache for web terminal (similar to Telegram chat context)
interface SessionContext {
  lastMessages: Array<{ role: 'user' | 'bot'; text: string; timestamp: number }>;
  userId?: string;
}

const sessionContextCache = new Map<string, SessionContext>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId: string): SessionContext {
  const existing = sessionContextCache.get(sessionId);
  if (existing) return existing;

  const newSession: SessionContext = {
    lastMessages: [],
  };
  sessionContextCache.set(sessionId, newSession);
  return newSession;
}

function addToSessionHistory(sessionId: string, role: 'user' | 'bot', text: string) {
  const session = getOrCreateSession(sessionId);
  session.lastMessages.push({ role, text, timestamp: Date.now() });

  // Keep only last 20 messages
  if (session.lastMessages.length > 20) {
    session.lastMessages = session.lastMessages.slice(-20);
  }
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionContextCache) {
    const lastMessage = session.lastMessages[session.lastMessages.length - 1];
    if (!lastMessage || now - lastMessage.timestamp > SESSION_TTL) {
      sessionContextCache.delete(id);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, sessionId } = body as {
      message: string;
      userId?: string;
      sessionId?: string;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const activeSessionId = sessionId || `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Record user message in session
    addToSessionHistory(activeSessionId, 'user', message);

    // Create a TelegramMessage-like object for the handler
    // This allows us to reuse the full Telegram routing logic
    const pseudoMessage: TelegramMessage = {
      message_id: Date.now(),
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: parseInt(activeSessionId.replace(/\D/g, '').slice(0, 10)) || Date.now(),
        type: 'private',
      },
      from: {
        id: userId ? parseInt(userId.replace(/\D/g, '').slice(0, 10)) || Date.now() : Date.now(),
        first_name: 'Web User',
        username: userId || undefined,
      },
      text: message.trim(),
    };

    console.log(`[Gateway] Processing: "${message.slice(0, 50)}..." | Session: ${activeSessionId}`);

    // Check if this is a long-running operation
    if (isLongRunningRequest(message)) {
      // Create job and return immediately
      const job = createJob();
      console.log(`[Gateway] Long-running request detected, created job: ${job.id}`);

      // Process in background (fire and forget)
      processJobInBackground(job.id, pseudoMessage, activeSessionId);

      return NextResponse.json({
        success: true,
        async: true,
        jobId: job.id,
        pollUrl: `/api/jobs/${job.id}`,
        text: 'Processing your request... This may take 15-30 seconds.',
        mood: 'NEUTRAL',
        sessionId: activeSessionId,
      });
    }

    // Synchronous processing for fast commands
    const response = await secureTelegramHandler(pseudoMessage);

    // Record bot response in session
    addToSessionHistory(activeSessionId, 'bot', response.text);

    // Convert Telegram markdown to web-friendly format
    const formattedText = formatResponseForWeb(response.text);

    return NextResponse.json({
      success: true,
      async: false,
      text: formattedText,
      rawText: response.text,
      mood: response.mood,
      data: response.data,
      sessionId: activeSessionId,
    });
  } catch (error) {
    console.error('[Gateway] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process message',
        text: 'Sorry, something went wrong. Please try again.',
        mood: 'ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Process long-running job in background
 * This function is NOT awaited - it runs after response is sent
 */
async function processJobInBackground(
  jobId: string,
  pseudoMessage: TelegramMessage,
  sessionId: string
) {
  try {
    updateJob(jobId, { status: 'running', progress: 10, progressMessage: 'Starting analysis...' });

    // Execute the handler
    const response = await secureTelegramHandler(pseudoMessage);

    // Record in session
    addToSessionHistory(sessionId, 'bot', response.text);

    // Format response
    const formattedText = formatResponseForWeb(response.text);

    // Mark complete
    updateJob(jobId, {
      status: 'complete',
      progress: 100,
      progressMessage: 'Complete',
      result: {
        success: true,
        text: formattedText,
        rawText: response.text,
        mood: response.mood,
        data: response.data,
        sessionId,
      },
    });

    console.log(`[Gateway] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[Gateway] Job ${jobId} failed:`, error);
    updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Convert Telegram markdown to web terminal format
 *
 * The web terminal uses react-markdown with GitHub-flavored markdown support,
 * so we strip Telegram-specific formatting but preserve standard markdown.
 */
function formatResponseForWeb(text: string): string {
  let formatted = text;

  // CRITICAL: Remove markdown code fences (```markdown or ```)
  // Agents wrap responses in fences for Telegram, but web terminal renders markdown directly
  formatted = formatted.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '');
  formatted = formatted.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');

  // Convert Telegram bold *text* to markdown bold **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');

  // Convert Telegram italic _text_ to markdown italic *text*
  formatted = formatted.replace(/_([^_]+)_/g, '*$1*');

  // Preserve inline code `text` as is (markdown compatible)
  // No changes needed for `code`

  // Preserve markdown links [text](url) as is (markdown compatible)
  // No changes needed for [text](url)

  // Normalize excessive line breaks
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

/**
 * GET endpoint for health check and session info
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (sessionId) {
    const session = sessionContextCache.get(sessionId);
    return NextResponse.json({
      sessionId,
      exists: !!session,
      messageCount: session?.lastMessages.length || 0,
    });
  }

  return NextResponse.json({
    status: 'ok',
    activeSessions: sessionContextCache.size,
    supportedCommands: [
      '/help', '/hot', '/alpha', '/arb', '/brief', '/closing',
      '/research <topic>', '/odds <topic>', '/intelligence <question>',
      '/whale', '/track_whale <address>', '/news <query>', '/social <query>', '/intel',
      '/predict <question> <prob> YES|NO [reason]', '/me', '/leaderboard', '/calibration',
      '/feedback', '/recommend', '/compare', '/learnings',
      '/portfolio', '/pnl', '/expiring', '/alert', '/limits',
      '/arb-monitor start|stop|status', '/arb-subscribe', '/arb-unsubscribe',
      '/kalshi', '/kbalance', '/kpositions', '/korders',
      '/dflow', '/trade', '/positions',
      '/subscribe', '/unsubscribe', '/alerts', '/signals',
      '/follow @user', '/unfollow @user', '/toplists',
      '/connect <wallet>', '/profile', '/memory',
      '/my-vault', '/channels', '/create-channel', '/subscribe-channel',
      '/agent', '/signal YES|NO "<market>" <prob>',
    ],
  });
}
