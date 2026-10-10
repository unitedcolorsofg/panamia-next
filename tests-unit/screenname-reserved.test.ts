import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { RESERVED_SCREENNAMES, validateScreenname } from '@/lib/screenname';
import { OFFICIAL_HOST_HANDLE } from '@/lib/server/official-host';

/**
 * The reserved-handle escape hatch, minus the database.
 *
 * `panamia` is on the reserved list so no pana can register it, which also
 * means the validator refuses it to Panamia. `allowReserved` is how the seed
 * script gets past that, and the thing worth pinning is its blast radius: it
 * must turn off the reserved list and nothing else. A flag that also relaxed
 * the format rules would let a malformed handle into the flat namespace that
 * people, listings and groups all share.
 */

/* -------------------------------------------------- the list still applies */

test('a reserved name is refused by default', () => {
  const result = validateScreenname('panamia');
  assert.equal(result.valid, false);
  assert.equal(result.error, 'This screenname is reserved');
});

test('an explicit false is the same as omitting it', () => {
  assert.equal(
    validateScreenname('admin', { allowReserved: false }).valid,
    false
  );
});

/* ------------------------------------------------------- and can be lifted */

test('allowReserved admits a reserved name', () => {
  assert.equal(
    validateScreenname('panamia', { allowReserved: true }).valid,
    true
  );
});

test('allowReserved does not relax the format rules', () => {
  // Too short, still too short.
  assert.equal(validateScreenname('ab', { allowReserved: true }).valid, false);
  // Leading hyphen, still rejected.
  assert.equal(
    validateScreenname('-panamia', { allowReserved: true }).valid,
    false
  );
  // Illegal character, still rejected.
  assert.equal(
    validateScreenname('pana mia', { allowReserved: true }).valid,
    false
  );
  // Over the 24-character ceiling, still rejected.
  assert.equal(
    validateScreenname('p'.repeat(25), { allowReserved: true }).valid,
    false
  );
});

test('an ordinary name is unaffected either way', () => {
  assert.equal(validateScreenname('anabakes').valid, true);
  assert.equal(
    validateScreenname('anabakes', { allowReserved: true }).valid,
    true
  );
});

/* ------------------------------------------------------------ the coupling */

/**
 * lib/server/official-host.ts resolves Panamia by this handle and says in its
 * docblock that it must stay reserved. If it is ever dropped from the list a
 * pana can register it, and the two files disagree silently -- the resolver
 * keeps demanding `type = 'Group'`, so Panamia simply stops resolving and the
 * connector picker goes quiet rather than loud.
 */
test('the official host handle is reserved', () => {
  assert.ok(
    RESERVED_SCREENNAMES.includes(OFFICIAL_HOST_HANDLE),
    `${OFFICIAL_HOST_HANDLE} must stay in RESERVED_SCREENNAMES`
  );
});
