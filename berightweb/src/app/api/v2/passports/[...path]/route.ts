import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_TIMEOUT_MS = 30_000;

type RouteContext = { params: Promise<{ path: string[] }> };

function upstreamUrl(request: NextRequest, path: string[]): URL | null {
  const configuredBaseUrl = process.env.BERIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!configuredBaseUrl) return null;
  const encodedPath = path.map(encodeURIComponent).join('/');
  const upstream = new URL(`/api/v2/passports/${encodedPath}${request.nextUrl.search}`, configuredBaseUrl);
  return upstream.origin === request.nextUrl.origin ? null : upstream;
}

async function proxy(request: NextRequest, context: RouteContext, method: 'GET' | 'POST') {
  const { path } = await context.params;
  const upstream = upstreamUrl(request, path);
  if (!upstream) {
    return NextResponse.json({
      error: {
        code: 'PASSPORT_API_NOT_CONFIGURED',
        message: 'The Passport API is not configured.',
      },
    }, { status: 503 });
  }

  const headers = new Headers({ Accept: 'application/json' });
  for (const name of ['authorization', 'x-api-key', 'x-service-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(upstream, {
      method,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const responseHeaders = new Headers({
      'Cache-Control': response.headers.get('cache-control') ?? 'no-store',
      'Content-Type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
    });
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) responseHeaders.set('Content-Disposition', contentDisposition);
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[Passport API Proxy]', timedOut ? 'Upstream request timed out' : 'Upstream request failed');
    return NextResponse.json({
      error: {
        code: timedOut ? 'PASSPORT_API_TIMEOUT' : 'PASSPORT_API_UNAVAILABLE',
        message: timedOut
          ? 'The Passport service timed out. Please try again.'
          : 'The Passport service is temporarily unavailable.',
      },
    }, { status: 503 });
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, 'GET');
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, 'POST');
}
