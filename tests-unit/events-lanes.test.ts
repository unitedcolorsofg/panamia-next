/**
 * Tests for the lane builder behind the events discovery page.
 *
 * `buildLanes` decides which events a pana is shown and under which stated
 * reason. It is pure, and the page re-runs it in the browser every time the
 * viewer changes their availability window, so every bug here is a bug the
 * viewer sees immediately and cannot route around.
 *
 * The cases below are the ones that fail *silently* — the page still renders,
 * still looks personalised, and simply stops showing you things:
 *
 *   - An event gathered by a lane and then cut by that lane's card cap
 *     used to be marked as claimed anyway, so it vanished from the page
 *     entirely instead of falling through to its next-best reason. A page
 *     whose whole promise is "we will surface this" silently dropping rows is
 *     the worst failure available to it.
 *   - A lane holding one card claims a pattern a single row cannot evidence,
 *     so those are dropped — but the event itself must survive into leftovers.
 *   - Signed out, three of the four reasons are joins against the viewer and
 *     are therefore *unknowable*, not empty. The signed-out page is a smaller
 *     page, not this page with blank sections.
 *
 * No database and no network: `buildLanes` takes resolved reasons and returns
 * lanes, which is exactly why it lives apart from the queries that feed it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCategoryRails,
  buildLanes,
  categoriesFor,
  EVENT_CATEGORIES,
  RAIL_FLOOR,
  type DiscoveryEvent,
} from '@/lib/events/lanes';

function ev(
  id: string,
  going: number,
  reasons: DiscoveryEvent['reasons']
): DiscoveryEvent {
  return {
    id,
    slug: id,
    title: id,
    blurb: '',
    cover: null,
    coverAlt: null,
    mode: 'offline',
    startsAt: '2026-10-01T00:00:00.000Z',
    when: '',
    day: '',
    bucket: 'today',
    timezone: 'America/New_York',
    where: '',
    going,
    cap: null,
    tags: [],
    host: { id: 'h', name: 'h', isGroup: false },
    reasons,
  };
}

const panas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `p${i}`,
    screenname: null,
    avatar: null,
  }));

/** Everything the page would actually render, lanes and leftovers together. */
function placed(result: ReturnType<typeof buildLanes>): string[] {
  return [
    ...result.lanes.flatMap((lane) => lane.events.map((e) => e.event.id)),
    ...result.leftovers.map((e) => e.id),
  ];
}

describe('buildLanes', () => {
  test('an event cut by the lane cap cascades to its next reason', () => {
    /* `follow-host` carries no intrinsic strength, so ranking falls back to
       `-going`: the smallest room leads and the biggest is what gets cut,
       which is consistent with the page demoting popularity everywhere else.
       'a' is therefore the one pushed out of the follow lane — and it is also
       a tag match, so it must land there rather than disappear. */
    const result = buildLanes(
      [
        ev('a', 100, [
          { kind: 'follow-host', host: 'H' },
          { kind: 'tag-match', tags: ['x'], from: 'F' },
        ]),
        ev('b', 10, [{ kind: 'follow-host', host: 'H' }]),
        ev('c', 9, [{ kind: 'follow-host', host: 'H' }]),
        ev('d', 8, [{ kind: 'follow-host', host: 'H' }]),
        ev('f', 7, [{ kind: 'follow-host', host: 'H' }]),
        ev('g', 6, [{ kind: 'follow-host', host: 'H' }]),
        ev('h', 5, [{ kind: 'follow-host', host: 'H' }]),
        ev('e', 4, [{ kind: 'tag-match', tags: ['x'], from: 'F' }]),
      ],
      { signedIn: true }
    );

    assert.equal(result.lanes[0].id, 'following');
    assert.equal(result.lanes[0].events.length, 6, 'lane is capped at six');
    assert.equal(
      result.lanes[0].events[0].event.id,
      'h',
      'the smallest room leads'
    );

    const tags = result.lanes.find((lane) => lane.id === 'tags');
    assert.ok(tags, 'the tag lane still renders');
    assert.ok(
      tags.events.some((e) => e.event.id === 'a'),
      'the cut event cascaded into its next-best reason'
    );
    assert.equal(placed(result).length, 8, 'no event was dropped');
  });

  test('a lane with one event is dropped but keeps the event', () => {
    const result = buildLanes(
      [
        ev('solo', 5, [{ kind: 'follow-host', host: 'H' }]),
        ev('x', 4, [{ kind: 'new-host', host: 'N', pastEvents: 0 }]),
        ev('y', 3, [{ kind: 'new-host', host: 'N', pastEvents: 0 }]),
      ],
      { signedIn: true }
    );

    assert.ok(
      !result.lanes.some((lane) => lane.id === 'following'),
      'a heading over one card claims a pattern it cannot evidence'
    );
    assert.ok(
      result.leftovers.some((e) => e.id === 'solo'),
      'the event itself survives'
    );
  });

  test('signed out, only the computable reason builds a lane', () => {
    const result = buildLanes(
      [
        ev('a', 10, [{ kind: 'follow-host', host: 'H' }]),
        ev('b', 9, [{ kind: 'panas-going', panas: panas(3) }]),
        ev('c', 8, [{ kind: 'new-host', host: 'N', pastEvents: 0 }]),
        ev('d', 7, [{ kind: 'new-host', host: 'N', pastEvents: 1 }]),
      ],
      { signedIn: false }
    );

    assert.deepEqual(
      result.lanes.map((lane) => lane.id),
      ['new'],
      'follow/panas/tags are unknowable for a stranger, not empty'
    );
    assert.equal(placed(result).length, 4, 'the rest fall to leftovers');
  });

  test('no event is shown twice', () => {
    const both = (id: string, going: number) =>
      ev(id, going, [
        { kind: 'follow-host', host: 'H' },
        { kind: 'tag-match', tags: ['x'], from: 'F' },
      ]);

    const result = buildLanes(
      [
        both('a', 10),
        both('b', 9),
        ev('c', 8, [{ kind: 'tag-match', tags: ['x'], from: 'F' }]),
        ev('d', 7, [{ kind: 'tag-match', tags: ['x'], from: 'F' }]),
      ],
      { signedIn: true }
    );

    const all = placed(result);
    assert.equal(new Set(all).size, all.length, 'no duplicates across lanes');
    assert.equal(all.length, 4);
  });

  test('a lane ranks by its own reason, not by attendance', () => {
    const result = buildLanes(
      [
        ev('big', 500, [{ kind: 'panas-going', panas: panas(3) }]),
        ev('small', 2, [{ kind: 'panas-going', panas: panas(9) }]),
      ],
      { signedIn: true }
    );

    assert.equal(
      result.lanes[0].events[0].event.id,
      'small',
      'nine panas going beats five hundred strangers'
    );
  });

  test('leftovers lead with the biggest, since those need no help', () => {
    const result = buildLanes(
      [
        ev('small', 3, [{ kind: 'popular', going: 3 }]),
        ev('huge', 900, [{ kind: 'popular', going: 900 }]),
      ],
      { signedIn: true }
    );

    assert.deepEqual(
      result.leftovers.map((e) => e.id),
      ['huge', 'small'],
      'popular is never a lane; it falls through, biggest first'
    );
  });
});

