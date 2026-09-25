/**
 * Tests for federation being opt-in.
 *
 * Two different risks, tested two different ways.
 *
 * The first is that the decision itself is wrong -- that some absent or
 * malformed value is read as consent. That is a pure function, so it is
 * tested directly against the real one.
 *
 * The second is the one that actually costs someone their privacy: a
 * federation endpoint that never asks. The gate only works if every route
 * serving the fediverse goes through the gated lookup, and the way that
 * breaks is not by someone deleting a check -- it is by someone adding a
 * seventh endpoint next to six correct ones and reaching for the lookup
 * whose name sounds right. So rather than listing the routes we know about,
 * the structural test walks the federation directories and fails on whatever
 * it finds using the ungated one. A new route is covered the day it is
 * written, by a test nobody had to remember to update.
 *
 * That cuts the other way too: `getActorByScreenname` has to stay usable,
 * because it is what Pana Social itself runs on. Opting out of federation
 * must not mean opting out of having an account here, so the test is scoped
 * to the federation surface rather than banning the function outright.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { canFederate, mayFederate } from '@/lib/federation/gates';
import type { Profile } from '@/lib/schema';

// A Profile has far more fields than these gates read. Casting one minimal
// object per test keeps each case to the fields under test.
const profile = (fields: Partial<Profile>) => fields as Profile;

describe('mayFederate', () => {
  it('permits federation only when the member turned it on', () => {
    assert.equal(mayFederate({ federationEnabled: true }), true);
  });

  it('refuses when the member has not turned it on', () => {
    assert.equal(mayFederate({ federationEnabled: false }), false);
  });

  it('refuses when there is no profile at all', () => {
    // Remote actors carry no profile, and profile_id is nullable, so this is
    // reachable rather than theoretical.
    assert.equal(mayFederate(null), false);
    assert.equal(mayFederate(undefined), false);
  });

  it('refuses when the column is absent or null', () => {
    // A partial select that forgot the column yields undefined. Defaulting
    // that to "on" would turn a query mistake into a disclosure.
    assert.equal(mayFederate({}), false);
    assert.equal(mayFederate({ federationEnabled: null }), false);
  });

  it('refuses truthy values that are not exactly true', () => {
    // Guards the difference between `=== true` and a loose truthiness check,
    // which is what a driver returning "t" or 1 would exploit.
    const loose = [1, 't', 'true', 'false', {}] as unknown[];
    for (const value of loose) {
      assert.equal(
        mayFederate({ federationEnabled: value as unknown as boolean }),
        false,
        `expected ${JSON.stringify(value)} not to count as consent`
      );
    }
  });
});

describe('canFederate', () => {
  it('allows an eligible member who opted in', () => {
    const result = canFederate(
      profile({ socialEligible: true, federationEnabled: true })
    );
    assert.equal(result.allowed, true);
  });

  it('refuses an eligible member who has not opted in', () => {
    const result = canFederate(
      profile({ socialEligible: true, federationEnabled: false })
    );
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'federation_not_enabled');
  });

  it('still refuses an ineligible member who somehow opted in', () => {
    // Eligibility is checked first, so its reason survives rather than being
    // overwritten by the federation one.
    const result = canFederate(
      profile({
        socialEligible: false,
        socialIneligibleReason: 'suspended',
        federationEnabled: true,
      })
    );
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'suspended');
  });

  it('refuses when there is no profile', () => {
    const result = canFederate(null);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'no_profile');
  });
});

// --------------------------------------------------- the structural guard

/** Directories whose route handlers answer other servers, not this one. */
const FEDERATION_ROUTE_DIRS = [
  join('app', 'p', '[user]'),
  join('app', '.well-known', 'webfinger'),
  join('app', 'api', 'federation'),
];

/** The lookup that ignores the member's federation setting. */
const UNGATED_LOOKUP = 'getActorByScreenname';

const repoRoot = process.cwd();

function routeFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);

  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    // A directory that moved should fail loudly in the coverage test below,
    // not silently pass by finding nothing here.
    return [];
  }

  return entries.flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      return routeFilesUnder(join(dir, entry));
    }
    return entry === 'route.ts' ? [join(dir, entry)] : [];
  });
}

const federationRoutes = FEDERATION_ROUTE_DIRS.flatMap(routeFilesUnder);

describe('federation routes are gated', () => {
  it('finds the federation surface it is meant to be checking', () => {
    // Without this, moving or renaming a directory would empty the scan and
    // turn the test below into one that passes by examining nothing.
    assert.ok(
      federationRoutes.length >= 6,
      `expected to find the federation routes, found ${federationRoutes.length}: ${federationRoutes.join(', ')}`
    );
  });

  for (const route of federationRoutes) {
    it(`${route.replace(/\\/g, '/')} does not use the ungated lookup`, () => {
      const source = readFileSync(join(repoRoot, route), 'utf8');
      assert.ok(
        !source.includes(UNGATED_LOOKUP),
        `${route} calls ${UNGATED_LOOKUP}, which ignores the member's ` +
          `federation setting. Federation routes must use getFederatedActor().`
      );
    });
  }
});

describe('the shared inbox is gated', () => {
  // The per-actor inbox resolves by handle and is covered by the scan above.
  // The shared inbox resolves by ActivityPub URI, so it never calls either
  // lookup -- its gate lives in the handler both inboxes delegate to, and
  // nothing in the scan would notice if it were removed.
  it('checks federation before handling an activity', () => {
    const handler = readFileSync(
      join(repoRoot, 'lib', 'federation', 'inbox-handler.ts'),
      'utf8'
    );
    assert.ok(
      handler.includes('isFederationEnabled'),
      'inbox-handler.ts must check isFederationEnabled(), or the shared ' +
        'inbox will accept activities for members who never opted in.'
    );
  });
});
