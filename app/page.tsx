import { headers } from 'next/headers';
import { resolveSurface } from '@/lib/panaverse/surfaces';
import { HomePage } from '@/components/home/home-page';
import { FeedPage } from './s/_components/feed-page';

/**
 * The root of the shared route tree, which is a different front door on each
 * surface hostname.
 *
 * Both surfaces answer on one route tree, so `/` cannot be handed to either of
 * them structurally: a route group would still resolve to `/` and collide with
 * this file. The only thing distinguishing the two requests is the hostname, so
 * that is what this branches on. pana.social/ is the homepage and
 * social.pana.social/ is the feed.
 *
 * Deciding here rather than rewriting in the Worker is forced. vinext has no
 * middleware-rewrite signalling, so serving `/s` under the URL `/` would leave
 * the client router fetching RSC payloads for a path the server does not think
 * it is on. Branching inside the route keeps URL and route identical, so
 * payload paths agree and client navigation stays intact.
 *
 * This moves a front door, not a route: every surface route remains reachable
 * from every hostname, and /s still serves the feed on both.
 */
export default async function RootPage() {
  const requestHeaders = await headers();
  const surface = resolveSurface(requestHeaders.get('host') ?? '');

  return surface.rootPath === '/' ? <HomePage /> : <FeedPage />;
}
