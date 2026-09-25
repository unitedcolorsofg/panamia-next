// Client-side batching for story ring state.
//
// Rings mount independently -- one per avatar, scattered down a feed or a
// pana list, with no component in a position to know about the others. Left
// alone each would fetch its own state and a feed would open with fifty
// requests for fifty coloured borders.
//
// So the request is deferred instead of sent. Rings register a username, the
// queue waits a frame for its neighbours to mount, and everyone who asked in
// that window is answered by one call. A single ring on a profile page pays
// one animation frame for this and nothing else.

import type { StorySummary } from '@/lib/federation/wrappers/stories';

/** How long to wait for neighbouring rings before sending. */
const BATCH_WINDOW_MS = 16;

/**
 * How long an answer stays good.
 *
 * Short, because this is the data that goes stale in the ways people notice:
 * a ring still lit after they watched, or missing right after they posted.
 * Both of those paths invalidate explicitly -- this only bounds the drift
 * from stories posted or expired elsewhere while the page sits open.
 */
const CACHE_TTL_MS = 60_000;

/** Matches MAX_USERNAMES on the route. */
const MAX_PER_REQUEST = 100;

interface CacheEntry {
  value: StorySummary | null;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Array<(value: StorySummary | null) => void>>();
let flushHandle: ReturnType<typeof setTimeout> | null = null;

function fresh(username: string): CacheEntry | undefined {
  const hit = cache.get(username);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(username);
    return undefined;
  }
  return hit;
}

async function flush() {
  flushHandle = null;
  if (pending.size === 0) return;

  const batch = [...pending.keys()].slice(0, MAX_PER_REQUEST);
  const waiters = new Map<string, Array<(v: StorySummary | null) => void>>();
  for (const username of batch) {
    waiters.set(username, pending.get(username)!);
    pending.delete(username);
  }

  // Anything over the cap stays queued for the next window rather than being
  // dropped, so an oversized list degrades into two requests instead of
  // missing rings.
  if (pending.size > 0) schedule();

  let data: Record<string, StorySummary> = {};
  try {
    const res = await fetch(
      `/api/social/stories/summary?usernames=${encodeURIComponent(batch.join(','))}`
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success) data = json.data ?? {};
    }
  } catch {
    // Offline or the route is down. Every ring resolves to null and renders
    // as a plain avatar, which is the correct failure: no ring is a quieter
    // wrong answer than a ring that opens an empty viewer.
  }

  const now = Date.now();
  for (const [username, callbacks] of waiters) {
    // Absent from the response means no social actor for that pana -- common
    // on business profiles. Cached as null so it is not re-asked every mount.
    const value = data[username] ?? null;
    cache.set(username, { value, at: now });
    for (const cb of callbacks) cb(value);
  }
}

function schedule() {
  if (flushHandle !== null) return;
  flushHandle = setTimeout(() => void flush(), BATCH_WINDOW_MS);
}

/**
 * Ring state for one pana, coalesced with every other ring that asks in the
 * same window. Resolves to null when there is nothing to draw.
 */
export function getStorySummary(
  username: string
): Promise<StorySummary | null> {
  const hit = fresh(username);
  if (hit) return Promise.resolve(hit.value);

  return new Promise((resolve) => {
    const existing = pending.get(username);
    if (existing) {
      // Same username already queued this window -- the same actor can appear
      // several times in one feed. One request, several resolutions.
      existing.push(resolve);
    } else {
      pending.set(username, [resolve]);
    }
    schedule();
  });
}

/**
 * Drop a cached answer. Call after posting, watching or deleting, where the
 * ring's appearance is a direct consequence of something the viewer just did
 * and must not wait out the TTL.
 */
export function invalidateStorySummary(username: string) {
  cache.delete(username);
}
