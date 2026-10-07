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
