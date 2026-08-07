import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbInstance } from '@/lib/db';
import { relayGroups, relayGroupMembers } from '@/lib/schema';
import type { RelayGroupJoinPolicy } from '@/lib/schema';
import { matureGroupLeaves } from '@/lib/relay/group-maturation';

// Lifecycle rules for member-created NIP-29 groups (/r/groups). Membership
// mechanics — the 24h leave debounce and mature-on-read sweep — stay in
// lib/relay/group-maturation.ts; this module owns what happens to the GROUP
// when its roster changes.
//
// Two rules, both triggered by a departure:
//   1. If the departing member held creator rights, they pass to the
//      longest-tenured remaining member. There is no user-facing "owner"
//      concept, so this is silent — nobody is notified and nothing in the UI
//      names it. It exists only so metadata edits and invites always have
//      someone authorized to perform them.
//   2. If nobody is left, the group is deleted outright.
//
// Both run AFTER matureGroupLeaves, never instead of it: a leave sits in
// relay_group_leave_pending for the debounce window, so a group emptied by its
// last member disappears when that leave matures, not at the moment the button
// is clicked. Collapsing the group early would leave the relay emitting
// metadata for a group panamia had already forgotten.
//
// Groups with created_by IS NULL were provisioned by panamia (panamia-test,
// panamia-public) and are exempt from rule 2 — an empty system group is a
// group nobody has joined yet, not garbage.

// Group ids are NIP-29 `h` tag values, matched by isValidGroupId in
// app/api/internal/relay/group-event/route.ts. Keep the two in sync.
const GROUP_ID_PATTERN = /^[a-zA-Z0-9_.\-:]+$/;
const GROUP_ID_MAX = 128;

export function isValidGroupId(id: string): boolean {
  return (
    id.length > 0 && id.length <= GROUP_ID_MAX && GROUP_ID_PATTERN.test(id)
  );
}

// Mint a group id from a human name: a slug plus a short random suffix. The
// suffix is what makes two groups called "Little Haiti Mutual Aid" possible;
// the slug is what makes the id readable in a Nostr client that shows raw
// h-tags. Falls back to a bare "group" stem when the name is entirely
// non-ASCII, since the id alphabet has no room for it.
export function mintGroupId(name: string): string {
  const stem =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'group';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stem}-${suffix}`;
}

// `discoverable` controls whether the relay emits public kind-39000 metadata.
// Members pick a join policy, not a visibility flag, so the two are derived
// from one choice: an open group is browsable here AND advertised there.
export function discoverableFor(policy: RelayGroupJoinPolicy): boolean {
  return policy === 'open';
}

export interface DepartureOutcome {
  // True when the group was removed because the last member left.
  deleted: boolean;
  // Set when creator rights moved to someone else.
  reassignedTo?: string;
}

// Apply both departure rules to one group. Safe to call when the pubkey
// argument never held creator rights, or when the group still has members —
// each rule no-ops unless its condition holds.
//
// Runs in a single transaction so a concurrent join cannot land between the
// emptiness check and the delete, which would otherwise drop a group out from
// under a member who had just joined it.
export async function applyDepartureRules(
  db: DbInstance,
  groupId: string
): Promise<DepartureOutcome> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select({
        groupId: relayGroups.groupId,
        createdBy: relayGroups.createdBy,
      })
      .from(relayGroups)
      .where(eq(relayGroups.groupId, groupId))
      .limit(1);

    if (!group) return { deleted: false };

    // System-provisioned groups opt out of both rules: there is no creator to
    // reassign and an empty one is not garbage.
    if (!group.createdBy) return { deleted: false };

    const remaining = await tx
      .select({
        pubkey: relayGroupMembers.pubkey,
        joinedAt: relayGroupMembers.joinedAt,
      })
      .from(relayGroupMembers)
      .where(eq(relayGroupMembers.groupId, groupId))
      .orderBy(asc(relayGroupMembers.joinedAt))
      .limit(1);

    if (remaining.length === 0) {
      // Cascades take relay_group_members, the two pending tables, and
      // relay_group_invites with it.
      await tx.delete(relayGroups).where(eq(relayGroups.groupId, groupId));
      return { deleted: true };
    }

    // Creator still in the roster — nothing to do.
    const stillAMember = await tx
      .select({ exists: sql<number>`1` })
      .from(relayGroupMembers)
      .where(
        and(
          eq(relayGroupMembers.groupId, groupId),
          eq(relayGroupMembers.pubkey, group.createdBy)
        )
      )
      .limit(1);

    if (stillAMember.length > 0) return { deleted: false };

    const heir = remaining[0].pubkey;
    await tx
      .update(relayGroups)
      .set({ createdBy: heir })
      .where(eq(relayGroups.groupId, groupId));

    return { deleted: false, reassignedTo: heir };
  });
}

// Mature pending leaves for a group, then apply the departure rules to
// whatever roster is left. This is the pairing every caller of
// matureGroupLeaves wants — maturation is what actually empties a roster, so
// it is the only moment a group can become deletable.
//
// Returns the pubkeys swept out alongside the lifecycle outcome. A `deleted`
// result means the group row is gone: callers reading group state afterward
// must treat it as a 404 rather than assuming their earlier read is still
// valid.
export async function matureAndSettle(
  db: DbInstance,
  groupId: string
): Promise<DepartureOutcome & { matured: string[] }> {
  const matured = await matureGroupLeaves(db, groupId);
  // Nothing left the roster, so neither rule can have changed state.
  if (matured.length === 0) return { deleted: false, matured };
  const outcome = await applyDepartureRules(db, groupId);
  return { ...outcome, matured };
}
