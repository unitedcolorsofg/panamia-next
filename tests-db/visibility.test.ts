/**
 * Status visibility, against a real Postgres.
 *
 * A direct message and a public post are the same kind of row in
 * `social_statuses`; only their ActivityPub addressing separates them. Three
 * read paths once queried that table without testing the addressing and
 * served DMs to anonymous callers. `visibleTo()` is the predicate that fixed
 * it, and this is the test that keeps it fixed.
 *
 * The predicate is not restated here. It is imported, rendered to SQL through
 * Drizzle's own dialect, and run against Postgres compiled to WASM, so the
 * thing under test is the SQL that ships. Rename a column and the rendered
 * SQL stops matching the fixtures below and this fails, which is the point.
 *
 * Run: yarn test:db
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import { and, eq, isNotNull, type SQL } from 'drizzle-orm';
import { socialStatuses } from '@/lib/schema';
import { notExpired, visibleTo } from '@/lib/federation/wrappers/visibility';

const dialect = new PgDialect();
let db: PGlite;

const ALICE_FOLLOWERS = 'https://pana.social/p/alice/followers';
const DAVE_URI = 'https://pana.social/p/dave';
const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

/** Run any Drizzle predicate against the fixtures and return matching ids. */
async function idsMatching(predicate: SQL): Promise<string[]> {
  const { sql, params } = dialect.sqlToQuery(predicate);
  const res = await db.query<{ id: string }>(
    `SELECT id FROM social_statuses WHERE ${sql} ORDER BY id`,
    params as unknown[]
  );
  return res.rows.map((r) => r.id);
}

const seenBy = (viewer?: string) => idsMatching(visibleTo(viewer));

before(async () => {
  db = new PGlite();

  // Only the columns the predicate touches.
  await db.exec(`
    CREATE TABLE social_actors (
      id text PRIMARY KEY,
      uri text NOT NULL,
      followers_url text NOT NULL
    );
    CREATE TABLE social_follows (
      actor_id text NOT NULL,
      target_actor_id text NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE social_statuses (
      id text PRIMARY KEY,
      actor_id text NOT NULL,
      published timestamptz,
      expires_at timestamptz,
      recipient_to jsonb NOT NULL DEFAULT '[]'::jsonb,
      recipient_cc jsonb NOT NULL DEFAULT '[]'::jsonb
    );

    INSERT INTO social_actors (id, uri, followers_url) VALUES
      ('alice', 'https://pana.social/p/alice', '${ALICE_FOLLOWERS}'),
      ('bob',   'https://pana.social/p/bob',   'https://pana.social/p/bob/followers'),
      ('carol', 'https://pana.social/p/carol', 'https://pana.social/p/carol/followers'),
      ('dave',  '${DAVE_URI}',                 'https://pana.social/p/dave/followers'),
      ('erin',  'https://pana.social/p/erin',  'https://pana.social/p/erin/followers');

    INSERT INTO social_follows (actor_id, target_actor_id, status) VALUES
      ('bob',  'alice', 'accepted'),
      ('erin', 'alice', 'pending');
  `);

  // Alice's posts, addressed exactly as createStatus() writes them.
  await db.exec(`
    INSERT INTO social_statuses (id, actor_id, published, expires_at, recipient_to, recipient_cc) VALUES
      ('public',    'alice', NOW(), NULL, '["${PUBLIC}"]',          '["${ALICE_FOLLOWERS}"]'),
      ('unlisted',  'alice', NOW(), NULL, '["${ALICE_FOLLOWERS}"]', '["${PUBLIC}"]'),
      ('followers', 'alice', NOW(), NULL, '["${ALICE_FOLLOWERS}"]', '[]'),
      ('dm_dave',   'alice', NOW(), NOW() + interval '7 days', '["${DAVE_URI}"]', '[]'),
      ('dm_expired','alice', NOW(), NOW() - interval '1 day',  '["${DAVE_URI}"]', '[]');
  `);
});

describe('visibleTo', () => {
  describe('an anonymous caller', () => {
    it('reads public and unlisted posts', async () => {
      assert.deepEqual(await seenBy(), ['public', 'unlisted']);
    });

    // The disclosure this predicate exists to prevent.
    it('cannot read a direct message', async () => {
      assert.ok(!(await seenBy()).includes('dm_dave'));
    });

    it('cannot read a followers-only post', async () => {
      assert.ok(!(await seenBy()).includes('followers'));
    });
  });

  describe('a signed-in stranger', () => {
    it('reads no more than an anonymous caller', async () => {
      assert.deepEqual(await seenBy('carol'), ['public', 'unlisted']);
    });
  });

  describe('a follower', () => {
    it('reads followers-only posts', async () => {
      assert.ok((await seenBy('bob')).includes('followers'));
    });

    // Following someone must not hand you their DMs. This is why the
    // predicate tests the author's followers collection rather than the
    // follow relation on its own.
    it("cannot read the author's direct messages to other people", async () => {
      assert.ok(!(await seenBy('bob')).includes('dm_dave'));
    });
  });

  describe('a pending follower', () => {
    it('cannot read followers-only posts until the follow is accepted', async () => {
      assert.deepEqual(await seenBy('erin'), ['public', 'unlisted']);
    });
  });

  describe('a direct message recipient', () => {
    it('reads the message addressed to them', async () => {
      assert.ok((await seenBy('dave')).includes('dm_dave'));
    });

    it('does not gain followers-only posts along with it', async () => {
      assert.ok(!(await seenBy('dave')).includes('followers'));
    });
  });

  describe('the author', () => {
    it('reads everything they wrote', async () => {
      assert.deepEqual(await seenBy('alice'), [
        'dm_dave',
        'dm_expired',
        'followers',
        'public',
        'unlisted',
      ]);
    });
  });
});

describe('notExpired', () => {
  it('hides a direct message past its expiry', async () => {
    const live = await idsMatching(and(visibleTo('dave'), notExpired())!);
    assert.ok(live.includes('dm_dave'));
    assert.ok(!live.includes('dm_expired'));
  });
});

describe('composed as getActorPosts queries it', () => {
  it("returns only what each viewer may see of one actor's posts", async () => {
    const actorPosts = (viewer?: string) =>
      idsMatching(
        and(
          eq(socialStatuses.actorId, 'alice'),
          isNotNull(socialStatuses.published),
          visibleTo(viewer),
          notExpired()
        )!
      );

    assert.deepEqual(await actorPosts(), ['public', 'unlisted']);
    assert.deepEqual(await actorPosts('bob'), [
      'followers',
      'public',
      'unlisted',
    ]);
    assert.deepEqual(await actorPosts('dave'), [
      'dm_dave',
      'public',
      'unlisted',
    ]);
  });
});
