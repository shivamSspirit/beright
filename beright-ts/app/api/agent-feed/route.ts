/**
 * Agent Feed SSE Endpoint for BeRight Protocol
 * Server-Sent Events stream for live agent activity
 */

import { NextRequest } from 'next/server';
import { getRecentDecisions } from '../../../skills/onchain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial decisions from log
      try {
        const recent = getRecentDecisions(10);
        for (const entry of recent) {
          const event = {
            type: entry.memo.t,
            action: entry.memo.action,
            topic: entry.memo.q,
            confidence: entry.memo.conf,
            onChain: entry.onChain,
            txSignature: entry.txSignature,
            timestamp: entry.loggedAt,
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } catch {
        // No decisions yet
      }

      // Send heartbeat every 15 seconds to keep connection alive
      const interval = setInterval(() => {
        try {
          const heartbeat = {
            type: 'PING',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
          );

          // Also send any new decisions
          const recent = getRecentDecisions(1);
          const latest = recent[recent.length - 1];
          if (latest) {
            const event = {
              type: latest.memo.t,
              action: latest.memo.action,
              topic: latest.memo.q,
              confidence: latest.memo.conf,
              onChain: latest.onChain,
              txSignature: latest.txSignature,
              timestamp: latest.loggedAt,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 15000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
