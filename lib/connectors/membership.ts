import { and, eq, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import {
  HOUSES,
  PODS,
  type CommitmentProgress,
  type HouseId,
  type PodId,
  type TierId,
} from '@/lib/connectors/model';

/**
 * Connectors programme membership, as stored on `profiles.connector`.
 *
 * This is the real thing that replaced the fixture roster. The surface
 * originally shipped as a mock: a hardcoded demo connector was shown to
 * everybody, so a signed-in member was greeted by somebody else's name. The
 * column added in drizzle/0055_profile_connector.sql is what this module
 * reads and writes.
 *
 * ## Why parse rather than cast
 *
 * The sibling blobs on `profiles` are read with a straight `as` cast (see
 * `app/m/profile/page.tsx` doing `profile.mentoring as ProfileMentoring`).
 * That is fine when the only writer is a form you control and the only reader
 * renders a string. It is not fine here, because this blob decides programme
 * state: which houses you are in and what tier you are shown at.
 *
 * A cast asserts a shape that nothing checks. Anything already in the column —
 * written by an older build, hand-edited during support, or restored from a
 * backup taken before a shape change — would flow straight into the page and
 * fail somewhere further away, as a blank house pill or a crash in `getHouse`.
 * `parseConnector` instead returns `null` for anything it does not recognise,
 * so a malformed blob degrades to "not a connector yet" — a state the UI
 * already handles and the member can fix by joining again.
 *
 * It also drops unknown houses rather than rejecting the whole record, which
 * is what lets a house be retired from `HOUSES` without stranding every member
 * who had picked it.
 */

export interface ConnectorCommitment {
  id: string;
  what: string;
  /** Free text on purpose: "this month", "before the 14th", "Saturdays". */
  when: string | null;
  house: HouseId;
  progress: CommitmentProgress;
  createdAt: string;
}

export interface ProfileConnector {
  pod: PodId;
  houses: HouseId[];
  /**
   * Always 1 today. Stored rather than derived because tiers move over time
   * and the programme should be able to record that without a migration.
   */
  tier: TierId;
  /** What this person said they can bring. Free text, may be empty. */
  bring: string;
  joinedAt: string;
  commitments: ConnectorCommitment[];
}

const POD_IDS = new Set<string>(PODS.map((p) => p.id));
const HOUSE_IDS = new Set<string>(HOUSES.map((h) => h.id));
const PROGRESS: ReadonlySet<string> = new Set([
  'notSet',
  'inProgress',
  'done',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCommitment(value: unknown): ConnectorCommitment | null {
  if (!isRecord(value)) return null;

  const { id, what, when, house, progress, createdAt } = value;
  if (typeof id !== 'string' || !id) return null;
  if (typeof what !== 'string' || !what.trim()) return null;
  if (typeof house !== 'string' || !HOUSE_IDS.has(house)) return null;

  return {
    id,
    what: what.trim(),
    when: typeof when === 'string' && when.trim() ? when.trim() : null,
    house: house as HouseId,
    progress:
      typeof progress === 'string' && PROGRESS.has(progress)
        ? (progress as CommitmentProgress)
        : 'notSet',
    createdAt: typeof createdAt === 'string' ? createdAt : new Date(0).toISOString(),
  };
}

/**
 * Turn whatever is in the column into membership, or `null`.
 *
 * `null` is returned for a record with no recognised house as well as for a
 * malformed one. A connector who is in no house has nothing for HQ to show
 * and no way to reach the tier ladder, so treating that as "not joined yet"
 * routes them back to the form instead of to an empty dashboard.
 */
export function parseConnector(value: unknown): ProfileConnector | null {
  if (!isRecord(value)) return null;

  const pod = value.pod;
  if (typeof pod !== 'string' || !POD_IDS.has(pod)) return null;

  const houses = Array.isArray(value.houses)
    ? value.houses.filter(
        (h): h is HouseId => typeof h === 'string' && HOUSE_IDS.has(h)
      )
    : [];
  if (houses.length === 0) return null;

  const tier = value.tier;
  const commitments = Array.isArray(value.commitments)
    ? value.commitments
        .map(parseCommitment)
        .filter((c): c is ConnectorCommitment => c !== null)
    : [];

  return {
    pod: pod as PodId,
    houses: [...new Set(houses)],
    tier: tier === 1 || tier === 2 || tier === 3 ? (tier as TierId) : 1,
    bring: typeof value.bring === 'string' ? value.bring.trim() : '',
    joinedAt:
      typeof value.joinedAt === 'string'
        ? value.joinedAt
        : new Date(0).toISOString(),
    commitments,
  };
}

export interface ConnectorIdentity {
  profileId: string;
  /** What to greet them as. Falls back through the names a profile may have. */
  displayName: string;
  membership: ProfileConnector;
}

/**
 * The signed-in person's own membership, or `null` if they have not joined.
 *
 * Deliberately keyed on `profiles.userId` rather than going through
 * `getActiveProfile`. That helper resolves the profile somebody is *acting
 * as*, which may be a business listing they administer — and membership of
 * the Connectors programme belongs to the human, not to their shop. Using the
 * active profile would let one person hold several memberships and would put
 * a business's name in the HQ greeting.
 */
export async function getMyConnector(
  userId: string
): Promise<ConnectorIdentity | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true, name: true, screenname: true, email: true, connector: true },
  });
  if (!profile) return null;

  const membership = parseConnector(profile.connector);
  if (!membership) return null;

  return {
    profileId: profile.id,
    displayName:
      profile.name.trim() ||
      profile.screenname?.trim() ||
      profile.email.split('@')[0],
    membership,
  };
}

/**
 * How many connectors are in a pod.
 *
 * Uses the partial expression index from 0055. Counts real members only, so a
 * brand-new pod honestly reads 1 — you — rather than borrowing a number from
 * the fixtures it replaced.
 */
export async function countConnectorsInPod(pod: PodId): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.connector),
        sql`${profiles.connector} ->> 'pod' = ${pod}`
      )
    );

  return row?.count ?? 0;
}
