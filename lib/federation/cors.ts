/**
 * CORS header utility for federation and social API routes.
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/utils/getCORSHeaders.ts
 * Ensures CORS headers are returned on both success AND error responses,
 * preventing clients from losing error details when the browser blocks
 * the response body due to missing CORS headers.
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

/**
 * Returns a plain object of CORS headers for the given allowed methods.
 * Spread into NextResponse headers or pass to `new Headers(Object.entries(...))`.
 */
export function corsHeaders(...methods: HttpMethod[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Expose-Headers': 'Link',
  };
}
