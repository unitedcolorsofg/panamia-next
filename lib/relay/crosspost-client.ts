/**
 * Calls the panamia-nosflare relay worker at /internal/articles/crosspost.
 *
 * Threads the Service Binding (env.RELAY) from worker/index.ts down to the
 * Next.js API route via a module-level cache, mirroring the getDb()/getStorage()
 * pattern in lib/db.ts and lib/r2.ts. In Node-dev (server.js) there is no
 * env, so we fall back to an HTTP call against RELAY_INTERNAL_URL.
 *
 * CROSSPOST_AUTH_TOKEN is a random shared secret intentionally not unique to
 * panamia-resilience: other federated Pana instances and partner organizations
 * may be issued the same value so they can publish kind-30023 articles to the
 * same Nostr relay under the relay's pubkey. See the comment in
 * external/nosflare/src/article-crosspost.ts for the trust model.
 */

interface RelayBinding {
  fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
}

interface RelayEnv {
  RELAY?: RelayBinding;
  CROSSPOST_AUTH_TOKEN?: string;
  RELAY_INTERNAL_URL?: string;
}

let cachedRelay: RelayBinding | null = null;
let cachedToken: string | null = null;
let cachedHttpUrl: string | null = null;

export function getRelay(env?: RelayEnv): void {
  if (env?.RELAY) cachedRelay = env.RELAY;
  if (env?.CROSSPOST_AUTH_TOKEN) cachedToken = env.CROSSPOST_AUTH_TOKEN;
  if (env?.RELAY_INTERNAL_URL) cachedHttpUrl = env.RELAY_INTERNAL_URL;
}

// Pana articles are a multi-author publishing model, not single-author: a
// first author, accepted co-authors, and an approved reviewer ("reviewed
// by"). Mirrors panamia.club's articles.{authorId, coAuthors, reviewedBy}.
// Each contributor with an enrolled Nostr key becomes a ["p", ...] tag, and
// all are named in the article's byline footer.
export type ContributorRole = 'author' | 'coauthor' | 'reviewer';

export interface ArticleContributor {
  role: ContributorRole;
  name?: string; // display name for the byline
  pubkey?: string; // hex Nostr pubkey, if enrolled
}

export interface ArticleCrosspostInput {
  slug: string;
  title: string;
  summary?: string;
  content: string;
  tags?: string[];
  articleType?: string;
  publishedAt?: number;
  coverImage?: string;
  coverImageAlt?: string; // NIP-92 imeta alt; falls back to the title
  // Attribution / rights metadata threaded into the kind-30023 event (tags +
  // a content footer). Articles are signed by the shared relay key, so these
  // carry the human bylines the signing pubkey can't. The resilience schema
  // currently persists only the first author, so contributors holds one entry
  // today; co-authors/reviewers populate once those columns are restored.
  contributors?: ArticleContributor[];
  license?: string; // SPDX-ish label, e.g. "CC-BY-SA-4.0"
  licenseUrl?: string; // canonical license URL
  canonicalUrl?: string; // source-of-truth URL on this instance -> ["r", ...]
}

export interface ArticleCrosspostResult {
  eventId: string;
  results: { url: string; ok: boolean; error?: string }[];
  note?: string;
}

export async function crosspostArticle(
  input: ArticleCrosspostInput
): Promise<ArticleCrosspostResult> {
  const token = cachedToken ?? process.env.CROSSPOST_AUTH_TOKEN;
  if (!token) {
    throw new Error('CROSSPOST_AUTH_TOKEN not configured');
  }

  const body = JSON.stringify(input);
  const headers = {
    'Content-Type': 'application/json',
    'X-Crosspost-Auth': token,
  };

  let response: Response;
  if (cachedRelay) {
    // Service binding: any URL works, the binding routes to the relay worker.
    response = await cachedRelay.fetch(
      'https://internal/internal/articles/crosspost',
      { method: 'POST', headers, body }
    );
  } else {
    const url =
      cachedHttpUrl ??
      process.env.RELAY_INTERNAL_URL ??
      'https://relay.pana.social/internal/articles/crosspost';
    response = await fetch(url, { method: 'POST', headers, body });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`crosspost failed: ${response.status} ${text}`);
  }
  return (await response.json()) as ArticleCrosspostResult;
}

