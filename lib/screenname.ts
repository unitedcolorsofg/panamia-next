import { db } from '@/lib/db';
import { users, profiles, screennameHistory } from '@/lib/schema';
import { and, eq, ne, sql } from 'drizzle-orm';

// Reserved screennames that cannot be used
export const RESERVED_SCREENNAMES = [
  'admin',
  'administrator',
  'pana',
  'panamia',
  'support',
  'help',
  'system',
  'moderator',
  'mod',
  'staff',
  'official',
  'anonymous',
  'deleted',
  'former',
  'member',
  'user',
  'root',
  'api',
  'www',
  'mail',
  'email',
  'test',
  'null',
  'undefined',
];

// Screenname validation rules
const MIN_LENGTH = 3;
const MAX_LENGTH = 24;
const VALID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$/;
const SINGLE_CHAR_PATTERN = /^[a-zA-Z0-9]$/;

export interface ScreennameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a screenname format without checking database uniqueness.
 * Rules:
 * - 3-24 characters
 * - Alphanumeric, underscore, and hyphen only
 * - Cannot start or end with underscore or hyphen
 * - Not a reserved word
 */
export function validateScreenname(name: string): ScreennameValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Screenname is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Screenname must be at least ${MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Screenname must be no more than ${MAX_LENGTH} characters`,
    };
  }

  // For screennames of exactly 3 characters, allow single alphanumeric if length is 1
  // Otherwise check the pattern
  if (trimmed.length === 1) {
    if (!SINGLE_CHAR_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error:
          'Screenname must contain only letters, numbers, underscores, or hyphens',
      };
    }
  } else if (trimmed.length === 2) {
    // Two character names: both must be alphanumeric
    if (!/^[a-zA-Z0-9]{2}$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Screenname cannot start or end with underscore or hyphen',
      };
    }
  } else if (!VALID_PATTERN.test(trimmed)) {
    // Check if it contains invalid characters
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return {
        valid: false,
        error:
          'Screenname must contain only letters, numbers, underscores, or hyphens',
      };
    }
    // Otherwise it starts/ends with invalid chars
    return {
      valid: false,
      error: 'Screenname cannot start or end with underscore or hyphen',
    };
  }

  // Check reserved words (case-insensitive)
  if (RESERVED_SCREENNAMES.includes(trimmed.toLowerCase())) {
    return { valid: false, error: 'This screenname is reserved' };
  }

  return { valid: true };
}

/**
 * Checks if a screenname is available in the database.
 * Uses case-insensitive comparison.
 *
 * The namespace is FLAT and spans three tables, because /p/:handle and
 * acct:handle@domain resolve humans and businesses through the same path:
 *
 *   - `users.screenname`      — handles held by people
 *   - `profiles.screenname`   — handles held by profiles, including business
 *                               listings that have no user at all
 *   - `screennameHistory`     — retired handles, kept so federation 410-Gone
 *                               tombstones stay truthful and nobody can
 *                               impersonate a former identity
 *
 * Missing any one of them would let a business take a handle a person already
 * answers to (or vice versa), and the resolvers would then disagree about who
 * `@name` is.
 *
 * `excludeEmail` lets a human keep their own name during a rename;
 * `excludeProfileId` does the same for a listing, which is needed separately
 * because a business listing's email is the business's, not the owner's.
 */
export async function isScreennameAvailable(
  name: string,
  excludeEmail?: string,
  excludeProfileId?: string
): Promise<boolean> {
  // PostgreSQL case-insensitive search - check current users
  const conditions = [
    sql`lower(${users.screenname}) = lower(${name})`,
    ...(excludeEmail ? [ne(users.email, excludeEmail)] : []),
  ];

  const existingUser = await db.query.users.findFirst({
    where: and(...conditions),
  });

  if (existingUser) return false;

  // Check profiles — a claimed business listing holds its handle here and has
  // no users row to be found above.
  const profileConditions = [
    sql`lower(${profiles.screenname}) = lower(${name})`,
    ...(excludeProfileId ? [ne(profiles.id, excludeProfileId)] : []),
    // A person's own profile mirrors their handle, so a plain user rename must
    // not collide with itself.
    ...(excludeEmail
      ? [sql`lower(${profiles.email}) != lower(${excludeEmail})`]
      : []),
  ];

  const existingProfile = await db.query.profiles.findFirst({
    where: and(...profileConditions),
  });

  if (existingProfile) return false;

  // Check screenname history (cannot claim others' old names)
  // Allow user to reclaim their OWN old screenname
  if (excludeEmail) {
    // Historical: same screenname but not belonging to excludeEmail user
    const historical = await db
      .select({ id: screennameHistory.id })
      .from(screennameHistory)
      .innerJoin(users, eq(screennameHistory.userId, users.id))
      .where(
        and(
          sql`lower(${screennameHistory.screenname}) = lower(${name})`,
          sql`lower(${users.email}) != lower(${excludeEmail})`
        )
      )
      .limit(1);

    if (historical.length > 0) return false;
  } else {
    const historical = await db.query.screennameHistory.findFirst({
      where: sql`lower(${screennameHistory.screenname}) = lower(${name})`,
    });

    if (historical) return false;
  }

  return true;
}

/**
 * Full validation including database uniqueness check.
 */
export async function validateScreennameFull(
  name: string,
  excludeEmail?: string,
  excludeProfileId?: string
): Promise<ScreennameValidationResult> {
  const formatResult = validateScreenname(name);
  if (!formatResult.valid) {
    return formatResult;
  }

  const available = await isScreennameAvailable(
    name,
    excludeEmail,
    excludeProfileId
  );
  if (!available) {
    return { valid: false, error: 'This screenname is already taken' };
  }

  return { valid: true };
}
