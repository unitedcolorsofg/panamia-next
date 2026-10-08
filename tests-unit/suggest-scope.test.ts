/**
 * Tests for which kinds a scoped search actually runs.
 *
 * The typeahead used to ask for all four kinds whatever the scope control
 * said, so picking Events and typing "music" returned businesses. The fix put
 * a `scope` parameter on /api/directory/suggest, and that parameter is new
 * attacker-controlled input on an endpoint with a members-only half — which
 * makes these two functions the whole of the access decision rather than a
 * convenience.
 *
 * `parseScope` is the sanitiser: a `Scope` comes out or nothing does, so no
 * raw query string reaches a query or a translation key. `scopesToSearch` is
 * the gate: it takes the parsed scope and the server's own answer to "is this
 * viewer signed in", and the server's answer wins. The case that matters most
 * is a signed-out request asking for panas, which must come back with nothing
 * to search rather than with panas.
 *
 * No database, no network, no session — both functions take plain values.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCOPES,
  parseScope,
  scopesToSearch,
  visibleScopes,
} from '@/lib/directory-scopes';

describe('parseScope', () => {
  test('accepts every scope the menu offers', () => {
    for (const scope of SCOPES) {
      assert.equal(parseScope(scope), scope);
    }
  });

  test('absent, empty and unknown all read as no scope', () => {
    // These three collapse on purpose. A missing scope is a client running the
    // previous bundle, and an unrecognised one is a typo or a probe; both want
    // the federated fallback rather than an error or an empty list, so that a
    // deploy cannot leave anyone with a dead search box.
    assert.equal(parseScope(null), null);
    assert.equal(parseScope(undefined), null);
    assert.equal(parseScope(''), null);
    assert.equal(parseScope('panas'), null);
    assert.equal(parseScope('business'), null);
    assert.equal(parseScope('DIRECTORY'), null);
    assert.equal(parseScope('directory '), null);
  });

  test('inherited object keys are not scopes', () => {
    // The membership test is against the SCOPES array rather than a lookup on
    // an object literal. A lookup would answer truthily for these and hand a
    // caller `'__proto__'` typed as a Scope.
    assert.equal(parseScope('__proto__'), null);
    assert.equal(parseScope('constructor'), null);
    assert.equal(parseScope('toString'), null);
    assert.equal(parseScope('hasOwnProperty'), null);
  });
});

describe('scopesToSearch', () => {
  test('a reachable scope narrows to exactly itself', () => {
    assert.deepEqual(scopesToSearch('event', false), ['event']);
    assert.deepEqual(scopesToSearch('directory', false), ['directory']);
    assert.deepEqual(scopesToSearch('pana', true), ['pana']);
  });

  test('a signed-out request for panas searches nothing', () => {
    // The one that is a security property rather than a product one. The
    // scope arrives from a query string, so a signed-out caller can ask for
    // the members-only kind; the answer has to be an empty search rather than
    // a search of panas.
    assert.deepEqual(scopesToSearch('pana', false), []);
  });

  test('groups stay public', () => {
    // Deliberately not gated, and this is the one that changed: getSuggestions
    // used to substitute an empty list for groups when signed out. That was a
    // drifted second copy of the rule -- SCOPE_REQUIRES_PANA marks only panas,
    // and GET /api/social/groups serves these same identity-only rows
    // unauthenticated on purpose, so a group with an open request policy can
    // be found by the people meant to ask to join it. Gating it here protected
    // nothing and left a signed-out visitor who picked Groups, which the menu
    // offers them, with a dropdown that could never fill.
    assert.deepEqual(scopesToSearch('group', false), ['group']);
  });

  test('no scope falls back to every kind the viewer can see', () => {
    // The federated behaviour this box shipped with, kept for clients that
    // predate the parameter.
    assert.deepEqual(scopesToSearch(null, false), visibleScopes(false));
    assert.deepEqual(scopesToSearch(null, true), visibleScopes(true));

    assert.deepEqual(scopesToSearch(null, false), [
      'directory',
      'event',
      'group',
    ]);
    assert.deepEqual(scopesToSearch(null, true), [
      'directory',
      'event',
      'group',
      'pana',
    ]);
  });

  test('never returns a scope the viewer cannot reach', () => {
    // The property the two cases above are examples of, checked across the
    // whole set so a newly gated scope cannot pass by being untested.
    for (const scope of SCOPES) {
      for (const signedIn of [false, true]) {
        const reachable = visibleScopes(signedIn);
        for (const result of scopesToSearch(scope, signedIn)) {
          assert.ok(
            reachable.includes(result),
            `${result} is not reachable when signedIn=${signedIn}`
          );
        }
      }
    }
  });

  test('an unparsed scope and an unknown one behave identically', () => {
    // parseScope and scopesToSearch meet here: the route hands the second the
    // output of the first, so an unknown scope cannot reach the gate as a
    // string that happens to miss every branch.
    assert.deepEqual(
      scopesToSearch(parseScope('nonsense'), false),
      scopesToSearch(null, false)
    );
  });
});
