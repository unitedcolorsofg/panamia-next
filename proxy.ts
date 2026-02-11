import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AP_TYPES = ['application/activity+json', 'application/ld+json'];

export function proxy(request: NextRequest) {
  // ActivityPub content negotiation for /p/:screenname
  // Proxy runs before trailing-slash 308 redirects, fixing federation
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/p\/([^/]+)\/?$/);
  if (match) {
    const accept = request.headers.get('accept') || '';
    const wantsAP = AP_TYPES.some((t) => accept.includes(t));
    if (wantsAP) {
      const screenname = match[1];
      return NextResponse.rewrite(
        new URL(`/api/federation/actor/${screenname}`, request.url)
      );
    }
  }

  // Enforce HTTPS in production (Vercel deployment)
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, { status: 301 });
  }

  // Set security headers
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS protection (legacy but still good to have)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - restrict access to sensitive APIs
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=()'
  );

  // Strict-Transport-Security (HSTS) - only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

// Apply proxy to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
