/**
 * /.well-known/apple-app-site-association — iOS Universal Links.
 *
 * Apple's half of what assetlinks.json does for Android: the site states which
 * app may open its links, and iOS fetches this before honouring any of them.
 *
 * Three details about this file are unforgiving, and all three are why it is a
 * route handler rather than a file in public/:
 *
 *  - The path has no extension. `apple-app-site-association.json` is not
 *    fetched; iOS asks for this exact name.
 *  - It must be served as application/json. A static host guessing text/plain
 *    from the missing extension is enough to fail the association.
 *  - It must answer 200 with no redirect. iOS does not follow one here, so an
 *    apex-to-www redirect silently breaks it.
 *
 * @see https://developer.apple.com/documentation/xcode/supporting-associated-domains
 */

import { NextResponse } from 'next/server';
import { MOBILE_APP_ID } from '@/lib/mobile/app-identity';

export function GET() {
  /* The Team ID prefix, from the Apple Developer account's membership page.
   * Environment-driven for the same reason the Android fingerprints are: it
   * identifies one specific developer account, so it cannot be a constant that
   * every preview deploy repeats. */
  const teamId = process.env.APPLE_APP_TEAM_ID?.trim();

  /* Same reasoning as assetlinks.json: an association naming no app is a
   * cacheable claim that no app owns these links, which is worse than saying
   * nothing at all. */
  if (!teamId) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${MOBILE_APP_ID}`],

            /* Evaluated in order, first match wins — which is the whole reason
             * the exclusion is written above the catch-all rather than below
             * it, where it would never be reached.
             *
             * The catch-all is deliberate: the app is the entire site, both
             * surfaces included, so any page worth linking to is a page worth
             * opening in it.
             *
             * /api/* is the exception, and it is not a technicality. Sign-in
             * finishes by landing on a callback under /api/auth — the OAuth
             * redirect and the magic-link verification both do. A member who
             * starts signing in inside Safari and is yanked into the app at
             * that exact moment has handed the session cookie to a different
             * cookie store than the one the flow began in: Safari is left
             * signed out holding a half-finished flow, and the link looks
             * broken in a way that is very hard to attribute. Excluding the
             * API surface lets a flow finish wherever it started. */
            components: [{ '/': '/api/*', exclude: true }, { '/': '/*' }],
          },
        ],
      },
    },
    {
      headers: {
        /* Explicit rather than inherited. NextResponse.json sets this already,
         * but it is the single most common reason a Universal Link silently
         * fails to verify, so it is stated here where anyone debugging that
         * will be looking. */
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
