import { test, expect } from '@playwright/test';
import {
  isAuthor,
  isAcceptedCoAuthor,
  isPendingCoAuthor,
  isReviewer,
  canView,
  canEdit,
  canDelete,
  type ArticleAccess,
} from '../../lib/article/permissions';

// Unit tests for the article authorization predicates. permissions.ts is pure
// (no db / no better-auth), so it imports directly with no server or auth
// setup. These lock down the exact rules that repeatedly drifted per-route:
// a pending invitee may READ (invitation page) but not edit; an accepted
// co-author may edit and delete; a reviewer may read; published is public.

const AUTHOR = 'user-author';
const ACCEPTED = 'user-accepted';
const PENDING = 'user-pending';
const REVIEWER = 'user-reviewer';
const STRANGER = 'user-stranger';

function draft(): ArticleAccess {
  return {
    authorId: AUTHOR,
    status: 'draft',
    coAuthors: [
      { userId: ACCEPTED, status: 'accepted' },
      { userId: PENDING, status: 'pending' },
    ],
    reviewedBy: { userId: REVIEWER, status: 'pending' },
  };
}

test.describe('article permission predicates', () => {
  test('role predicates identify each relationship', () => {
    const a = draft();
    expect(isAuthor(a, AUTHOR)).toBe(true);
    expect(isAuthor(a, STRANGER)).toBe(false);

    expect(isAcceptedCoAuthor(a, ACCEPTED)).toBe(true);
    expect(isAcceptedCoAuthor(a, PENDING)).toBe(false); // pending != accepted

    expect(isPendingCoAuthor(a, PENDING)).toBe(true);
    expect(isPendingCoAuthor(a, ACCEPTED)).toBe(false);

    expect(isReviewer(a, REVIEWER)).toBe(true); // any review status
    expect(isReviewer(a, STRANGER)).toBe(false);
  });

  test('anonymous / missing userId is never a member', () => {
    const a = draft();
    expect(isAuthor(a, undefined)).toBe(false);
    expect(isAcceptedCoAuthor(a, null)).toBe(false);
    expect(canView(a, undefined)).toBe(false); // draft, not public
    expect(canEdit(a, undefined)).toBe(false);
  });

  test('canView admits author, accepted + pending co-authors, and reviewer', () => {
    const a = draft();
    expect(canView(a, AUTHOR)).toBe(true);
    expect(canView(a, ACCEPTED)).toBe(true);
    expect(canView(a, PENDING)).toBe(true); // invitation page must load
    expect(canView(a, REVIEWER)).toBe(true);
    expect(canView(a, STRANGER)).toBe(false);
  });

  test('a published article is viewable by anyone', () => {
    const a = { ...draft(), status: 'published' };
    expect(canView(a, STRANGER)).toBe(true);
    expect(canView(a, undefined)).toBe(true);
  });

  test('canEdit is author or accepted co-author only (not pending, not reviewer)', () => {
    const a = draft();
    expect(canEdit(a, AUTHOR)).toBe(true);
    expect(canEdit(a, ACCEPTED)).toBe(true);
    expect(canEdit(a, PENDING)).toBe(false); // read access is not edit access
    expect(canEdit(a, REVIEWER)).toBe(false);
    expect(canEdit(a, STRANGER)).toBe(false);
  });

  test('canDelete: owner (author/accepted co-author) on a non-published article', () => {
    const a = draft();
    expect(canDelete(a, AUTHOR)).toBe(true);
    expect(canDelete(a, ACCEPTED)).toBe(true);
    expect(canDelete(a, PENDING)).toBe(false);
    expect(canDelete(a, REVIEWER)).toBe(false);

    const published = { ...draft(), status: 'published' };
    expect(canDelete(published, AUTHOR)).toBe(false); // must unpublish first
    expect(canDelete(published, ACCEPTED)).toBe(false);
  });

  test('empty collaboration data is handled safely', () => {
    const a: ArticleAccess = {
      authorId: AUTHOR,
      status: 'draft',
      coAuthors: null,
      reviewedBy: null,
    };
    expect(canView(a, AUTHOR)).toBe(true);
    expect(canView(a, STRANGER)).toBe(false);
    expect(isAcceptedCoAuthor(a, ACCEPTED)).toBe(false);
    expect(isReviewer(a, REVIEWER)).toBe(false);
  });
});
