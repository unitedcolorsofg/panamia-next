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
 * backup all arrive here looking like `unknown`. The second is that there is
 * no database available in CI or locally, so this parser is the only part of
 * the membership module that can be verified before it reaches production.
 *
 * The behaviour being pinned down is specifically the *degrading*: a bad
 * record must come back as `null` ("not a connector yet", a state the UI
 * already renders) rather than as a half-built object that crashes later in
 * `getHouse`, somewhere far from the cause.
 */

const VALID = {
  pod: 'miami',
  houses: ['education'],
  tier: 1,
  bring: 'A van most weekends',
  joinedAt: '2025-01-01T00:00:00.000Z',
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
    assert.equal(parseConnector({ ...VALID, bring: '  a van  ' })?.bring, 'a van');
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
