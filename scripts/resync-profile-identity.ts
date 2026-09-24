#!/usr/bin/env npx tsx
/**
 * Resync profiles.name and profiles.screenname from the users row.
 *
 * A profile carries its own copy of both, and it — not users — is what the
 * account menu, posts, and listings render. profiles.name is NOT NULL, so it
 * gets seeded with `users.name || screenname` when the profile is created (see
 * app/api/user/screenname/set/route.ts); for a magic-link signup with no name
 * yet, that lands on the handle.
 *
 * Nothing revised it afterwards: app/api/saveSessionUser/route.ts, the route
 * the settings form calls, wrote users and stopped there. So a member could set
 * their name and still see their handle everywhere. Both routes mirror now —
 * this repairs the accounts stranded before that fix, which would otherwise
 * stay wrong until their owner happened to save the form again.
 *
 * Safe to run repeatedly. For a personal profile these columns are derived,
 * never independently edited: no route lets a member or an admin set
 * profiles.name on their own identity profile.
 *
 * Business listings are excluded. A business is normally administered through
 * profile_owners, but some were historically welded to profiles.userId (see
 * scripts/audit-profile-claims.ts), and renaming one to its owner's name would
 * be destructive and hard to notice.
 *
 * Usage:
 *   POSTGRES_URL=... npx tsx scripts/resync-profile-identity.ts [--apply]
 *
 * Defaults to a dry run. Pass --apply to write.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import * as schema from '../lib/schema';

const { users, profiles } = schema;

/**
 * Mirrors notBusinessListing in lib/server/profile-owners.ts. Inlined rather
 * than imported because that module pulls in the app's shared db client, and
 * this script owns its own connection.
 *
 * IS DISTINCT FROM rather than <>, because status is NULL on most rows and
 * NULL <> 'business_intake' is NULL, which would filter out every row.
 */
const notBusinessListing = sql`(${profiles.status}->>'source' IS DISTINCT FROM 'business_intake')`;

async function main() {
  const apply = process.argv.includes('--apply');

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    const rows = await db
      .select({
        profileId: profiles.id,
        profileName: profiles.name,
        profileScreenname: profiles.screenname,
        userName: users.name,
        userScreenname: users.screenname,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(and(isNotNull(profiles.userId), notBusinessListing));

    console.log(`${rows.length} personal profile(s) examined.`);

    let nameFixes = 0;
    let screennameFixes = 0;

    for (const row of rows) {
      const patch: { name?: string; screenname?: string } = {};

      // Only when the user actually has a name. Blank would violate NOT NULL,
      // and the screenname fallback already sitting there is the right answer.
      const userName = row.userName?.trim();
      if (userName && userName !== row.profileName) {
        patch.name = userName;
      }

      const userScreenname = row.userScreenname?.trim();
      if (userScreenname && userScreenname !== row.profileScreenname) {
        patch.screenname = userScreenname;
      }

      if (Object.keys(patch).length === 0) continue;

      if (patch.name) {
        console.log(
          `  name        ${row.profileId}: ${JSON.stringify(row.profileName)} -> ${JSON.stringify(patch.name)}`
        );
        nameFixes++;
      }
      if (patch.screenname) {
        console.log(
          `  screenname  ${row.profileId}: ${JSON.stringify(row.profileScreenname)} -> ${JSON.stringify(patch.screenname)}`
        );
        screennameFixes++;
      }

      if (apply) {
        await db
          .update(profiles)
          .set(patch)
          .where(eq(profiles.id, row.profileId));
      }
    }

    if (nameFixes === 0 && screennameFixes === 0) {
      console.log('Everything already in sync. Nothing to do.');
      return;
    }

    console.log(
      `\n${apply ? 'Applied' : 'Dry run'}: ${nameFixes} name(s), ${screennameFixes} screenname(s).`
    );
    if (!apply) console.log('Re-run with --apply to write these changes.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
