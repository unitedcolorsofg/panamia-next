/**
 * Tests for auth sessions not storing request telemetry.
 *
 * Three different risks, tested three different ways.
 *
 * The first is that the stripping itself is wrong -- that a populated IP or
 * user-agent survives into the insert. That is a pure function, so it is
 * tested directly against the real one, with values that look like the real
 * thing rather than sentinels.
 *
 * The second is that the function is correct but unreachable. A stripper
 * nobody calls protects nobody, and the way this breaks is not by someone
 * editing the function -- it is by someone refactoring auth.ts and dropping a
 * hook that looked redundant next to the `after` hook doing visible work. So
 * the structural test reads auth.ts and fails if the hook is not wired into
 * better-auth's session create path.
 *
 * The third is the slow one: someone builds a feature on data we deliberately
 * no longer keep. An "active devices" screen reading `session.ipAddress` would
 * now render empty strings for everyone, and would look like a display bug
 * rather than a deliberate absence. The last test fails on any session-scoped
 * read of these fields so that conversation happens at review time.
 *
 * What is deliberately NOT tested here: that better-auth calls the hook at
 * all. That is the library's contract, verified by reading its source
 * (db/with-hooks.mjs merges `result.data` over the pending insert, and
 * db/internal-adapter.mjs assigns these fields in `createSession` and nowhere
 * else). Asserting it here would mean reimplementing better-auth in a mock and
 * testing the mock.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BLANKED,
  SESSION_TELEMETRY_FIELDS,
  stripSessionTelemetry,
} from '@/lib/legal/session-telemetry';

const repoRoot = process.cwd();

/** A session insert as better-auth would hand it to the hook. */
const pendingSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess_01HQ',
  userId: 'usr_01HQ',
  token: 'tok_abc123',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
  ipAddress: '203.0.113.42',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  ...overrides,
});

describe('stripSessionTelemetry', () => {
  it('blanks a populated IP address', () => {
    const { data } = stripSessionTelemetry(pendingSession());
    assert.equal(data.ipAddress, BLANKED);
  });

  it('blanks a populated user-agent', () => {
    const { data } = stripSessionTelemetry(pendingSession());
    assert.equal(data.userAgent, BLANKED);
  });

  it('blanks every field it claims to cover', () => {
    // Driven off the exported list rather than a restated one, so adding a
    // field to SESSION_TELEMETRY_FIELDS without handling it fails here.
    const { data } = stripSessionTelemetry(pendingSession());
    for (const field of SESSION_TELEMETRY_FIELDS) {
      assert.equal(
        (data as Record<string, unknown>)[field],
        BLANKED,
        `${field} was not blanked`
      );
    }
  });

  it('blanks an IPv6 address', () => {
    const { data } = stripSessionTelemetry(
      pendingSession({ ipAddress: '2001:db8::8a2e:370:7334' })
    );
    assert.equal(data.ipAddress, BLANKED);
  });

  it('leaves the rest of the session untouched', () => {
    const input = pendingSession();
    const { data } = stripSessionTelemetry(input);
    assert.equal(data.id, input.id);
    assert.equal(data.userId, input.userId);
    assert.equal(data.token, input.token);
    assert.equal(data.expiresAt, input.expiresAt);
  });

  it('preserves fields it has never heard of', () => {
    // better-auth spreads `...rest` into the insert, and plugins add columns.
    const { data } = stripSessionTelemetry(
      pendingSession({ impersonatedBy: 'usr_admin' })
    );
    assert.equal((data as Record<string, unknown>).impersonatedBy, 'usr_admin');
  });

  it('does not mutate the object it was given', () => {
    // better-auth keeps its own reference to the pending insert; mutating it
    // would be a side effect on the caller's data.
    const input = pendingSession();
    stripSessionTelemetry(input);
    assert.equal(input.ipAddress, '203.0.113.42');
  });

  it('returns the { data } envelope better-auth merges', () => {
    // with-hooks.mjs: `if (typeof result === "object" && "data" in result)`.
    // Returning a bare object would be silently ignored.
    const result = stripSessionTelemetry(pendingSession());
    assert.equal(typeof result, 'object');
    assert.ok('data' in result, 'hook result must carry a `data` key');
  });

  it('is idempotent on an already-blank session', () => {
    const { data } = stripSessionTelemetry(
      pendingSession({ ipAddress: '', userAgent: '' })
    );
    assert.equal(data.ipAddress, BLANKED);
    assert.equal(data.userAgent, BLANKED);
  });

  it('blanks rather than deletes, so the insert keeps its shape', () => {
    // The columns still exist and better-auth still writes them. Removing the
    // keys entirely would let the adapter fall back to its own values.
    const { data } = stripSessionTelemetry(pendingSession());
    assert.ok('ipAddress' in data);
    assert.ok('userAgent' in data);
  });

  it('writes a value better-auth itself produces', () => {
    // better-auth writes "" when headers are missing, so "" is already in the
    // column's domain. NULL would not be.
    assert.equal(BLANKED, '');
  });
});

