/**
 * Health Check API Route
 * GET /api/health - System health status
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateStartup } from '../../../lib/startup';
import { getSubscriberCount } from '../stream/route';
import { secrets } from '../../../lib/secrets';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Validate configuration
  const validation = validateStartup(false);

  // Check external dependencies
  const checks: Record<string, { status: 'ok' | 'error' | 'degraded'; latency?: number; error?: string }> = {};

  // Check Supabase
  const supabase = secrets.getSupabaseCredentials();
  if (supabase) {
    try {
      const start = Date.now();
      const response = await fetch(`${supabase.url}/rest/v1/`, {
        headers: { apikey: supabase.anonKey },
        signal: AbortSignal.timeout(5000),
      });
      checks.supabase = {
        status: response.ok ? 'ok' : 'error',
        latency: Date.now() - start,
      };
    } catch (error) {
      checks.supabase = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  } else {
    checks.supabase = { status: 'degraded', error: 'Not configured' };
  }

  // Check Upstash Redis
  const upstash = secrets.getUpstashCredentials();
  if (upstash) {
    try {
      const start = Date.now();
      const response = await fetch(`${upstash.url}/ping`, {
        headers: { Authorization: `Bearer ${upstash.token}` },
        signal: AbortSignal.timeout(3000),
      });
      checks.redis = {
        status: response.ok ? 'ok' : 'error',
        latency: Date.now() - start,
      };
    } catch (error) {
      checks.redis = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  } else {
    checks.redis = { status: 'degraded', error: 'Not configured' };
  }

  // Check Helius RPC
  const heliusUrl = secrets.getHeliusRpcUrl();
  if (heliusUrl && heliusUrl !== 'https://api.mainnet-beta.solana.com') {
    try {
      const start = Date.now();
      const response = await fetch(heliusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        }),
        signal: AbortSignal.timeout(5000),
      });
      checks.solana = {
        status: response.ok ? 'ok' : 'error',
        latency: Date.now() - start,
      };
    } catch (error) {
      checks.solana = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  } else {
    checks.solana = { status: 'degraded', error: 'Using public RPC' };
  }

  // Overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok');
  const anyError = Object.values(checks).some(c => c.status === 'error');
  const overallStatus = allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded';

  const responseTime = Date.now() - startTime;

  return NextResponse.json(
    {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      features: validation.features,
      checks,
      stream: {
        subscribers: getSubscriberCount(),
      },
    },
    {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
