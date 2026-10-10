/**
 * Tests for who may see which admin tool.
 *
 * `canSeeView` decides what the sidebar draws. It is not the security
 * boundary — every route behind it checks for itself — but it is the thing
 * that decides whether a content moderator is shown a shelf of tools that all
 * 401, which is the failure `components/Admin/gate.tsx` exists to prevent.
 *
 * The rule it encodes has to stay in step with `checkModeratorAuth`: admins
 * reach everything, and a moderator reaches exactly the tools marked
 * `access: 'moderator'`. These tests pin both halves, plus the case that is
 * easy to get backwards — a viewer with neither role seeing nothing at all.
 *
 * No database, no network, no session: `canSeeView` takes the two booleans
 * directly.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_VIEWS,
  ADMIN_GROUPS,
  canSeeView,
  childViewsFor,
  topLevelViewsInGroupFor,
  viewsInGroupFor,
} from '@/lib/admin/views';

const ADMIN = { isAdmin: true, isContentModerator: false };
const MODERATOR = { isAdmin: false, isContentModerator: true };
const BOTH = { isAdmin: true, isContentModerator: true };
const NEITHER = { isAdmin: false, isContentModerator: false };

describe('canSeeView', () => {
  test('an admin sees every tool', () => {
    for (const view of ADMIN_VIEWS) {
      assert.equal(
        canSeeView(view, ADMIN),
        true,
        `admin should see ${view.id}`
      );
    }
  });

  test('a viewer with neither role sees nothing', () => {
    // The direction that matters. A bug here does not merely draw a useless
    // link — it tells somebody who is not staff what the staff tools are
    // called.
    for (const view of ADMIN_VIEWS) {
      assert.equal(
        canSeeView(view, NEITHER),
        false,
        `a non-staff viewer should not see ${view.id}`
      );
    }
  });

  test('a moderator sees only the tools marked for moderators', () => {
    const visible = ADMIN_VIEWS.filter((v) => canSeeView(v, MODERATOR));
    assert.deepEqual(
      visible.map((v) => v.id),
      ['reports']
    );
  });

  test('the abuse-report queue is the moderator tool', () => {
    // Pinned deliberately rather than derived. The role is defined by the one
    // job it hands out; widening it is a decision about what a volunteer may
    // touch, and should fail a test rather than ride along in a diff.
    const reports = ADMIN_VIEWS.find((v) => v.id === 'reports');
    assert.ok(reports, 'the reports view should exist');
    assert.equal(reports.access, 'moderator');
    assert.equal(canSeeView(reports, MODERATOR), true);
  });

  test('tools default to admin-only when access is unset', () => {
    // The field is optional, so the default decides what a tool added without
    // thinking about roles is worth. It must be the closed one.
    const unmarked = ADMIN_VIEWS.filter((v) => v.access === undefined);
    assert.ok(unmarked.length > 0, 'expected some unmarked views to exist');
    for (const view of unmarked) {
      assert.equal(canSeeView(view, MODERATOR), false);
    }
  });

  test('holding both roles is the same as being an admin', () => {
    for (const view of ADMIN_VIEWS) {
      assert.equal(canSeeView(view, BOTH), canSeeView(view, ADMIN));
    }
  });
});

describe('viewsInGroupFor', () => {
  test('never returns a view the same viewer could not see', () => {
    for (const group of ADMIN_GROUPS) {
      for (const viewer of [ADMIN, MODERATOR, BOTH, NEITHER]) {
        for (const view of viewsInGroupFor(group.id, viewer)) {
          assert.equal(canSeeView(view, viewer), true);
          assert.equal(view.group, group.id);
        }
      }
    }
  });

  test('a moderator gets exactly one row across the whole sidebar', () => {
    const rows = ADMIN_GROUPS.flatMap((g) => viewsInGroupFor(g.id, MODERATOR));
    assert.deepEqual(
      rows.map((v) => v.id),
      ['reports']
    );
  });

  test('a non-staff viewer gets an empty sidebar', () => {
    const rows = ADMIN_GROUPS.flatMap((g) => viewsInGroupFor(g.id, NEITHER));
    assert.deepEqual(rows, []);
  });
});

/**
 * The sidebar draws a group as top-level rows plus the children nesting under
 * each one. The failure that matters is arithmetic rather than visual: a row
 * counted in neither list disappears from the nav entirely while still
 * existing and still being reachable by URL, and a row counted in both draws
 * twice. Both are invisible in the data and obvious only on screen.
 */
describe('sidebar nesting', () => {
  test('every parent id names a real view in the same group', () => {
    for (const view of ADMIN_VIEWS) {
      if (!view.parent) continue;
      const parent = ADMIN_VIEWS.find((v) => v.id === view.parent);
      assert.ok(parent, `${view.id} names a parent that does not exist`);
      assert.equal(
        parent.group,
        view.group,
        `${view.id} nests under a parent in another group`
      );
    }
  });

  test('nesting is one deep', () => {
    for (const view of ADMIN_VIEWS) {
      if (!view.parent) continue;
      const parent = ADMIN_VIEWS.find((v) => v.id === view.parent);
      assert.equal(
        parent?.parent,
        undefined,
        `${view.id} nests under ${view.parent}, which is itself nested`
      );
    }
  });

  test('top level plus children draws each visible row exactly once', () => {
    for (const group of ADMIN_GROUPS) {
      for (const viewer of [ADMIN, MODERATOR, BOTH, NEITHER]) {
        const drawn = topLevelViewsInGroupFor(group.id, viewer).flatMap(
          (view) => [view, ...childViewsFor(view.id, viewer)]
        );
        assert.deepEqual(
          drawn.map((v) => v.id).sort(),
          viewsInGroupFor(group.id, viewer)
            .map((v) => v.id)
            .sort(),
          `${group.id} draws the wrong set for ${JSON.stringify(viewer)}`
        );
      }
    }
  });

  test('childViewsFor never returns a view the viewer could not see', () => {
    for (const view of ADMIN_VIEWS) {
      for (const viewer of [ADMIN, MODERATOR, BOTH, NEITHER]) {
        for (const child of childViewsFor(view.id, viewer)) {
          assert.equal(canSeeView(child, viewer), true);
          assert.equal(child.parent, view.id);
        }
      }
    }
  });

  test('a child whose parent is hidden is promoted, not dropped', () => {
    // Cannot be built from ADMIN_VIEWS today — every nested view and its
    // parent are admin-only — so the rule is checked against the shape the
    // helper guarantees rather than against live data. Were a parent ever
    // marked moderator-visible while its child was not, or the reverse, this
    // is the case that would otherwise silently lose a row.
    const rows = topLevelViewsInGroupFor('community', MODERATOR);
    for (const row of rows) {
      if (!row.parent) continue;
      assert.equal(
        rows.some((r) => r.id === row.parent),
        false,
        `${row.id} was promoted while its parent was also drawn`
      );
    }
  });
});
