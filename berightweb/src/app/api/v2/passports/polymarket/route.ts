import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UPSTREAM_TIMEOUT_MS = 295_000;

function passportApiUrl(request: NextRequest): URL | null {
  const configuredBaseUrl = process.env.BERIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!configuredBaseUrl) return null;
  const upstream = new URL('/api/v2/passports/polymarket', configuredBaseUrl);
  return upstream.origin === request.nextUrl.origin ? null : upstream;
}

export async function POST(request: NextRequest) {
  const upstream = passportApiUrl(request);
  if (!upstream) {
    return NextResponse.json({
      error: {
        code: 'PASSPORT_API_NOT_CONFIGURED',
        message: 'The Passport API is not configured.',
      },
    }, { status: 503 });
  }

  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': request.headers.get('content-type') ?? 'application/json',
  });
  for (const name of ['authorization', 'x-api-key', 'x-service-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers,
      body: await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[Passport API Proxy]', timedOut ? 'Upstream request timed out' : 'Upstream request failed');
    return NextResponse.json({
      error: {
        code: timedOut ? 'PASSPORT_API_TIMEOUT' : 'PASSPORT_API_UNAVAILABLE',
        message: timedOut
          ? 'The Passport build timed out. Please try again.'
          : 'The Passport service is temporarily unavailable.',
      },
    }, { status: 503 });
  }
}
