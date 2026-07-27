/**
 * Article permission predicates.
 *
 * Authorization only — deliberately kept separate from authentication
 * (better-auth). These are pure functions over an article row + a userId; the
 * caller resolves the session via better-auth's `auth()` and passes the id in.
 * Nothing here imports or knows about better-auth.
 *
 * Centralizing the definitions ("what is an accepted co-author", "who can
 * view/edit/delete") in one place prevents the per-route drift that caused
 * several authorization bugs (e.g. a pending invitee being 404'd off the
 * invitation page, or edit/read/delete each re-deriving co-author status
 * slightly differently).
 */

export interface CoAuthorEntry {
  userId: string;
  status: string; // 'pending' | 'accepted' | 'declined'
  invitationMessage?: string;
  invitedAt?: string;
  acceptedAt?: string;
}

export interface ReviewRecord {
  userId: string;
  status: string; // 'pending' | 'approved' | 'revision_needed'
  requestedAt?: string;
  approvedAt?: string;
  invitationMessage?: string;
  checklist?: Record<string, boolean>;
  comments?: { id: string; text: string }[];
}

/**
 * The subset of an article the predicates read. A full Drizzle article row
 * satisfies this structurally, so callers just pass the row.
 */
export interface ArticleAccess {
  authorId: string | null;
  status: string;
  coAuthors: unknown; // jsonb
  reviewedBy: unknown; // jsonb
}

export function coAuthorsOf(article: ArticleAccess): CoAuthorEntry[] {
  return (article.coAuthors as CoAuthorEntry[] | null) ?? [];
}

export function reviewOf(article: ArticleAccess): ReviewRecord | null {
  return (article.reviewedBy as ReviewRecord | null) ?? null;
}

export function isAuthor(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return !!userId && article.authorId === userId;
}

export function isAcceptedCoAuthor(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return (
    !!userId &&
    coAuthorsOf(article).some(
      (c) => c.userId === userId && c.status === 'accepted'
    )
  );
}

export function isPendingCoAuthor(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return (
    !!userId &&
    coAuthorsOf(article).some(
      (c) => c.userId === userId && c.status === 'pending'
    )
  );
}

/** The (single) reviewer, regardless of their review status. */
export function isReviewer(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  const review = reviewOf(article);
  return !!userId && !!review && review.userId === userId;
}

/**
 * Who may read a non-published article: the author, an accepted co-author, a
 * pending co-author (so the invitation page can load), or the reviewer.
 * Published articles are public.
 */
export function canView(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return (
    article.status === 'published' ||
    isAuthor(article, userId) ||
    isAcceptedCoAuthor(article, userId) ||
    isPendingCoAuthor(article, userId) ||
    isReviewer(article, userId)
  );
}

/** Who may edit content: the author or an accepted co-author. */
export function canEdit(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return isAuthor(article, userId) || isAcceptedCoAuthor(article, userId);
}

/**
 * Who may delete: an owner (author or accepted co-author), and only before
 * publication — a published article must be unpublished first.
 */
export function canDelete(
  article: ArticleAccess,
  userId?: string | null
): boolean {
  return (
    article.status !== 'published' &&
    (isAuthor(article, userId) || isAcceptedCoAuthor(article, userId))
  );
}
