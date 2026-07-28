import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contactSubmissions, contactSubmissionStatus } from '@/lib/schema';
import { count, eq } from 'drizzle-orm';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { isContactCategory } from '@/lib/contact-categories';

// Admin-facing view of Contact Us form submissions.
// GET   — paginated list, open (unhandled) first, optionally filtered by category.
// PATCH — flip a submission's status (open / actioned / dismissed).
//
// Modeled on /api/admin/relayReports: same pagination shape, same status-flip
// contract. Unlike relay reports, nothing here is terminal — every transition
// is reversible, because a Contact Us submission has no off-site copy to delete.

const VALID_STATUSES = new Set(contactSubmissionStatus.enumValues);

export async function GET(request: NextRequest) {
  const adminUser = await checkAdminAuth();
  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  const url = request.nextUrl ?? new URL(request.url);
  let page_number = parseInt(url.searchParams.get('page_number') ?? '1', 10);
  if (!Number.isFinite(page_number) || page_number < 1) page_number = 1;

  // An unrecognized category is treated as no filter rather than an error, so a
  // stale bookmark shows the full queue instead of a 400.
  const categoryParam = url.searchParams.get('category');
  const categoryFilter = isContactCategory(categoryParam)
    ? categoryParam
    : null;
  const where = categoryFilter
    ? eq(contactSubmissions.category, categoryFilter)
    : undefined;

  const per_page = 20;
  const offset = per_page * page_number - per_page;

  // Count with the same filter applied, or the pager reports pages the filtered
  // list doesn't have.
  const [{ total }] = await db
    .select({ total: count() })
    .from(contactSubmissions)
    .where(where);
  const submissionCount = Number(total);
  const pagination = {
    count: submissionCount,
    per_page,
    offset,
    page_number,
    total_pages:
      submissionCount > 0 ? Math.ceil(submissionCount / per_page) : 1,
  };

  // Open submissions first (unresolved work floats up), then newest.
  // Postgres sorts enum columns by DECLARED order, and contact_submission_status
  // is declared ('open','actioned','dismissed'), so asc puts open on top.
  const data = await db.query.contactSubmissions.findMany({
    where,
    orderBy: (t, { asc, desc }) => [asc(t.status), desc(t.createdAt)],
    limit: per_page,
    offset,
  });

  return NextResponse.json({
    success: true,
    data,
    pagination,
  });
}

export async function PATCH(request: NextRequest) {
  const adminUser = await checkAdminAuth();
  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  let body: { id?: string; status?: string; reason?: string };
  try {
    body = (await request.json()) as {
      id?: string;
      status?: string;
      reason?: string;
    };
  } catch {
    return NextResponse.json(
      { error: 'invalid: malformed json' },
      { status: 400 }
    );
  }

  const { id, status, reason } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'invalid: id' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status as never)) {
    return NextResponse.json({ error: 'invalid: status' }, { status: 400 });
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

  const [updated] = await db
    .update(contactSubmissions)
    .set({
      status: status as (typeof contactSubmissionStatus.enumValues)[number],
      // Reopening clears the note from the previous decision rather than
      // leaving a stale "dismissed because…" hanging off an open item.
      moderationReason:
        status === 'open' ? null : trimmedReason.slice(0, 2000) || null,
      lastModerationActionAt: new Date(),
    })
    .where(eq(contactSubmissions.id, id))
    .returning({
      id: contactSubmissions.id,
      status: contactSubmissions.status,
    });

  if (!updated) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}
