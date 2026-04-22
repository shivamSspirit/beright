/**
 * Lightweight liveness probe for hosting platforms.
 *
 * IMPORTANT:
 * - Must return 200 quickly if the server is up (no external calls).
 * - Used by Railway health checks.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'beright-protocol',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

