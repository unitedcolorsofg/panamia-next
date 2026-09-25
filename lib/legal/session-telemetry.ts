/**
 * Auth-session telemetry minimization.
 *
 * better-auth records the client IP address and user-agent string on every
 * session it creates (`createSession` in better-auth's internal adapter sets
 * `ipAddress` and `userAgent` from the request headers). Those land in our
 * own `sessions` table, attached to `user_id` -- so they are identity-linked,
 * not anonymous request logs.
 *
 * WHY WE BLANK THEM RATHER THAN RETAIN AND EXPIRE THEM
 *
 * Three facts, each verified against this codebase rather than assumed:
 *
 *   1. Nothing reads them. A sweep of app/, lib/, components/, scripts/ and
 *      auth.ts finds no reader of `sessions.ipAddress` or `sessions.userAgent`
 *      -- the only references are the column definitions themselves. They were
 *      collected because the library collects them, not because we use them.
 *
 *   2. They were never disclosed. `lib/legal/data-inventory.ts` classifies
 *      `sessions` as 'account', and the 'account' category in
 *      app/legal/privacy/policy.json lists its data as email, password_hash,
 *      screenname and name -- no IP, no user-agent -- and describes its source
 *      as "You provide", which an IP address is not. Every mention of
 *      ip_address in the policy points at Cloudflare (the 'analytics'
 *      category, declared storage-free in the inventory, and the Cloudflare
 *      processor entry). A member reading our policy would reasonably conclude
 *      we do not hold their IP ourselves.
 *
 *   3. Nothing deleted them. Session rows are removed only on email migration
 *      and account deletion; better-auth's only automatic cleanup covers
 *      verification tokens. An expired session kept its IP indefinitely.
 *
 * Data we do not use, did not disclose and never deleted is not a retention
 * problem to be solved with a scheduled job -- it is data we should not be
 * keeping. Not collecting it is a stronger guarantee than promising to delete
 * it later: there is no window, no job to fail, and nothing to leak in a
 * backup taken before the job ran.
 *
 * WHY NOT `advanced.ipAddress.disableIpTracking`
 *
 * better-auth exposes that flag, and it looks like the obvious lever, but it
 * is the wrong tool here. Its rate limiter does:
 *
 *     const ip = getIP(req, ctx.options);
 *     if (!ip && ctx.options.advanced?.ipAddress?.disableIpTracking) return null;
 *
 * Returning null skips rate limiting for that request. On a passwordless
 * magic-link system the sign-in endpoint sends email to any address handed to
 * it, so unmetered requests mean anyone can be mailbombed through us. Turning
 * the flag on would trade a storage problem for an abuse problem.
 *
 * Blanking at the database-write boundary keeps both properties: the rate
 * limiter still resolves the IP from request headers in memory, and the
 * database simply never receives it.
 *
 * WHY EMPTY STRING RATHER THAN NULL
 *
 * better-auth already writes `""` for both fields when a request arrives
 * without usable headers (`getIP(headers, options) || ""`). Empty string is
 * therefore a value the column already holds in normal operation, so nothing
 * downstream can be surprised by it. Writing NULL would introduce a value
 * better-auth never produces on its own.
 */

/**
 * The session fields better-auth populates from request headers that we
 * decline to store. Exported so tests can assert coverage without restating
 * the list, and so the set is greppable if better-auth adds another.
 */
export const SESSION_TELEMETRY_FIELDS = ['ipAddress', 'userAgent'] as const;

export type SessionTelemetryField = (typeof SESSION_TELEMETRY_FIELDS)[number];

/** The value written in place of collected telemetry. See module header. */
export const BLANKED = '';

/**
 * Strips request-derived telemetry from a session row before it is inserted.
 *
 * Shaped to be returned directly from better-auth's `databaseHooks.session
 * .create.before` hook, which merges `result.data` over the pending insert:
 *
 *     if (typeof result === "object" && "data" in result)
 *       actualData = { ...actualData, ...result.data };
 *
 * This is the single write path -- `createSession` is the only place
 * better-auth assigns these fields, and no update path touches them -- so
 * enforcing here covers every sign-in, including magic links and OAuth.
 */
export function stripSessionTelemetry<T extends Record<string, unknown>>(
  session: T
): { data: T & Record<SessionTelemetryField, string> } {
  return {
    data: {
      ...session,
      ipAddress: BLANKED,
      userAgent: BLANKED,
    },
  };
}
