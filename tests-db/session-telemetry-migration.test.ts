/**
 * Runs migration 0044 against real Postgres.
 *
 * The unit test asserts the migration's *text* matches what we intend. That
 * catches a rewrite, but it cannot catch SQL that does not parse, or an UPDATE
 * whose WHERE clause silently matches nothing. Both of those fail silently in
 * the worst way: the deploy succeeds, the migration is marked applied, and the
 * IP addresses are still sitting in the table.
 *
 * So this executes the actual file -- read from disk, not restated here -- in
 * PGlite (Postgres compiled to WASM), against rows that look like the ones it
 * will meet in production. If someone edits the migration into something that
 * does not run, or that clears the wrong thing, this goes red.
 *
 * The table definition below is deliberately minimal: only the columns the
 * migration reads or writes, plus the ones it must leave alone.
 */

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

const MIGRATION = join(
  process.cwd(),
  'drizzle',
  '0044_purge_session_telemetry.sql'
);

let db: PGlite;

type SessionRow = {
  id: string;
  user_id: string;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
};

before(async () => {
  db = new PGlite();

  await db.exec(`
    CREATE TABLE sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      token text NOT NULL,
      expires_at timestamptz NOT NULL,
      ip_address text,
      user_agent text
    );
  `);

  // The four shapes these columns actually take in the wild: a populated
  // IPv4 session, an IPv6 one, a row better-auth already blanked because the
  // request had no usable headers, and a NULL from before the column was
  // consistently written.
  await db.exec(`
    INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent) VALUES
      ('s_v4',    'u_1', 'tok_v4',    NOW() + interval '7 days', '203.0.113.42',           'Mozilla/5.0 (Macintosh)'),
      ('s_v6',    'u_2', 'tok_v6',    NOW() + interval '7 days', '2001:db8::8a2e:370:7334', 'Mozilla/5.0 (X11; Linux)'),
      ('s_blank', 'u_3', 'tok_blank', NOW() + interval '7 days', '',                        ''),
      ('s_null',  'u_4', 'tok_null',  NOW() - interval '1 day',  NULL,                      NULL);
  `);

  // The migration itself, exactly as it will run in production.
  await db.exec(readFileSync(MIGRATION, 'utf8'));
});

const rows = async (): Promise<SessionRow[]> =>
  (
    await db.query<SessionRow>(
      'SELECT id, user_id, token, ip_address, user_agent FROM sessions ORDER BY id'
    )
  ).rows;

describe('0044_purge_session_telemetry', () => {
  it('runs as valid Postgres', async () => {
    // Reaching here at all means the file parsed and executed in `before`.
    assert.equal((await rows()).length, 4);
  });

  it('clears a populated IPv4 address', async () => {
    const row = (await rows()).find((r) => r.id === 's_v4');
    assert.equal(row?.ip_address, '');
  });

  it('clears a populated IPv6 address', async () => {
    const row = (await rows()).find((r) => r.id === 's_v6');
    assert.equal(row?.ip_address, '');
  });

  it('clears populated user-agents', async () => {
    const agents = (await rows()).map((r) => r.user_agent);
    assert.deepEqual(agents, ['', '', '', '']);
  });

  it('leaves no non-empty telemetry anywhere in the table', async () => {
    const { rows: leftover } = await db.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM sessions
      WHERE COALESCE(ip_address, '') <> '' OR COALESCE(user_agent, '') <> ''
    `);
    assert.equal(leftover[0]?.count, '0');
  });

  it('normalises pre-existing NULLs to the same empty string', async () => {
    // So a reader cannot distinguish "never collected" from "erased", and
    // every row looks identical regardless of when it was created.
    const row = (await rows()).find((r) => r.id === 's_null');
    assert.equal(row?.ip_address, '');
    assert.equal(row?.user_agent, '');
  });

  it('logs nobody out', async () => {
    const all = await rows();
    assert.equal(all.length, 4, 'no session was deleted');
    assert.deepEqual(
      all.map((r) => r.token),
      ['tok_blank', 'tok_null', 'tok_v4', 'tok_v6'],
      'tokens must survive untouched'
    );
    assert.deepEqual(
      all.map((r) => r.user_id),
      ['u_3', 'u_4', 'u_1', 'u_2'],
      'sessions must stay attached to their users'
    );
  });

  it('is idempotent', async () => {
    // Migrations get re-run against restored snapshots and staging copies.
    await db.exec(readFileSync(MIGRATION, 'utf8'));
    const all = await rows();
    assert.equal(all.length, 4);
    assert.deepEqual(
      all.map((r) => r.ip_address),
      ['', '', '', '']
    );
  });
});