describe('the stripper is wired into better-auth', () => {
  const authSource = readFileSync(join(repoRoot, 'auth.ts'), 'utf8');

  it('imports the stripper from the privacy module', () => {
    assert.match(
      authSource,
      /import\s*\{[^}]*\bstripSessionTelemetry\b[^}]*\}\s*from\s*'@\/lib\/legal\/session-telemetry'/,
      'auth.ts must import stripSessionTelemetry'
    );
  });

  it('calls it from the session create.before hook', () => {
    // Anchored on `session: { create: {` so the user hook above cannot satisfy
    // this, and non-greedy so the comment between `create` and `before` is
    // allowed to grow.
    assert.match(
      authSource,
      /session:\s*\{\s*create:\s*\{[\s\S]*?before:[\s\S]*?stripSessionTelemetry/,
      'session.create.before must call stripSessionTelemetry'
    );
  });

  it('wires before ahead of after, so nothing reads the raw values first', () => {
    const sessionHook = authSource.slice(
      authSource.search(/session:\s*\{\s*create:\s*\{/)
    );
    const before = sessionHook.indexOf('before:');
    const after = sessionHook.indexOf('after:');
    assert.ok(before !== -1, 'session.create.before must exist');
    assert.ok(after === -1 || before < after, 'before must precede after');
  });
});

describe('the purge migration', () => {
  const sql = readFileSync(
    join(repoRoot, 'drizzle', '0044_purge_session_telemetry.sql'),
    'utf8'
  );

  it('clears both columns on existing rows', () => {
    assert.match(sql, /UPDATE\s+sessions/i);
    assert.match(sql, /ip_address\s*=\s*''/i);
    assert.match(sql, /user_agent\s*=\s*''/i);
  });

  it('does not log anyone out', () => {
    // Blanking telemetry must not touch tokens or expiry.
    assert.doesNotMatch(sql, /^\s*(DELETE\s+FROM\s+sessions|TRUNCATE)/im);
    assert.doesNotMatch(sql, /\btoken\s*=/i);
    assert.doesNotMatch(sql, /\bexpires_at\s*=/i);
  });

  it('is registered in the migration journal', () => {
    // A migration file that is not in the journal never runs.
    const journal = JSON.parse(
      readFileSync(join(repoRoot, 'drizzle', 'meta', '_journal.json'), 'utf8')
    ) as { entries: { tag: string }[] };
    assert.ok(
      journal.entries.some((e) => e.tag === '0044_purge_session_telemetry'),
      'migration must be registered in _journal.json'
    );
  });
});

describe('nothing consumes session telemetry', () => {
  // Scoped to session-qualified access so legitimate client-side
  // `navigator.userAgent` feature detection is untouched.
  const FORBIDDEN = /\b(session|sessions)\s*\.\s*(ipAddress|userAgent)\b/;

  const SEARCH_ROOTS = ['app', 'lib', 'components', 'scripts'];
  const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);
  const ALLOWED = new Set([
    // The stripper names the fields in order to erase them.
    join('lib', 'legal', 'session-telemetry.ts'),
  ]);

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  };

  const sourceFiles = SEARCH_ROOTS.flatMap((root) => {
    const full = join(repoRoot, root);
    try {
      return statSync(full).isDirectory() ? walk(full) : [];
    } catch {
      return [];
    }
  });

  it('found a source tree to scan', () => {
    // Guards against a moved directory making the scan below pass vacuously.
    assert.ok(
      sourceFiles.length > 100,
      `expected a populated source tree, scanned ${sourceFiles.length} files`
    );
  });

  it('has no reader of session IP or user-agent', () => {
    const offenders = sourceFiles.filter((file) => {
      const relative = file.slice(repoRoot.length + 1);
      if (ALLOWED.has(relative)) return false;
      return FORBIDDEN.test(readFileSync(file, 'utf8'));
    });

    assert.deepEqual(
      offenders.map((f) => f.slice(repoRoot.length + 1)),
      [],
      'these files read session telemetry that is no longer collected -- ' +
        'they will see empty strings for every member'
    );
  });
});
