/**
 * CSRF / same-origin check for state-changing API routes.
 *
 * For POST/DELETE routes that mutate state, verify the browser-set Origin
 * header matches our own site. This defends against cross-site form POSTs
 * and CORS-exempt "simple" cross-origin requests when cookie SameSite
 * attributes are set to Lax (the better-auth default).
 *
 * Browsers always set Origin on POST/DELETE/PUT/PATCH, so a missing Origin
 * on a state-changing request is itself suspicious — reject it.
 *
 * The trusted origin is read from NEXT_PUBLIC_HOST_URL (same value the app
 * uses for auth callbacks, oauth redirects, etc.).
 */

export interface OriginCheckResult {
  ok: boolean;
  /** Reason the check failed — for logging only, not for client responses. */
  reason?: string;
}

/**
 * Returns { ok: true } when the request's Origin matches NEXT_PUBLIC_HOST_URL.
 * Callers should 403 on failure.
 *
 * Only compares scheme + host + port — path is irrelevant.
 */
export function checkSameOrigin(request: Request): OriginCheckResult {
  const expected = process.env.NEXT_PUBLIC_HOST_URL;
  if (!expected) {
    // Misconfigured server — fail closed rather than allow everything.
    return { ok: false, reason: 'NEXT_PUBLIC_HOST_URL not set' };
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return { ok: false, reason: 'missing Origin header' };
  }

  let originUrl: URL;
  let expectedUrl: URL;
  try {
    originUrl = new URL(origin);
    expectedUrl = new URL(expected);
  } catch {
    return { ok: false, reason: 'unparseable URL' };
  }

  if (
    originUrl.protocol !== expectedUrl.protocol ||
    originUrl.host !== expectedUrl.host
  ) {
    return { ok: false, reason: `origin mismatch: ${origin}` };
  }

  return { ok: true };
}
