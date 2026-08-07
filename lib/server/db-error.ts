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

export function describeDbError(err: unknown): DbErrorDetails {
  const top = err instanceof Error ? err : new Error(String(err));
  const cause = (top as { cause?: unknown }).cause;
  const pg = (cause ?? {}) as Record<string, unknown>;

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  return {
    message: str((pg as { message?: unknown }).message) ?? top.message,
    code: str(pg.code),
    constraint: str(pg.constraint_name) ?? str(pg.constraint),
    table: str(pg.table_name) ?? str(pg.table),
    column: str(pg.column_name) ?? str(pg.column),
    detail: str(pg.detail),
    query: cause ? top.message : undefined,
  };
}

// True for the "this row already exists" family, which callers routinely treat
// as a 409 rather than a fault. Matches on SQLSTATE first and falls back to the
// message so it still works if the driver ever stops populating `code`.
export function isUniqueViolation(err: unknown): boolean {
  const { code, message } = describeDbError(err);
  return code === '23505' || /duplicate key/i.test(message);
}
