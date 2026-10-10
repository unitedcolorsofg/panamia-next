import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialReports, socialReportStatus } from '@/lib/schema';
import { count, eq } from 'drizzle-orm';
import { checkAdminAuth } from '@/lib/server/admin-auth';

// Admin-facing view of in-app abuse reports (social_reports).
// GET   — paginated list, open reports first, oldest first within that.
// PATCH — flip a report's moderator status (open / actioned / dismissed).
//
// The sibling of /api/admin/relayReports, deliberately kept separate: that
// queue is resolved by deleting an event from the Nostr relay, this one by
// acting on our own rows. Same shape, different levers. See the docblock on
// `socialReports` in lib/schema.

const VALID_STATUSES = new Set(socialReportStatus.enumValues);

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

  const per_page = 20;
  const offset = per_page * page_number - per_page;

  const [{ total }] = await db.select({ total: count() }).from(socialReports);
  const reportCount = Number(total);
  const pagination = {
    count: reportCount,
    per_page,
    offset,
    page_number,
    total_pages: reportCount > 0 ? Math.ceil(reportCount / per_page) : 1,
  };

  // Open first, then oldest first inside each status — FIFO, so nothing rots
  // at the bottom of the queue while newer reports get handled.
  //
  // Postgres sorts enum columns by DECLARED order, not alphabetically, and
  // social_report_status is declared ('open','actioned','dismissed'), so
  // asc(status) puts the unhandled work on top. Matches the composite index
  // social_reports_status_created_idx.
  const data = await db.query.socialReports.findMany({
    orderBy: (t, { asc }) => [asc(t.status), asc(t.createdAt)],
    limit: per_page,
    offset,
  });

  // No screenname lookup here, unlike the relay queue: reporter and target
  // handles are denormalised onto the row precisely so the queue still reads
  // as a sentence after an account is deleted.
  return NextResponse.json({ success: true, data, pagination });
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

  // Every status here is revocable, unlike relay_reports' terminal 'removed'.
  // Nothing is destroyed by triaging an in-app report, so a moderator who
  // mis-clicks can simply put it back to open.
  const [updated] = await db
    .update(socialReports)
    .set({
      status: status as (typeof socialReportStatus.enumValues)[number],
      moderationReason: trimmedReason ? trimmedReason.slice(0, 2000) : null,
      lastModerationActionAt: new Date(),
    })
    .where(eq(socialReports.id, id))
    .returning({ id: socialReports.id, status: socialReports.status });

  if (!updated) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}
