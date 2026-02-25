/**
 * Unified Gateway API
 *
 * This endpoint provides the same command routing as Telegram,
 * allowing the web terminal to use the full agent/skill system.
 *
 * POST /api/gateway
 * Body: { message: string, userId?: string, sessionId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureTelegramHandler } from '../../../lib/secureHandler';
import { TelegramMessage } from '../../../types/index';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Route through SECURE handler (rate limit + input sanitization + allowlist + output filter)
    const response = await secureTelegramHandler(pseudoMessage);

    // Record bot response in session
    addToSessionHistory(activeSessionId, 'bot', response.text);

    // Convert Telegram markdown to web-friendly format
    const formattedText = formatResponseForWeb(response.text);

    return NextResponse.json({
      success: true,
      text: formattedText,
      rawText: response.text, // Original with Telegram markdown
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
 * Convert Telegram markdown to web terminal format
 */
function formatResponseForWeb(text: string): string {
  return text
    // Convert bold *text* to plain text (or keep for markdown renderer)
    .replace(/\*([^*]+)\*/g, '$1')
    // Convert italic _text_ to plain text
    .replace(/_([^_]+)_/g, '$1')
    // Convert code `text` - keep as is for monospace
    .replace(/`([^`]+)`/g, '`$1`')
    // Convert links [text](url) to "text: url" for terminal
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2')
    // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n');
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
