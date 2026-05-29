/**
 * Unified Gateway API
 *
 * This endpoint routes web terminal requests through the same
 * BeRight runtime bridge used by the product execution stack.
 *
 * POST /api/gateway
 * Body: {
 *   message: string,
 *   walletAddress?: string,    // For persistence to Supabase
 *   conversationId?: string,   // Continue existing conversation
 *   sessionId?: string,        // Session for context
 *   userId?: string            // Legacy support
 * }
 *
 * Response: {
 *   success: boolean,
 *   conversationId?: string,   // ID for conversation (Supabase or session)
 *   userMessageId?: string,    // ID of saved user message
 *   agentMessageId?: string,   // ID of saved agent message
 *   sessionId: string,
 *   text: string,
 *   mood?: string,
 *   agentType?: string,
 *   data?: any,
 *   async?: boolean,
 *   jobId?: string
 * }
 *
 * For long-running operations, returns immediately with jobId.
 * Client polls /api/jobs/:id for status and result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChatService, ChatResponse, ChatError } from '../../../lib/chat/ChatService';
import { createJob, updateJob } from '../../../lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================
// LONG-RUNNING DETECTION
// ============================================

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

// ============================================
// REQUEST TYPES
// ============================================

interface GatewayRequest {
  message: string;
  walletAddress?: string;
  conversationId?: string;
  sessionId?: string;
  userId?: string;
}

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      walletAddress,
      conversationId,
      sessionId,
      userId,
    } = body as GatewayRequest;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const activeSessionId = sessionId || `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[Gateway] Processing: "${message.slice(0, 50)}..." | Session: ${activeSessionId} | Wallet: ${walletAddress ? 'connected' : 'anonymous'}`);

    // Check if this is a long-running operation
    if (isLongRunningRequest(message)) {
      // Create job and return immediately
      const job = await createJob({ walletAddress, conversationId });
      console.log(`[Gateway] Long-running request detected, created job: ${job.id}`);

      // Process in background (fire and forget)
      processJobInBackground(job.id, {
        message,
        walletAddress,
        conversationId,
        sessionId: activeSessionId,
        userId,
      });

      return NextResponse.json({
        success: true,
        async: true,
        jobId: job.id,
        pollUrl: `/api/jobs/${job.id}`,
        text: 'Processing your request... This may take 15-30 seconds.',
        mood: 'NEUTRAL',
        sessionId: activeSessionId,
        conversationId: conversationId || undefined,
      });
    }

    // Synchronous processing
    const result = await ChatService.processMessage({
      message,
      walletAddress,
      conversationId,
      sessionId: activeSessionId,
      userId,
    });

    if (!result.success) {
      const error = result as ChatError;
      return NextResponse.json(
        {
          success: false,
          error: error.error,
          code: error.code,
          text: 'Sorry, something went wrong. Please try again.',
          mood: 'ERROR',
          sessionId: activeSessionId,
        },
        { status: 500 }
      );
    }

    const response = result as ChatResponse;

    return NextResponse.json({
      success: true,
      async: false,
      conversationId: response.conversationId,
      userMessageId: response.userMessageId,
      agentMessageId: response.agentMessageId,
      sessionId: response.sessionId,
      text: response.text,
      rawText: response.rawText,
      mood: response.mood,
      agentType: response.agentType,
      data: response.data,
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

// ============================================
// BACKGROUND JOB PROCESSING
// ============================================

/**
 * Process long-running job in background
 * This function is NOT awaited - it runs after response is sent
 */
async function processJobInBackground(
  jobId: string,
  request: GatewayRequest
) {
  try {
    await updateJob(jobId, { status: 'running', progress: 10, progressMessage: 'Starting analysis...' });

    const result = await ChatService.processMessage(request);

    if (!result.success) {
      const error = result as ChatError;
      await updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: error.error,
      });
      return;
    }

    const response = result as ChatResponse;

    // Mark complete
    await updateJob(jobId, {
      status: 'complete',
      progress: 100,
      progressMessage: 'Complete',
      result: {
        success: true,
        conversationId: response.conversationId,
        userMessageId: response.userMessageId,
        agentMessageId: response.agentMessageId,
        sessionId: response.sessionId,
        text: response.text,
        rawText: response.rawText,
        mood: response.mood,
        agentType: response.agentType,
        data: response.data,
      },
    });

    console.log(`[Gateway] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[Gateway] Job ${jobId} failed:`, error);
    await updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// GET HANDLER (Health Check)
// ============================================

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (sessionId) {
    const session = await ChatService.getSessionContext(sessionId);
    return NextResponse.json({
      sessionId,
      exists: !!session,
      messageCount: session?.lastMessages.length || 0,
      conversationId: session?.conversationId,
    });
  }

  return NextResponse.json({
    status: 'ok',
    version: '2.0.0',
    features: {
      persistence: true,
      conversations: true,
      asyncJobs: true,
    },
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
      '/channels', '/create-channel', '/subscribe-channel',
      '/agent', '/signal YES|NO "<market>" <prob>',
    ],
  });
}
