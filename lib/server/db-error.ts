// Postgres error details, flattened for logging.
//
// Drizzle wraps driver errors as `Failed query: <sql>` and hangs the real
// postgres error off `.cause`. Everything that identifies the failure —
// SQLSTATE, the constraint that rejected the write, the offending detail
// line — lives on that cause object, so a bare `err.message` in a catch block
// throws away the only information worth having. Several routes were doing
// exactly that; this exists so they can stop.
//
// postgres.js exposes these as plain enumerable properties rather than a typed
// error class, hence the structural read instead of an instanceof check.
//
// PRIVACY: two of these fields carry row values, which is not obvious from
// their names and was verified rather than assumed:
//
//   detail — Postgres writes the offending value into the DETAIL line. Run
//            against real Postgres, a duplicate email produces exactly:
//                Key (email)=(jane.doe@example.com) already exists.
//
//   query  — Drizzle builds its message as `Failed query: ${query}\nparams:
//            ${params}` (drizzle-orm/errors.js:12), so the bound parameters
//            are inside it. A failed insert therefore carries the whole row.
//
// Both are redacted here rather than at the call sites. Callers spread this
// object straight into a log and have no reason to suspect either field, so
// leaving it to them would mean relying on everyone knowing something that is
// not visible from where they are standing. Redaction keeps the column name
// and the constraint — the parts that actually explain the failure.

import { redactString } from '@/lib/log/redact';

export interface DbErrorDetails {
  message: string;
  // SQLSTATE, e.g. '23503' foreign_key_violation, '23505' unique_violation,
  // '57014' query_canceled (statement timeout).
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
  // Drizzle's wrapper message, which carries the SQL that failed.
  query?: string;
}

const redactOptional = (v: string | undefined): string | undefined =>
  v === undefined ? undefined : redactString(v);

export function describeDbError(err: unknown): DbErrorDetails {
  const top = err instanceof Error ? err : new Error(String(err));
  const cause = (top as { cause?: unknown }).cause;
  const pg = (cause ?? {}) as Record<string, unknown>;

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  return {
    message: redactString(
      str((pg as { message?: unknown }).message) ?? top.message
    ),
    code: str(pg.code),
    constraint: str(pg.constraint_name) ?? str(pg.constraint),
    table: str(pg.table_name) ?? str(pg.table),
    column: str(pg.column_name) ?? str(pg.column),
    detail: redactOptional(str(pg.detail)),
    query: cause ? redactString(top.message) : undefined,
  };
}

// True for the "this row already exists" family, which callers routinely treat
// as a 409 rather than a fault. Matches on SQLSTATE first and falls back to the
// message so it still works if the driver ever stops populating `code`.
export function isUniqueViolation(err: unknown): boolean {
  const { code, message } = describeDbError(err);
  return code === '23505' || /duplicate key/i.test(message);
}
