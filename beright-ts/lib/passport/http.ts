import { NextRequest, NextResponse } from 'next/server';
import { PassportError } from './service';

export function passportLookup(request: NextRequest): string {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const index = parts.indexOf('passports');
  return decodeURIComponent(index >= 0 ? parts[index + 1] ?? '' : '');
}

export function passportErrorResponse(error: unknown): NextResponse {
  if (error instanceof PassportError) {
    const status = error.code === 'PASSPORT_NOT_FOUND' ? 404 : error.code === 'EVIDENCE_UNAVAILABLE' ? 409 : 503;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
  return NextResponse.json({ error: { code: 'PASSPORT_UNAVAILABLE', message: 'Forecaster Passport is temporarily unavailable' } }, { status: 503 });
}

export function publicPassportResponse(body: unknown, cacheSeconds = 60): NextResponse {
  return NextResponse.json(body, { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}` } });
}
