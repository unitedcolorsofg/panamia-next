/**
 * The one definition of "is this address in ADMIN_EMAILS".
 *
 * This predicate is the founder tier — it decides who may grant admin to
 * somebody else — so it must not be re-implemented per call site. It was
 * already open-coded in three places with the same four lines of parsing, and
 * a privilege check that exists three times is a privilege check that can
 * disagree with itself after a careless edit. One of those copies deciding
 * that case matters, or forgetting to trim, is a silent authorization bug in
 * either direction.
 *
 * Read from the environment on every call rather than cached at module load:
 * Workers reuse an isolate across requests, so a cached list would keep a
 * stale value after a secret update until the isolate recycled. The parse is
 * a split on a short string and is not worth caching.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailList().includes(email.trim().toLowerCase());
}

/**
 * The parsed ADMIN_EMAILS list, lowercased and trimmed, empty when unset.
 *
 * An unset variable yields an empty list, which makes every `isAdminEmail`
 * call false. That is the intended failure direction: a missing secret locks
 * admin down rather than opening it up. It also means a deploy that forgets
 * the secret presents as "nobody can grant admin", which is noisy and
 * recoverable, instead of "anybody can", which is neither.
 */
export function adminEmailList(): string[] {
  return (
    process.env.ADMIN_EMAILS?.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}
