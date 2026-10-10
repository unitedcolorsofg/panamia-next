/**
 * DM Stream fan-out — the send half of the live delivery path.
 *
 * `getDmStream(env)` must be called from worker/index.ts at the start of every
 * request, same as `getStorage(env)` / `getEmail(env)`: Worker bindings are not
 * reachable from module scope, so application code gets at them through a cache
 * primed by the entry point.
 *
 * Everything here is **best-effort and non-fatal**. The message is already
 * durably in Postgres by the time any of this runs, and the ordinary read path
 * will find it. A failed notify costs the recipient a refresh; a notify that
 * threw into the send path would cost them the message. So every error is
 * swallowed and logged, and `notifyDirectMessage` never rejects.
 */

interface DurableObjectStubLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface DmStreamEnv {
  DM_STREAM?: DurableObjectNamespaceLike;
}

let cachedNamespace: DurableObjectNamespaceLike | null = null;

/**
 * How long the whole fan-out gets before the send stops waiting for it.
 *
 * The errors below are all *answers* — a thrown exception, a non-2xx, a missing
 * binding. A hang is none of those, and it is the one failure that would break
 * the promise this module makes: `createStatus` awaits this, so a mailbox that
 * accepts the subrequest and never replies would hold a send open on a row that
 * is already committed, and the pana would be told their message failed when it
 * did not. Two seconds is far above a healthy DO hop and far below anything a
 * person would wait through.
 */
const FANOUT_TIMEOUT_MS = 2_000;

export function getDmStream(
  env?: DmStreamEnv
): DurableObjectNamespaceLike | null {
  if (env?.DM_STREAM) {
    cachedNamespace = env.DM_STREAM;
  }
  return cachedNamespace;
}

/** One mailbox delivery: who to tell, and which thread it belongs to for them. */
export interface DmFanoutTarget {
  /** The actor whose mailbox receives this. */
  actorId: string;
  /**
   * The *other* party in the thread, from this recipient's point of view.
   *
   * Differs per target by necessity: a message from A to B belongs to B's
   * thread with A, and to A's thread with B. Null when there is no single
   * counterparty — a multi-recipient DM has no 1:1 thread to name, and the
   * client falls back to refreshing the conversation list.
   */
  conversationActorId: string | null;
}

/**
 * Tell each actor's mailbox that a direct status landed.
 *
 * Fans out in parallel and waits for the batch, so a slow mailbox cannot
 * serialise the rest. The await is bounded by the eight-recipient cap on
 * direct statuses.
 *
 * Returns the number of sockets that actually received it across all targets,
 * which is what makes the gap observable: targets minus delivered is the set of
 * members who will have to read this from Postgres instead. That count is also
 * where a push integration belongs — zero sockets for an actor is precisely the
 * "send an APNs/FCM notification instead" condition, since a mobile client's
 * socket dies the moment the OS suspends the app.
 */
export async function notifyDirectMessage(
  targets: DmFanoutTarget[],
  statusId: string
): Promise<number> {
  const namespace = getDmStream();

  // Unbound in plain-Node dev and in any environment without the binding. Not
  // an error: live delivery is an enhancement over the read path, so its
  // absence degrades to "refresh to see it" rather than failing the send.
  if (!namespace || targets.length === 0) return 0;

  const at = Date.now();

  // Cancels the in-flight subrequests where the runtime honours it, so a hung
  // mailbox is not left occupying a connection after we have stopped caring.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, FANOUT_TIMEOUT_MS);
  });

  const fanout = Promise.all(
    targets.map(async (target) => {
      try {
        const stub = namespace.get(namespace.idFromName(target.actorId));

        // The hostname is ignored — a DO stub fetch is routed by the stub, not
        // by DNS — but Request requires an absolute URL, so this names the
        // object it is addressing rather than inventing a host.
        const response = await stub.fetch('https://dm-stream/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            conversationActorId: target.conversationActorId,
            statusId,
            at,
          }),
        });

        if (!response.ok) return 0;
        const body = (await response.json()) as { delivered?: number };
        return body.delivered ?? 0;
      } catch (error) {
        // Logged rather than rethrown: see the module docblock. The caller is
        // mid-send on a row that is already committed.
        console.error(
          '[dm-stream] notify failed',
          target.actorId,
          error instanceof Error ? error.message : error
        );
        return 0;
      }
    })
  );

  try {
    const results = await Promise.race([fanout, expired]);

    if (results === null) {
      console.error('[dm-stream] notify timed out', targets.length, statusId);
      return 0;
    }

    return results.reduce((sum, n) => sum + n, 0);
  } finally {
    // The loser of the race is abandoned, not cancelled, so clear the timer to
    // avoid an abort firing against a batch that already finished.
    if (timer) clearTimeout(timer);
  }
}
