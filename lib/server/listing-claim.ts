import { db } from '@/lib/db';
import { verification } from '@/lib/schema';
import { and, eq, like } from 'drizzle-orm';
import { createUniqueString } from '@/lib/standardized';

/**
 * Single-use tokens proving control of the email address on a listing.
 *
 * Claiming is "show me you read the business inbox". That is the same proof
 * the implicit sign-in claim has always used, just made explicit and moved off
 * the identity link: consuming a token grants a profile_owners row rather than
 * setting profiles.userId, so claiming a business never overwrites the
 * claimant's own profile and one person can hold several.
 *
 * Stored in better-auth's verification_tokens table rather than a new one —
 * same shape, same lifecycle, already swept. Rows are namespaced by an
 * identifier prefix and every query filters on it, so this code can never read
 * or delete a better-auth magic-link row (burning someone's sign-in link would
 * be a nasty way to fail).
 */
const IDENTIFIER_PREFIX = 'listing-claim';

/** Long enough to be unguessable, short enough that a stale link stops working. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

export interface ClaimTokenTarget {
  profileId: string;
  userId: string;
}

/**
 * The token is bound to BOTH the listing and the requesting account. Anyone who
 * intercepts the link still cannot claim the business into their own account —
 * verification checks the session against the userId encoded here.
 */
function identifierFor(profileId: string, userId: string): string {
  return `${IDENTIFIER_PREFIX}:${profileId}:${userId}`;
}

export async function createClaimToken(
  profileId: string,
  userId: string
): Promise<string> {
  // Two draws: ~160 bits of entropy each, well past guessable.
  const token = `${createUniqueString()}${createUniqueString()}`;

  // Requesting a new link invalidates the previous one, so a forwarded or
  // leaked older email goes dead the moment the real owner asks again.
  await db
    .delete(verification)
    .where(eq(verification.identifier, identifierFor(profileId, userId)));

  const now = new Date();
  await db.insert(verification).values({
    identifier: identifierFor(profileId, userId),
    value: token,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });

  return token;
}

/**
 * Redeem a token. Returns null for anything not currently valid — unknown,
 * already used, or expired — without distinguishing them to the caller, since
 * the difference is only useful to someone probing.
 */
export async function consumeClaimToken(
  token: string
): Promise<ClaimTokenTarget | null> {
  if (!token) return null;

  // The identifier filter is load-bearing: it scopes the lookup to our own
  // rows so a better-auth token passed in here is never matched or deleted.
  const row = await db.query.verification.findFirst({
    where: and(
      eq(verification.value, token),
      like(verification.identifier, `${IDENTIFIER_PREFIX}:%`)
    ),
  });

  if (!row) return null;

  // Burn it before validating expiry — a token that reaches this point is
  // spent either way, and that keeps redemption single-use under a double
  // click or a mail client that prefetches links.
  await db.delete(verification).where(eq(verification.id, row.id));

  if (row.expiresAt.getTime() < Date.now()) return null;

  const [, profileId, userId] = row.identifier.split(':');
  if (!profileId || !userId) return null;

  return { profileId, userId };
}

/**
 * "h•••@example.com" — enough for the requester to recognise the inbox they
 * need to open, without publishing a business's contact address to anyone who
 * can load the page.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '•••';
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
