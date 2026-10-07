import { headers } from 'next/headers';
import { resolveSurface } from '@/lib/panaverse/surfaces';
import { HomePage } from '@/components/home/home-page';
import { AdminHub } from '@/components/Admin/hub';
import { ConnectorsFrontDoor } from '@/components/connectors/front-door';
import { FeedPage } from './s/_components/feed-page';

/**
 * The root of the shared route tree, which is a different front door on each
 * surface hostname.
 *
 * Every surface answers on one route tree, so `/` cannot be handed to any of
 * them structurally: a route group would still resolve to `/` and collide with
 * this file. The only thing distinguishing the requests is the hostname, so
 * that is what this branches on.
 *
 * Deciding here rather than rewriting in the Worker is forced. vinext has no
 * middleware-rewrite signalling, so serving `/s` under the URL `/` would leave
 * the client router fetching RSC payloads for a path the server does not think
 * it is on. Branching inside the route keeps URL and route identical, so
 * payload paths agree and client navigation stays intact.
 *
 * This moves a front door, not a route: every surface route remains reachable
 * from every hostname, and `/s`, `/connectors` and `/admin` still serve the
 * same pages on all of them.
 *
 * ## Why this is a switch and not a condition
 *
 * It used to read `surface.rootPath === '/' ? <HomePage /> : <FeedPage />`,
 * which quietly meant "anything that is not the main site is the feed". That
 * was true while there were two surfaces and became a bug the moment there
 * were more: `connectors.pana.social/` served the Pana Social feed. It was
 * only ever latent because subdomain links are behind `PANAVERSE_SUBDOMAINS`,
 * but the hostname branch does not consult that flag — `connectors.localhost`
 * resolves without DNS, so the wrong page was one dev URL away the whole time.
 *
 * An exhaustive switch over `surface.id` means the next surface added cannot
 * silently inherit somebody else's homepage: it fails to compile until this
 * file says what its front door is.
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const requestHeaders = await headers();
  const surface = resolveSurface(requestHeaders.get('host') ?? '');
  const { as } = await searchParams;

  switch (surface.id) {
    case 'social':
      return <FeedPage />;
    case 'connectors':
      return <ConnectorsFrontDoor as={as} />;
    case 'admin':
      return <AdminHub as={as} path="/" />;
    case 'www':
      return <HomePage />;
  }
}