// ---------------------------------------------------------------------------
// Event crosspost (NIP-52 kind-31923 time-based calendar event).
//
// Mirrors crosspostArticle: same Service-Binding / RELAY_INTERNAL_URL fallback
// and X-Crosspost-Auth channel, but reaches POST /internal/events/crosspost and
// the relay builds a kind-31923 event from these fields. Postgres stays
// authoritative; this is an OUTBOUND mirror only. The relay signs with its own
// key, so the host is named in a content footer rather than via the signature.
// ---------------------------------------------------------------------------
export interface EventCrosspostInput {
  slug: string; // d tag — stable replaceable identity per relay key
  title: string;
  description?: string;
  summary?: string;
  startsAt: number; // unix seconds
  endsAt?: number; // unix seconds
  timezone?: string; // IANA tzid, e.g. "America/New_York"
  mode: 'online' | 'offline' | 'hybrid';
  venueName?: string;
  city?: string;
  geohash?: string;
  capacity?: number;
  image?: string;
  imageAlt?: string; // NIP-92 imeta alt; falls back to the title
  tags?: string[]; // hashtags -> ["t", ...]
  hostName?: string; // byline in the content footer (relay key signs)
  canonicalUrl?: string; // source-of-truth URL on this instance -> ["r", ...]
}

export interface EventCrosspostResult {
  eventId: string;
  results: { url: string; ok: boolean; error?: string }[];
  note?: string;
}

export async function crosspostEvent(
  input: EventCrosspostInput
): Promise<EventCrosspostResult> {
  const token = cachedToken ?? process.env.CROSSPOST_AUTH_TOKEN;
  if (!token) {
    throw new Error('CROSSPOST_AUTH_TOKEN not configured');
  }

  const body = JSON.stringify(input);
  const headers = {
    'Content-Type': 'application/json',
    'X-Crosspost-Auth': token,
  };

  let response: Response;
  if (cachedRelay) {
    response = await cachedRelay.fetch(
      'https://internal/internal/events/crosspost',
      { method: 'POST', headers, body }
    );
  } else {
    const base =
      cachedHttpUrl?.replace(/\/internal\/.*$/, '') ??
      process.env.RELAY_INTERNAL_URL?.replace(/\/internal\/.*$/, '') ??
      'https://relay.pana.social';
    response = await fetch(`${base}/internal/events/crosspost`, {
      method: 'POST',
      headers,
      body,
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`event crosspost failed: ${response.status} ${text}`);
  }
  return (await response.json()) as EventCrosspostResult;
}

export interface RemoveEventResult {
  removed: string[];
  count: number;
}

/**
 * Asks the relay to delete one or more events by id from its storage — used by
 * the abuse "Remove from Relay" moderation action, which takes down both the
 * reported content and the report event itself. Same Service-Binding +
 * CROSSPOST_AUTH channel as crosspostArticle(); reaches POST
 * /internal/events/remove.
 */
export async function removeRelayEvents(
  eventIds: string[]
): Promise<RemoveEventResult> {
  const token = cachedToken ?? process.env.CROSSPOST_AUTH_TOKEN;
  if (!token) {
    throw new Error('CROSSPOST_AUTH_TOKEN not configured');
  }

  const body = JSON.stringify({ event_ids: eventIds });
  const headers = {
    'Content-Type': 'application/json',
    'X-Crosspost-Auth': token,
  };

  let response: Response;
  if (cachedRelay) {
    response = await cachedRelay.fetch(
      'https://internal/internal/events/remove',
      { method: 'POST', headers, body }
    );
  } else {
    const base =
      cachedHttpUrl?.replace(/\/internal\/.*$/, '') ??
      process.env.RELAY_INTERNAL_URL?.replace(/\/internal\/.*$/, '') ??
      'https://relay.pana.social';
    response = await fetch(`${base}/internal/events/remove`, {
      method: 'POST',
      headers,
      body,
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`event removal failed: ${response.status} ${text}`);
  }
  return (await response.json()) as RemoveEventResult;
}
