import { sql } from 'drizzle-orm';
import type { DbInstance } from '@/lib/db';

// NIP-29 leave debounce window. A user-issued kind 9022 advisory is held in
// relay_group_leave_pending for this many seconds before it actually mutates
// the roster. A subsequent kind 9021 (join) from the same pubkey + group_id
// within this window cancels the pending leave (auto-grant rejoin), so
// shallow-misclick / flap noise never reaches the public roster state.
//
// Constant on purpose — operators who want to tune this should edit it here
// rather than make it env-driven.
export const LEAVE_DEBOUNCE_SECONDS = 86400; // 24h

// Mature any leaves in relay_group_leave_pending for this group that have
// outlived the debounce window: delete the pending row AND remove the user
// from relay_group_members. Single-statement CTE so the two deletes are
// atomic — there is no "matured but not yet applied" intermediate state.
//
// Returns the pubkeys whose departure was just materialized. Callers may
// use this list for logging, admin-UI surfacing, or — eventually — pushing
// fresh 39001/39002 emissions back to the relay. Today, the relay sees the
// updated roster on its next /api/internal/relay/group/:id fetch (60s
// cache TTL bounds the staleness window for active subscribers).
//
// Called from:
//   - /api/internal/relay/group/:id     (relay's lazy NIP-29 emission)
//   - /api/internal/relay/group-event   (immediately after an advisory)
//   - admin UI group-detail page        (so admins see live state)
//
// Hot paths that cannot afford a write (e.g. /api/internal/relay/check on
// every cold-cache pubkey lookup) use filter-on-read against this table
// instead — see `matureLeavePredicate` below.
export async function matureGroupLeaves(
  db: DbInstance,
  groupId: string
): Promise<string[]> {
  const result = await db.execute(sql`
    WITH matured AS (
      DELETE FROM relay_group_leave_pending
      WHERE group_id = ${groupId}
        AND requested_at < now() - interval '${sql.raw(String(LEAVE_DEBOUNCE_SECONDS))} seconds'
      RETURNING pubkey
    )
    DELETE FROM relay_group_members
    USING matured
    WHERE relay_group_members.group_id = ${groupId}
      AND relay_group_members.pubkey = matured.pubkey
    RETURNING relay_group_members.pubkey
  `);
  // postgres-js returns an array of row objects on .execute()
  return (result as unknown as Array<{ pubkey: string }>).map((r) => r.pubkey);
}

// SQL fragment for filter-on-read membership checks. Use as a NOT-EXISTS
// subquery inside any membership query that needs to be hot-path-safe (no
// destructive writes). A row in relay_group_leave_pending older than the
// debounce window is treated as if the user has already left, even though
// the relay_group_members row hasn't been cleaned up yet — the next
// matureGroupLeaves call against that group does the actual cleanup.
//
// Usage:
//   .where(
//     and(
//       eq(relayGroupMembers.pubkey, pubkey),
//       sql`NOT EXISTS (${maturedLeaveExists})`
//     )
//   )
export const maturedLeaveExists = sql`
  SELECT 1 FROM relay_group_leave_pending p
  WHERE p.group_id = relay_group_members.group_id
    AND p.pubkey = relay_group_members.pubkey
    AND p.requested_at < now() - interval '${sql.raw(String(LEAVE_DEBOUNCE_SECONDS))} seconds'
`;