/* ---------------------------------------------------------------------------
   Subject rails. The second axis, and the one that has to work for somebody
   the page knows nothing about.

   Every expectation below is derived from EVENT_CATEGORIES and RAIL_FLOOR
   rather than written out, so these tests keep testing the rule after the
   vocabulary changes instead of pinning today's copy of it.
   --------------------------------------------------------------------------- */

const [catA, catB, catC] = EVENT_CATEGORIES;

/** An event carrying tags, which `ev` has no reason to take. */
function tagged(id: string, tags: string[]): DiscoveryEvent {
  return { ...ev(id, 0, []), tags };
}

describe('buildCategoryRails', () => {
  test('a subject under the floor does not become a rail', () => {
    const short = Array.from({ length: RAIL_FLOOR - 1 }, (_, i) =>
      tagged(`s${i}`, [catA.match[0]])
    );
    assert.equal(buildCategoryRails(short).length, 0, 'below the floor');

    const enough = Array.from({ length: RAIL_FLOOR }, (_, i) =>
      tagged(`e${i}`, [catA.match[0]])
    );
    const rails = buildCategoryRails(enough);
    assert.equal(rails.length, 1, 'at the floor');
    assert.equal(rails[0].title, catA.title);
  });

  test('a tag nobody recognises puts an event in no subject', () => {
    assert.deepEqual(categoriesFor({ tags: ['notasubjectanybodyuses'] }), []);
    assert.deepEqual(categoriesFor({ tags: [] }), []);
  });

  test('case and punctuation do not change the subject', () => {
    const term = catA.match[0];
    for (const variant of [term.toUpperCase(), `${term}-`, ` ${term} `]) {
      assert.deepEqual(
        categoriesFor({ tags: [variant] }).map((c) => c.id),
        [catA.id],
        `${JSON.stringify(variant)} is the same tag as ${term}`
      );
    }
  });

  test('an event lands in at most two subjects', () => {
    const everything = categoriesFor({
      tags: [catA.match[0], catB.match[0], catC.match[0]],
    });
    assert.equal(
      everything.length,
      2,
      'a broadly tagged event must not appear on every shelf'
    );
  });

  test('a rail keeps an event a reason lane already claimed', () => {
    /* The one place this deliberately differs from buildLanes. A Music rail
       that hid the music event already shown under "from hosts you follow"
       would be wrong rather than merely shorter. */
    const pool = [
      {
        ...tagged('a', [catA.match[0]]),
        reasons: [{ kind: 'follow-host' as const, host: 'Bee' }],
      },
      {
        ...tagged('b', [catA.match[0]]),
        reasons: [{ kind: 'follow-host' as const, host: 'Bee' }],
      },
    ];

    const claimed = buildLanes(pool, { signedIn: true });
    assert.ok(claimed.lanes.length > 0, 'precondition: the reason lane built');

    const rails = buildCategoryRails(pool);
    assert.deepEqual(
      rails[0].events.map((e) => e.id),
      ['a', 'b'],
      'the rail is a complete answer, not the leftovers'
    );
  });

  test('the busiest subject leads', () => {
    const rails = buildCategoryRails([
      tagged('a1', [catA.match[0]]),
      tagged('a2', [catA.match[0]]),
      tagged('b1', [catB.match[0]]),
      tagged('b2', [catB.match[0]]),
      tagged('b3', [catB.match[0]]),
    ]);

    assert.deepEqual(
      rails.map((r) => r.title),
      [catB.title, catA.title],
      'the page leads with what the week is actually about'
    );
  });

  test('a rail carries no reason, because it is not claiming one', () => {
    const rails = buildCategoryRails([
      tagged('a1', [catA.match[0]]),
      tagged('a2', [catA.match[0]]),
    ]);
    for (const event of rails[0].events) {
      assert.ok(
        !('reason' in event),
        'a subject makes no claim about a viewer'
      );
    }
  });
});
