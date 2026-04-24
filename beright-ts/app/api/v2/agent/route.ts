/**
 * Agent API v2
 *
 * Direct access to the BeRight Terminal runtime.
 * This uses the same OpenClaw-style execution bridge as the rest of beright-ts.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    BERIGHT-TERMINAL                         │
 * │           (Router → Orchestrator → Handlers)               │
 * └──────────────────────────┬──────────────────────────────────┘
 *                            │
 *        ┌───────────────────┼───────────────────┐
 *        ▼                   ▼                   ▼
 * ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 * │    SCOUT     │   │   ANALYST    │   │   TRADER     │
 * │ Capability   │   │ Capability   │   │ Capability   │
 * └──────────────┘   └──────────────┘   └──────────────┘
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeBeRightOpenClawRequest } from '../../../../lib/runtime/openclaw';
import { checkAgentAccess, getTierContext, checkAndIncrementUsage } from '../../../../lib/stripe/middleware';

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
 * Send a message to the BeRight Terminal runtime.
 *
 * Body:
 * - message: string (required) - The user's message
 * - sessionId: string (optional) - Session ID for context
 * - userId: string (optional) - User ID
 * - agent: string (optional) - Preferred internal capability hint (scout, analyst, trader)
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TIER-BASED ACCESS CONTROL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (userId) {
      // Check daily query limit first
      const queryCheck = await checkAndIncrementUsage(userId, 'queriesPerDay');
      if (!queryCheck.allowed) {
        return NextResponse.json({
          success: false,
          error: 'rate_limit',
          message: queryCheck.reason,
          data: {
            text: `You've reached your daily query limit (${queryCheck.currentUsage}/${queryCheck.limit}). Upgrade your plan for more queries.`,
            mood: 'LIMIT_REACHED',
          },
          tier: queryCheck.tier,
          usage: {
            current: queryCheck.currentUsage,
            limit: queryCheck.limit,
          },
          upgradeUrl: '/subscription',
        }, { status: 429 });
      }

      // If a specific capability is requested, check access to that capability tier
      if (forcedAgent) {
        const agentCheck = await checkAgentAccess(userId, forcedAgent);
        if (!agentCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'tier_required',
            message: agentCheck.reason,
            data: {
              text: `The ${forcedAgent} capability requires a higher tier. ${agentCheck.reason}`,
              mood: 'UPGRADE_REQUIRED',
            },
            tier: agentCheck.tier,
            requiredTier: agentCheck.requiredTier,
            upgradeUrl: '/subscription',
          }, { status: 403 });
        }
      }
    }

    // Record user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    console.log(`[Agent API] Processing: "${message.slice(0, 50)}..." | Session: ${activeSessionId}`);

    const execution = await executeBeRightOpenClawRequest({
      gateway: 'api',
      userId: userId || activeSessionId,
      chatId: activeSessionId,
      text: message,
      raw: {
        source: 'api-v2-agent',
        preferredCapability: forcedAgent,
      },
      isAuthenticated: !!userId,
    });

    const responseText = execution.formatted.text;
    const responseMood = execution.result.hints?.mood || 'NEUTRAL';
    const semanticData = execution.result.data as {
      agentUsed?: string;
      capabilityUsed?: string;
      understanding?: { confidence?: number };
    } | undefined;
    const agentId = semanticData?.agentUsed || 'beright-terminal';
    const capabilityId = semanticData?.capabilityUsed;

    // Record agent response
    session.messages.push({
      role: 'agent',
      content: responseText,
      agent: capabilityId || agentId,
      timestamp: Date.now(),
    });

    const processingTime = Date.now() - startTime;

    // Get tier context for response (optional, only if userId provided)
    let tierInfo = null;
    if (userId) {
      try {
        const context = await getTierContext(userId);
        tierInfo = {
          tier: context.tier,
          usage: context.usage,
          limits: context.limits,
        };
      } catch {
        // Ignore tier context errors
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        text: responseText,
        mood: responseMood,
        agent: agentId,
        capability: capabilityId,
        agentEmoji: '🎯',
        metadata: {
          handlerId: execution.result.meta?.handlerId,
          routeId: execution.result.meta?.routeId,
          confidence: semanticData?.understanding?.confidence,
          preferredCapability: forcedAgent,
        },
      },
      session: {
        id: activeSessionId,
        messageCount: session.messages.length,
      },
      tier: tierInfo,
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
 * Get runtime info and internal capabilities.
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

  return NextResponse.json({
    success: true,
    data: {
      version: '3.0.0',
      architecture: 'OpenClaw runtime with internal capabilities',
      agent: {
        id: 'beright-terminal',
        available: true,
      },
      capabilities: {
        scout: {
          name: 'Scout',
          role: 'Fast scanning and market discovery',
          available: true,
        },
        analyst: {
          name: 'Analyst',
          role: 'Deep research and probability analysis',
          available: true,
        },
        trader: {
          name: 'Trader',
          role: 'Execution, quotes, and portfolio actions',
          available: true,
        },
      },
      activeSessions: sessionCache.size,
      features: [
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
