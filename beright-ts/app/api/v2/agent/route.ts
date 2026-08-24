import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeBeRightRuntimeRequest } from '../../../../lib/runtime/berightRuntime';
import { checkAgentAccess, getTierContext, checkAndIncrementUsage } from '../../../../lib/stripe/middleware';
import logger from '../../../../lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SessionContext {
  messages: Array<{ role: 'user' | 'agent'; content: string; agent?: string; timestamp: number }>;
  userId?: string;
}

const AgentRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4_000, 'Message is too long'),
  sessionId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  agent: z.enum(['scout', 'analyst', 'trader']).optional(),
});

type AgentRequestBody = z.infer<typeof AgentRequestSchema>;

const sessionCache = new Map<string, SessionContext>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId: string): SessionContext {
  const existing = sessionCache.get(sessionId);
  if (existing) return existing;

  const newSession: SessionContext = { messages: [] };
  sessionCache.set(sessionId, newSession);
  return newSession;
}

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionCache) {
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || now - lastMessage.timestamp > SESSION_TTL) {
      sessionCache.delete(id);
    }
  }
}, 5 * 60 * 1000);
sessionCleanupTimer.unref();

function appendSessionMessage(
  session: SessionContext,
  message: SessionContext['messages'][number]
): void {
  session.messages.push(message);
  if (session.messages.length > 40) {
    session.messages.splice(0, session.messages.length - 40);
  }
}

function createSessionId(): string {
  return `web-${randomUUID()}`;
}

function parseRequestBody(body: unknown): AgentRequestBody {
  return AgentRequestSchema.parse(body);
}

async function getTierInfo(userId?: string) {
  if (!userId) {
    return null;
  }

  try {
    const context = await getTierContext(userId);
    return {
      tier: context.tier,
      usage: context.usage,
      limits: context.limits,
    };
  } catch (error) {
    logger.warn('Unable to load tier context', { userId, error });
    return null;
  }
}

async function enforceUsageLimits(userId: string | undefined, forcedAgent: AgentRequestBody['agent']) {
  if (!userId) {
    return null;
  }

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

  if (!forcedAgent) {
    return null;
  }

  const agentCheck = await checkAgentAccess(userId, forcedAgent);
  if (agentCheck.allowed) {
    return null;
  }

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { message, sessionId, userId, agent: forcedAgent } = parseRequestBody(await request.json());

    const activeSessionId = sessionId || createSessionId();
    const session = getOrCreateSession(activeSessionId);

    const limitResponse = await enforceUsageLimits(userId, forcedAgent);
    if (limitResponse) {
      return limitResponse;
    }

    appendSessionMessage(session, {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    logger.info('Processing agent request', {
      sessionId: activeSessionId,
      userId,
      preferredCapability: forcedAgent,
      messageLength: message.length,
    });

    const execution = await executeBeRightRuntimeRequest({
      gateway: 'web',
      userId: userId || activeSessionId,
      chatId: activeSessionId,
      text: message,
      raw: {
        source: 'api-v2-agent',
        preferredCapability: forcedAgent,
      },
      isAuthenticated: !!userId,
      executionPolicy: 'prepare_only',
    });

    const responseText = execution.formatted.text;
    const responseMood = execution.result.hints?.mood || 'NEUTRAL';
    const semanticData = execution.result.data as {
      text?: string;
      mood?: string;
      agentUsed?: string;
      capabilityUsed?: string;
      understanding?: { confidence?: number };
      data?: unknown;
    } | undefined;
    const agentId = semanticData?.agentUsed || 'beright-runtime';
    const capabilityId = semanticData?.capabilityUsed;

    appendSessionMessage(session, {
      role: 'agent',
      content: responseText,
      agent: capabilityId || agentId,
      timestamp: Date.now(),
    });

    const processingTime = Date.now() - startTime;

    const tierInfo = await getTierInfo(userId);

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
        structuredData: semanticData?.data ?? execution.result.data,
        suggestedActions: execution.result.hints?.suggestedActions || [],
        executionPolicy: 'prepare_only',
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    logger.error('Agent request failed', error);

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
      architecture: 'BeRight runtime with internal capabilities',
      agent: {
        id: 'beright-runtime',
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
        'Quote-first trade preparation with explicit wallet approval',
        'Risk management',
        'Whale tracking',
        'News aggregation',
      ],
      executionPolicy: {
        mode: 'prepare_only',
        serverCanSign: false,
        walletConfirmationRequired: true,
      },
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
