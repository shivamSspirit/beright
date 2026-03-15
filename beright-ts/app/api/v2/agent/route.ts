/**
 * Agent API v2
 *
 * Direct access to the BeRight Agent System (Scout, Analyst, Trader, Orchestrator).
 * This bypasses the legacy telegramHandler and uses the new agentic architecture.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      ORCHESTRATOR                           │
 * │               (Understands → Routes → Synthesizes)          │
 * └──────────────────────────┬──────────────────────────────────┘
 *                            │
 *        ┌───────────────────┼───────────────────┐
 *        ▼                   ▼                   ▼
 * ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 * │    SCOUT     │   │   ANALYST    │   │   TRADER     │
 * │ Speed+Breadth│   │    Depth     │   │  Execution   │
 * └──────────────┘   └──────────────┘   └──────────────┘
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { processMessage, AGENT_ROLES, getToolCounts } from '../../../../agents';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Session context for web terminal
interface SessionContext {
  messages: Array<{ role: 'user' | 'agent'; content: string; agent?: string; timestamp: number }>;
  userId?: string;
}

const sessionCache = new Map<string, SessionContext>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId: string): SessionContext {
  const existing = sessionCache.get(sessionId);
  if (existing) return existing;

  const newSession: SessionContext = { messages: [] };
  sessionCache.set(sessionId, newSession);
  return newSession;
}

// Cleanup old sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionCache) {
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || now - lastMessage.timestamp > SESSION_TTL) {
      sessionCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/v2/agent
 *
 * Send a message to the agent system.
 *
 * Body:
 * - message: string (required) - The user's message
 * - sessionId: string (optional) - Session ID for context
 * - userId: string (optional) - User ID
 * - agent: string (optional) - Force routing to specific agent (scout, analyst, trader)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, sessionId, userId, agent: forcedAgent } = body as {
      message: string;
      sessionId?: string;
      userId?: string;
      agent?: 'scout' | 'analyst' | 'trader';
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const activeSessionId = sessionId || `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = getOrCreateSession(activeSessionId);

    // Record user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    console.log(`[Agent API] Processing: "${message.slice(0, 50)}..." | Session: ${activeSessionId}`);

    // Route to agent system
    const response = await processMessage(message);

    // Extract routing info from response data
    const responseData = response.data as { routing?: { agent?: string; intent?: string; confidence?: number; executionMs?: number } } | undefined;
    const agentId = responseData?.routing?.agent;

    // Record agent response
    session.messages.push({
      role: 'agent',
      content: response.text,
      agent: agentId,
      timestamp: Date.now(),
    });

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        text: response.text,
        mood: response.mood || 'NEUTRAL',
        agent: agentId,
        agentEmoji: agentId ? AGENT_ROLES[agentId as keyof typeof AGENT_ROLES]?.emoji : '🎯',
        metadata: responseData?.routing,
      },
      session: {
        id: activeSessionId,
        messageCount: session.messages.length,
      },
      meta: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Agent API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process message',
        data: {
          text: 'Sorry, something went wrong. Please try again.',
          mood: 'ERROR',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/agent
 *
 * Get agent system info and capabilities.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  // Return session info if requested
  if (sessionId) {
    const session = sessionCache.get(sessionId);
    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        exists: !!session,
        messageCount: session?.messages.length || 0,
        messages: session?.messages.slice(-10) || [],
      },
    });
  }

  // Return agent system info
  const toolCounts = getToolCounts();

  return NextResponse.json({
    success: true,
    data: {
      version: '3.0.0',
      architecture: 'Bloomberg Terminal',
      agents: {
        scout: {
          ...AGENT_ROLES.scout,
          available: true,
        },
        analyst: {
          ...AGENT_ROLES.analyst,
          available: true,
        },
        trader: {
          ...AGENT_ROLES.trader,
          available: true,
        },
        orchestrator: {
          ...AGENT_ROLES.orchestrator,
          available: true,
        },
      },
      toolCounts,
      activeSessions: sessionCache.size,
      capabilities: [
        'Natural language market queries',
        'Multi-platform market search',
        'Arbitrage detection',
        'Deep research analysis',
        'Probability estimation',
        'Position sizing (Kelly criterion)',
        'Trade execution',
        'Risk management',
        'Whale tracking',
        'News aggregation',
      ],
      exampleQueries: [
        "What's hot in prediction markets?",
        "Find arbitrage opportunities",
        "Analyze the Trump election market",
        "What's your probability for Bitcoin hitting $100k?",
        "How much should I bet on this market?",
        "What's my portfolio risk?",
      ],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
