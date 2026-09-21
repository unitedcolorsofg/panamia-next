// Shared "is this user allowed to use the Resilience module" gate.
//
// Resilience requires a profile row AND a screenname (the immutable handle
// that doubles as the NIP-05 local part and the kind-0 `name`). We surface a
// structured `missing` list so the client can link the user to the right page
// for each gap.
//
// Membership tier is deliberately NOT checked here. The authoritative paid
// gate lives in the relay membership check (`active` + `membershipLevel`,
// see docs/RESILIENCE-ROADMAP.md). This gate answers a narrower question:
// does the account have enough identity to publish a coherent kind 0?
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export type ReadinessGap = 'profile' | 'screenname';

export interface ReadinessSnapshot {
  ready: boolean;
  missing: ReadinessGap[];
  // Lowercased screenname when present — convenient for downstream callers
  // that need the canonical handle (e.g. the kind 0 seed).
  screenname: string | null;
  profile: {
    id: string;
    name: string;
    descriptions: unknown;
    primaryImageCdn: string | null;
  } | null;
}

// A profile row plus a name is all the kind 0 seed actually needs: /api/relay/
// profile-seed derives `name` from the screenname and treats `about` and
// `picture` as optional. Requiring become-a-pana fields here (locallyBased,
// descriptions.details, descriptions.fiveWords) made this gate STRICTER than
// the relay's own membership check, so a paid member could satisfy
// /api/internal/relay/check and still be refused by the /r UI. Those fields
// describe a directory listing, not readiness to federate — consumer accounts
// legitimately have none of them.
export async function getProfileReadiness(
  userId: string
): Promise<ReadinessSnapshot> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { screenname: true },
    with: {
      profile: {
        columns: {
          id: true,
          name: true,
          descriptions: true,
          primaryImageCdn: true,
        },
      },
    },
  });

  const missing: ReadinessGap[] = [];
  const profile = row?.profile;
  const profileComplete = !!profile && !!profile.name?.trim();
  if (!profileComplete) missing.push('profile');
  if (!row?.screenname?.trim()) missing.push('screenname');

  return {
    ready: missing.length === 0,
    missing,
    screenname: row?.screenname ? row.screenname.toLowerCase() : null,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          descriptions: profile.descriptions,
          primaryImageCdn: profile.primaryImageCdn ?? null,
        }
      : null,
  };
}
