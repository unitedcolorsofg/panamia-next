import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseConnector } from '@/lib/connectors/membership';

/**
 * `parseConnector` is the only thing standing between whatever is in the
 * `profiles.connector` JSONB column and the HQ page rendering it.
 *
 * It is worth testing in isolation for two reasons. The first is that the
 * column is schemaless, so nothing upstream guarantees the shape — a blob
 * written by an older build, hand-edited during support, or restored from a
 * backup all arrive here looking like `unknown`. The second is that it is pure
 * and synchronous, so the whole decision table can be pinned down here without
 * waiting on the database tests.
 *
 * The behaviour being pinned down is specifically the *degrading*: a bad
 * record must come back as `null` ("not a connector yet", a state the UI
 * already renders) rather than as a half-built object that crashes later in
 * `getHouse`, somewhere far from the cause.
 *
 * The status rules get their own block at the bottom. Those are the ones with
 * teeth — everything else here decides how a membership renders, but status
 * decides whether somebody is in the programme at all.
 */

const VALID = {
  status: 'active',
  pod: 'miami',
  houses: ['education'],
  tier: 1,
  bring: 'A van most weekends',
  appliedAt: '2025-01-01T00:00:00.000Z',
  commitments: [],
};

describe('parseConnector — rejecting what cannot be rendered', () => {
  test('returns null for values that are not records', () => {
    for (const value of [null, undefined, 'miami', 42, true, []]) {
      assert.equal(parseConnector(value), null);
    }
  });

  test('returns null when the pod is missing or unknown', () => {
    assert.equal(parseConnector({ ...VALID, pod: undefined }), null);
    assert.equal(parseConnector({ ...VALID, pod: 'orlando' }), null);
    assert.equal(parseConnector({ ...VALID, pod: 3 }), null);
  });

  test('returns null when no house survives, so HQ routes back to the form', () => {
    assert.equal(parseConnector({ ...VALID, houses: [] }), null);
    assert.equal(parseConnector({ ...VALID, houses: ['retiredHouse'] }), null);
    assert.equal(parseConnector({ ...VALID, houses: 'education' }), null);
  });
});

describe('parseConnector — keeping what can be rendered', () => {
  test('drops an unknown house rather than the whole membership', () => {
    const parsed = parseConnector({
      ...VALID,
      houses: ['education', 'retiredHouse', 'culturalWorkers'],
    });

    assert.deepEqual(parsed?.houses, ['education', 'culturalWorkers']);
  });

  test('de-duplicates houses', () => {
    const parsed = parseConnector({
      ...VALID,
      houses: ['education', 'education'],
    });

    assert.deepEqual(parsed?.houses, ['education']);
  });

  test('clamps an out-of-range tier to the first one', () => {
    for (const tier of [0, 4, '2', null, undefined]) {
      assert.equal(parseConnector({ ...VALID, tier })?.tier, 1);
    }
    assert.equal(parseConnector({ ...VALID, tier: 3 })?.tier, 3);
  });

  test('trims bring and tolerates it being absent', () => {
    assert.equal(
      parseConnector({ ...VALID, bring: '  a van  ' })?.bring,
      'a van'
    );
    assert.equal(parseConnector({ ...VALID, bring: undefined })?.bring, '');
    assert.equal(parseConnector({ ...VALID, bring: 12 })?.bring, '');
  });
});

describe('parseConnector — commitments', () => {
  const commitment = {
    id: 'c1',
    what: 'Table at the free market',
    when: 'Early November',
    house: 'education',
    progress: 'inProgress',
    createdAt: '2025-02-01T00:00:00.000Z',
  };

  test('keeps a well-formed commitment', () => {
    const parsed = parseConnector({ ...VALID, commitments: [commitment] });
    assert.deepEqual(parsed?.commitments, [commitment]);
  });

  test('drops a malformed commitment without losing the good ones', () => {
    const parsed = parseConnector({
      ...VALID,
      commitments: [
        commitment,
        { ...commitment, id: 'c2', what: '   ' },
        { ...commitment, id: 'c3', house: 'retiredHouse' },
        { ...commitment, id: '', what: 'No id' },
        'not an object',
        null,
      ],
    });

    assert.deepEqual(
      parsed?.commitments.map((c) => c.id),
      ['c1']
    );
  });

  test('falls back to notSet for an unrecognised progress value', () => {
    const parsed = parseConnector({
      ...VALID,
      commitments: [{ ...commitment, progress: 'almost' }],
    });

    assert.equal(parsed?.commitments[0].progress, 'notSet');
  });

  test('normalises a blank when to null', () => {
    const parsed = parseConnector({
      ...VALID,
      commitments: [{ ...commitment, when: '   ' }],
    });

    assert.equal(parsed?.commitments[0].when, null);
  });

  test('tolerates commitments being absent or not a list', () => {
    assert.deepEqual(
      parseConnector({ ...VALID, commitments: undefined })?.commitments,
      []
    );
    assert.deepEqual(
      parseConnector({ ...VALID, commitments: 'none' })?.commitments,
      []
    );
  });
});

describe('parseConnector — status is the gate', () => {
  test('keeps each of the three real statuses', () => {
    for (const status of ['pending', 'active', 'declined']) {
      assert.equal(parseConnector({ ...VALID, status })?.status, status);
    }
  });

  /* The important one. A record with no status is either a row written before
   * the gate existed or a blob somebody hand-edited badly, and in both cases
   * the safe reading is that nobody has accepted this person yet. Defaulting
   * the other way would silently let anyone through whose record predates the
   * gate, and an unearned membership is invisible — whereas somebody waiting
   * on an approval they already had just asks, and an admin clicks Accept. */
  test('treats a missing or unrecognised status as pending, never active', () => {
    for (const status of [undefined, null, '', 'approved', 'ACTIVE', 7, {}]) {
      assert.equal(parseConnector({ ...VALID, status })?.status, 'pending');
    }
  });

  test('does not let a legacy record imply membership', () => {
    const legacy = {
      pod: 'miami',
      houses: ['education'],
      tier: 2,
      bring: 'A van',
      joinedAt: '2025-01-01T00:00:00.000Z',
    };

    const parsed = parseConnector(legacy);

    assert.equal(parsed?.status, 'pending');
    // The old field still carries the only date the record has.
    assert.equal(parsed?.appliedAt, '2025-01-01T00:00:00.000Z');
  });

  test('leaves a membership undecided until somebody decides it', () => {
    const parsed = parseConnector(VALID);

    assert.equal(parsed?.decidedAt, null);
    assert.equal(parsed?.decidedBy, null);
  });

  test('keeps who decided it and when', () => {
    const parsed = parseConnector({
      ...VALID,
      decidedAt: '2025-03-01T00:00:00.000Z',
      decidedBy: 'admin-1',
    });

    assert.equal(parsed?.decidedAt, '2025-03-01T00:00:00.000Z');
    assert.equal(parsed?.decidedBy, 'admin-1');
  });
});
