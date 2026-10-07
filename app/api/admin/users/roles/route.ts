import { NextResponse } from 'next/server';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { adminEmailList } from '@/lib/server/admin-emails';

/**
 * Everyone who currently holds a staff role.
 *
 * GET -> { success, data: RoleHolder[] }
 *
 * This is the inverse of /api/getUserList: that pages through every account
 * and reports each one's roles, so finding the four people who hold a role
 * costs a walk through everyone who does not. Staff want the four. The set is
 * small and bounded, so it is returned whole and unpaged.
 *
 * ## Why this is not one query
 *
 * Admin is the union of a column and an environment variable, and the two
 * disagree about what a person even is. `profiles.roles.admin` belongs to a
 * profile, which belongs to an account. `ADMIN_EMAILS` is a list of addresses
 * that may have no profile, and may have no account at all — a founder who has
 * never signed in is still an admin the moment they do.
 *
 * Reading the column alone would therefore report an empty admin list on a
 * site that has one. That is the mistake `moderationTeamEmails()` was written
 * to avoid, and it lands harder here: there, under-reporting lost a
 * notification; here it would tell an admin that nobody holds the role, which
 * invites granting it to someone who already has it, or concluding the tier is
 * empty and that the secret is no longer live.
 *
 * So: the column-holders, the accounts behind ADMIN_EMAILS, and the
 * ADMIN_EMAILS entries with no account yet — merged on user id, with addresses
 * that matched nothing surfaced rather than dropped.
 */

export interface RoleHolder {
  /** Null for an ADMIN_EMAILS address with no account yet. */
  userId: string | null;
  email: string;
  name: string | null;
  screenname: string | null;
  /** False when ADMIN_EMAILS names an address that has never signed in. */
  hasAccount: boolean;
  /** Where a column grant would be written. False means a grant cannot land. */
  hasProfile: boolean;
  /** Admin through ADMIN_EMAILS. Not revocable from the web. */
  isSuperAdmin: boolean;
  /** Admin through profiles.roles.admin. Revocable here. */
  grantedAdmin: boolean;
  /** The union the rest of the app actually checks. */
  isAdmin: boolean;
  isContentModerator: boolean;
}

type Row = {
  id: string;
  email: string;
  name: string | null;
  screenname: string | null;
  roles: unknown;
  profileId: number | string | null;
};

function toHolder(row: Row, superAdminEmails: Set<string>): RoleHolder {
  const roles = (row.roles ?? {}) as {
    admin?: boolean;
    contentModerator?: boolean;
  };
  const isSuperAdmin = superAdminEmails.has(row.email.trim().toLowerCase());
  const grantedAdmin = roles.admin === true;
  return {
    userId: row.id,
    email: row.email,
    name: row.name,
    screenname: row.screenname,
    hasAccount: true,
    hasProfile: row.profileId !== null && row.profileId !== undefined,
    isSuperAdmin,
    grantedAdmin,
    isAdmin: isSuperAdmin || grantedAdmin,
    isContentModerator: roles.contentModerator === true,
  };
}

export async function GET() {
  const actor = await checkAdminAuth();
  if (!actor) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  const envEmails = adminEmailList();
  const superAdminEmails = new Set(envEmails);

  // `->>` yields text, so a jsonb boolean true and the string "true" both
  // match. A NULL roles column yields NULL, which is not equal to 'true' and
  // so excludes the row — correct, and the reason this is not `!= 'false'`.
  const columnHolders = (await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      screenname: users.screenname,
      roles: profiles.roles,
      profileId: profiles.id,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      sql`${profiles.roles} ->> 'admin' = 'true' or ${profiles.roles} ->> 'contentModerator' = 'true'`
    )) as Row[];

  // Lowered on both sides: ADMIN_EMAILS is parsed lowercase, while the stored
  // address is whatever the provider sent. Comparing raw would drop a founder
  // whose account spells their address with a capital.
  const envRows = envEmails.length
    ? ((await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          screenname: users.screenname,
          roles: profiles.roles,
          profileId: profiles.id,
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(inArray(sql`lower(${users.email})`, envEmails))) as Row[])
    : [];

  const byUserId = new Map<string, RoleHolder>();
  for (const row of [...columnHolders, ...envRows]) {
    // The two queries overlap whenever a founder also holds the column. Both
    // produce the same holder, so last write wins harmlessly.
    byUserId.set(row.id, toHolder(row, superAdminEmails));
  }

  const holders: RoleHolder[] = [...byUserId.values()];

  // An ADMIN_EMAILS entry that matched no account. Shown rather than dropped:
  // this is a real and confusing state — the address is an admin in every
  // check the app makes, and will be one in person the moment it signs in, but
  // there is nobody to point at. Omitting it silently makes a typo'd secret
  // look identical to a correct one.
  const seenEmails = new Set(holders.map((h) => h.email.trim().toLowerCase()));
  for (const email of envEmails) {
    if (seenEmails.has(email)) continue;
    holders.push({
      userId: null,
      email,
      name: null,
      screenname: null,
      hasAccount: false,
      hasProfile: false,
      isSuperAdmin: true,
      grantedAdmin: false,
      isAdmin: true,
      isContentModerator: false,
    });
  }

  holders.sort((a, b) =>
    (a.name || a.screenname || a.email).localeCompare(
      b.name || b.screenname || b.email
    )
  );

  return NextResponse.json({ success: true, data: holders });
}
