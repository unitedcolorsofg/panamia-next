/**
 * Who may manage an event.
 *
 * Before groups could host, this was a one-line comparison repeated at six
 * call sites: `profile.id === event.hostProfileId`. Those lines still read as
 * if they are correct once a group hosts, which is exactly the danger -- with
 * `host_profile_id` NULL on a group-hosted row they quietly evaluate to false
 * for *everyone*, and the event becomes unmanageable rather than insecure.
 * Failing closed is the right default, but six independent copies of it is not
 * a place to add a second branch six times.
 *
 * So the rule lives here once, and the six sites ask instead of comparing.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { socialActors, socialGroupMembers } from '@/lib/schema';

/**
 * The host columns, and nothing else. Taking a narrow shape rather than a
 * whole event row means callers that selected only a few columns can still
 * use this, and it keeps the predicate honest about what it actually reads.
 */
export interface EventHostRef {
  hostProfileId: string | null;
  hostGroupId: string | null;
}

/**
 * Roles that can manage a group's events.
 *
 * Moderators are included deliberately: a group big enough to need moderators
 * is a group whose admin should not be the only one who can fix a typo in the
 * time. Plain members are not -- posting in a group is not the same as
 * speaking for it, which is the same line Phase 3 drew for group posts.
 */
const MANAGING_ROLES = ['admin', 'moderator'] as const;

/**
 * True when `viewerProfileId` may edit, publish, or see the attendees of an
 * event with these hosts.
 *
 * Returns false rather than throwing for a signed-out viewer, so callers keep
 * their existing `notFound()` / 403 behaviour.
 */
export async function canManageEvent(
  event: EventHostRef,
  viewerProfileId: string | null | undefined
): Promise<boolean> {
  if (!viewerProfileId) return false;

  // A pana hosting in their own name.
  if (event.hostProfileId) return event.hostProfileId === viewerProfileId;

  if (!event.hostGroupId) {
    // The events_single_host CHECK makes this unreachable. If it ever happens,
    // no one manages the event rather than everyone.
    return false;
  }

  // A group hosting. The viewer's social actor is the membership key, so a
  // profile with social disabled simply has no membership and no access.
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.profileId, viewerProfileId),
    columns: { id: true },
  });
  if (!actor) return false;

  const membership = await db.query.socialGroupMembers.findFirst({
    where: and(
      eq(socialGroupMembers.groupId, event.hostGroupId),
      eq(socialGroupMembers.actorId, actor.id),
      eq(socialGroupMembers.status, 'active')
    ),
    columns: { role: true },
  });
  if (!membership) return false;

  return (MANAGING_ROLES as readonly string[]).includes(membership.role);
}

/**
 * The groups `viewerProfileId` may host an event as.
 *
 * Used by the create form to build its host selector and by the create route
 * to authorize the choice. Both call this rather than trusting a group id from
 * the client.
 */
export async function listHostableGroups(
  viewerProfileId: string
): Promise<{ id: string; handle: string; name: string }[]> {
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.profileId, viewerProfileId),
    columns: { id: true },
  });
  if (!actor) return [];

  const rows = await db.query.socialGroupMembers.findMany({
    where: and(
      eq(socialGroupMembers.actorId, actor.id),
      eq(socialGroupMembers.status, 'active')
    ),
    columns: { role: true },
    with: {
      group: {
        columns: { id: true },
        with: {
          actor: { columns: { username: true, name: true } },
        },
      },
    },
  });

  return rows
    .filter((row) => (MANAGING_ROLES as readonly string[]).includes(row.role))
    .flatMap((row) => {
      const handle = row.group?.actor?.username;
      if (!row.group || !handle) return [];
      return [
        {
          id: row.group.id,
          handle,
          name: row.group.actor?.name ?? handle,
        },
      ];
    });
}
