import { getPrisma } from '@/lib/prisma';

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
 * Also checks screenname history to prevent claiming old names.
 */
export async function isScreennameAvailable(
  name: string,
  excludeEmail?: string
): Promise<boolean> {
  const prisma = await getPrisma();

  // PostgreSQL case-insensitive search - check current users
  const existingUser = await prisma.user.findFirst({
    where: {
      screenname: { equals: name, mode: 'insensitive' },
      ...(excludeEmail ? { NOT: { email: excludeEmail } } : {}),
    },
  });

  if (existingUser) return false;

  // Check screenname history (cannot claim others' old names)
  // Allow user to reclaim their OWN old screenname
  const historical = await prisma.screennameHistory.findFirst({
    where: {
      screenname: { equals: name, mode: 'insensitive' },
      // Allow user to reclaim their own old screenname
      ...(excludeEmail
        ? {
            NOT: {
              user: { email: { equals: excludeEmail, mode: 'insensitive' } },
            },
          }
        : {}),
    },
  });

  if (historical) return false;

  return true;
}

/**
 * Full validation including database uniqueness check.
 */
export async function validateScreennameFull(
  name: string,
  excludeEmail?: string
): Promise<ScreennameValidationResult> {
  const formatResult = validateScreenname(name);
  if (!formatResult.valid) {
    return formatResult;
  }

  const available = await isScreennameAvailable(name, excludeEmail);
  if (!available) {
    return { valid: false, error: 'This screenname is already taken' };
  }

  return { valid: true };
}
