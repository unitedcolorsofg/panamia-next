/**
 * Redaction for anything on its way to a log.
 *
 * wrangler.jsonc sets `observability.enabled` with `head_sampling_rate: 1`,
 * so every console call in the Worker is captured and retained by Cloudflare,
 * queryable from the dashboard. Logs are not ephemeral here. Anything written
 * to them is stored, and it is stored somewhere with a different access model
 * from the database -- dashboard access, not database credentials.
 *
 * That matters because the two worst leaks in this codebase were not careless
 * console.log calls. They were helpers that look like good practice:
 *
 * 1. `describeDbError()` surfaces Postgres's DETAIL line. Verified against
 *    real Postgres, a unique violation produces:
 *
 *        Key (email)=(jane.doe@example.com) already exists.
 *
 *    So every duplicate-email signup wrote that address into retained logs.
 *
 * 2. Drizzle's DrizzleQueryError is built as:
 *
 *        `Failed query: ${query}\nparams: ${params}`
 *
 *    (node_modules/drizzle-orm/errors.js:12). The bound parameters are in the
 *    message. Logging a failed insert logs the row -- name, email, phone,
 *    whatever was being written.
 *
 * Neither is visible at the call site. `console.error('failed', err)` looks
 * harmless and is not. That is the argument for redacting centrally rather
 * than asking each caller to remember: the dangerous cases are the ones
 * nobody recognises as dangerous.
 *
 * WHAT THIS IS NOT
 *
 * Not a guarantee. A determined pattern can always evade a matcher, and
 * free-text fields (a bio, a message body) can contain anything. This removes
 * the structured, predictable leaks -- the ones that occur on every failure
 * rather than by chance. Deleting a log line that never needed PII is still
 * better than redacting it, and several call sites were fixed that way.
 *
 * Correlation is preserved through userId and profileId, which are internal
 * identifiers rather than personal data: they are useless without database
 * access, which is the thing log access is meant not to grant.
 */

/** Values are replaced with these so a reader can see what was removed. */
const EMAIL_TOKEN = '[email]';
const PHONE_TOKEN = '[phone]';
const REDACTED = '[redacted]';

const MAX_DEPTH = 6;
const MAX_STRING = 4000;

/**
 * Keys whose values are personal data regardless of what they contain.
 *
 * Matched case-insensitively against camelCase and snake_case. Deliberately
 * broader than the columns that exist today -- a key named `emailAddress`
 * should be caught without anyone having to add it here first.
 */
const SENSITIVE_KEY = new RegExp(
  [
    'e?mail',
    'phone',
    'telephone',
    'mobile',
    'password',
    'passwd',
    'secret',
    'token',
    'api_?key',
    'authorization',
    'cookie',
    'private_?key',
    'ip_?address',
    'user_?agent',
    'street',
    'address_?line',
    'postal',
    'zip_?code',
    'date_?of_?birth',
    'ssn',
  ].join('|'),
  'i'
);

/**
 * Keys that look sensitive to the matcher above but are not, and whose value
 * is worth keeping. `emailVerified` is a boolean; redacting it would remove
 * the only interesting thing about it.
 */
const SENSITIVE_KEY_EXCEPTIONS =
  /^(email_?verified|has_?email|email_?opt_?in|address_?type|ip_?country)$/i;

// RFC 5322 in full is not worth it. This matches what people actually type,
// and the cost of a false positive in a log line is low.
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/**
 * Phone numbers, deliberately conservative.
 *
 * A bare run of digits is not matched: timestamps, byte counts, row counts
 * and IDs are all digit runs, and redacting those would make logs useless
 * while protecting nobody. Requires either an international prefix or
 * separator punctuation in the shape people write phone numbers.
 */
const PHONE_PATTERN =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b|\+\d{10,15}\b/g;

/**
 * Postgres constraint violations: `Key (email)=(jane@example.com) exists.`
 *
 * The column name is the useful half -- it says which constraint rejected the
 * write -- so it is kept and only the value is removed.
 */
const PG_KEY_DETAIL = /Key \(([^)]*)\)=\(([^)]*)\)/g;

/**
 * Drizzle puts bound parameters in the error message. Everything after
 * `params:` is row data by definition, so it goes wholesale.
 */
const DRIZZLE_PARAMS = /\bparams:.*$/s;

/** Redacts the well-known structured carriers, then free-floating PII. */
export function redactString(input: string): string {
  const truncated =
    input.length > MAX_STRING
      ? `${input.slice(0, MAX_STRING)}… [truncated]`
      : input;

  return truncated
    .replace(PG_KEY_DETAIL, (_m, column) => `Key (${column})=${REDACTED}`)
    .replace(DRIZZLE_PARAMS, `params: ${REDACTED}`)
    .replace(EMAIL_PATTERN, EMAIL_TOKEN)
    .replace(PHONE_PATTERN, PHONE_TOKEN);
}

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY_EXCEPTIONS.test(key)) return false;
  return SENSITIVE_KEY.test(key);
}

/**
 * Deep-copies `value` with personal data removed.
 *
 * Never mutates its input: logging must not be able to change program state,
 * or a redaction bug becomes a data-corruption bug.
 */
export function redact(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return redactString(value);

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (depth >= MAX_DEPTH) return '[depth limit]';

  // Errors are the main thing people log, and the interesting parts are not
  // enumerable, so a generic object walk would silently drop them.
  if (value instanceof Error) {
    const out: Record<string, unknown> = {
      name: value.name,
      message: redactString(value.message),
    };
    if (value.stack) out.stack = redactString(value.stack);
    if ((value as { cause?: unknown }).cause !== undefined) {
      out.cause = redact((value as { cause?: unknown }).cause, depth + 1, seen);
    }
    // postgres.js hangs its fields off a plain object, and drizzle keeps
    // `params` as an own property. Both are enumerable, so pick them up too.
    for (const [k, v] of Object.entries(value)) {
      if (k in out) continue;
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
    }
    return out;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[circular]';
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => redact(item, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
    }
    return out;
  }

  if (typeof value === 'function') return '[function]';

  return String(value);
}
