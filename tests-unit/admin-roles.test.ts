/**
 * Tests for the role catalogue and the search escaping behind it.
 *
 * Two things worth pinning here, both of which fail silently rather than
 * loudly if they regress:
 *
 * 1. The catalogue must list only roles something enforces. `profiles.roles`
 *    carries four flags and two are inert — adding one to GRANTABLE_ROLES
 *    would produce a button that saves, shows a badge, and confers nothing.
 *    Nothing errors, so only a test catches it.
 *
 * 2. LIKE wildcard escaping. Unescaped, a search for `%` matches every account
 *    on the site and a search for `a_b` matches `axb`. Both return a plausible
 *    page of results, which is exactly why neither gets noticed by hand on a
 *    screen whose job is identifying one specific person before granting them
 *    access.
 *
 * No database and no session: both modules are pure.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  GRANTABLE_ROLES,
  canGrant,
  grantableRole,
  type GrantableRole,
} from '@/lib/admin/roles';
import {
  MIN_SEARCH_LENGTH,
  containsPattern,
  escapeLikePattern,
  normalizeSearchQuery,
} from '@/lib/admin/user-search';

const SUPER_ADMIN = { isAdmin: true, isSuperAdmin: true };
const ADMIN = { isAdmin: true, isSuperAdmin: false };
const NEITHER = { isAdmin: false, isSuperAdmin: false };

const role = (id: 'admin' | 'contentModerator'): GrantableRole =>
  grantableRole(id);

describe('GRANTABLE_ROLES', () => {
  test('lists only the roles the app enforces', () => {
    assert.deepEqual(
      GRANTABLE_ROLES.map((r) => r.id),
      ['admin', 'contentModerator']
    );
  });

  test('omits the inert roles', () => {
    const ids = GRANTABLE_ROLES.map((r) => r.id as string);
    // Both are computed into the session at auth.ts:675-676 and read by
    // nothing. Either may be added here, but only after it has a gate.
    assert.ok(!ids.includes('mentoringModerator'));
    assert.ok(!ids.includes('eventOrganizer'));
  });

  test('each role names the field its endpoint expects', () => {
    assert.equal(role('admin').field, 'admin');
    assert.equal(role('contentModerator').field, 'contentModerator');
  });

  test('only admin has an environment tier', () => {
    assert.equal(role('admin').hasEnvTier, true);
    assert.equal(role('contentModerator').hasEnvTier, false);
  });

  test('grantableRole throws on an unknown id', () => {
    assert.throws(
      () => grantableRole('nope' as 'admin'),
      /Unknown grantable role/
    );
  });
});

describe('canGrant', () => {
  test('only a founder may grant admin', () => {
    assert.equal(canGrant(role('admin'), SUPER_ADMIN), true);
    assert.equal(canGrant(role('admin'), ADMIN), false);
    assert.equal(canGrant(role('admin'), NEITHER), false);
  });

  test('any admin may grant the moderation rota', () => {
    assert.equal(canGrant(role('contentModerator'), SUPER_ADMIN), true);
    assert.equal(canGrant(role('contentModerator'), ADMIN), true);
  });

  test('a non-admin may grant nothing', () => {
    for (const r of GRANTABLE_ROLES) {
      assert.equal(canGrant(r, NEITHER), false, r.id);
    }
  });
});

describe('escapeLikePattern', () => {
  test('leaves ordinary text alone', () => {
    assert.equal(escapeLikePattern('jose'), 'jose');
    assert.equal(escapeLikePattern('Ana María'), 'Ana María');
  });

  test('escapes the percent wildcard', () => {
    assert.equal(escapeLikePattern('100%'), '100\\%');
  });

  test('escapes the underscore wildcard', () => {
    assert.equal(escapeLikePattern('a_b'), 'a\\_b');
  });

  test('escapes a backslash without double-escaping what it adds', () => {
    // The ordering trap: escaping backslash after the wildcards would turn
    // `%` into a literal backslash followed by a live wildcard.
    assert.equal(escapeLikePattern('\\'), '\\\\');
    assert.equal(escapeLikePattern('\\%'), '\\\\\\%');
  });

  test('a bare wildcard cannot match everything', () => {
    assert.equal(containsPattern('%'), '%\\%%');
  });
});

describe('normalizeSearchQuery', () => {
  test('rejects nothing to search for', () => {
    assert.equal(normalizeSearchQuery(null), null);
    assert.equal(normalizeSearchQuery(''), null);
    assert.equal(normalizeSearchQuery('   '), null);
  });

  test('rejects a query shorter than the minimum', () => {
    assert.equal(normalizeSearchQuery('a'.repeat(MIN_SEARCH_LENGTH - 1)), null);
  });

  test('accepts and trims a usable query', () => {
    assert.equal(normalizeSearchQuery('  jose  '), 'jose');
  });

  test('measures length after trimming', () => {
    // ' a ' is three characters raw and one that matters.
    assert.equal(normalizeSearchQuery(' a '), null);
  });
});
