// Shared "is this user allowed to use the Resilience module" gate.
//
// Resilience requires a completed become-a-pana profile AND a screenname
// (the immutable handle that doubles as the NIP-05 local part and the
// kind-0 `name`). We surface a structured `missing` list so the client can
// link the user to the right page for each gap.
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

interface Descriptions {
  details?: string;
  fiveWords?: string;
}

// `locallyBased` is set only by /form/become-a-pana, so its presence is the
// cleanest signal that the multi-page form was actually submitted (vs. a
// blank profile row created by some other flow). We additionally require
// descriptions.details + descriptions.fiveWords, which are the form's
// "tell us about yourself" required fields.
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
          locallyBased: true,
          descriptions: true,
          primaryImageCdn: true,
        },
      },
    },
  });

  const missing: ReadinessGap[] = [];
  const profile = row?.profile;
  const descriptions = profile?.descriptions as Descriptions | null | undefined;
  const profileComplete =
    !!profile &&
    !!profile.name?.trim() &&
    !!profile.locallyBased?.trim() &&
    !!descriptions?.details?.trim() &&
    !!descriptions?.fiveWords?.trim();
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
