import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to show "Coming Soon" for locked routes during pre-launch
 * Only 3 pages are live: Landing (/), Docs (/docs), FAQ (/docs/faq)
 * Remove this file or update matcher when ready to launch
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exact matches for user pages
  const exactUserPages = ['/', '/docs', '/docs/faq', '/coming-soon', '/beright-terminal'];

  // Check if exact user page
  if (exactUserPages.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if system route (prefix matching)
  const systemPrefixes = ['/api', '/_next', '/favicon.ico', '/images', '/fonts'];
  const isSystemRoute = systemPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isSystemRoute) {
    return NextResponse.next();
  }

  // Everything else goes to coming-soon
  const url = request.nextUrl.clone();
  url.pathname = '/coming-soon';
  url.searchParams.set('from', pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
