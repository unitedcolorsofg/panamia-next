import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { relayReports, relayReportStatus } from '@/lib/schema';
import { count, eq, and, isNotNull } from 'drizzle-orm';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { lookupScreennames } from '@/lib/server/relay-reports';
import { removeRelayEvents } from '@/lib/relay/crosspost-client';

// Admin-facing view of forwarded NIP-56 abuse reports (relay_reports).
// GET   — paginated list, newest first, open reports surfaced first.
// PATCH — flip a report's moderator status (open / actioned / dismissed).
//
// Unlike /api/internal/relay/report (Service-Binding ingest, no auth), this is
// the operator surface and is admin-gated. See docs/RELAY-ABUSE-REPORTS-ROADMAP.MD.

const VALID_STATUSES = new Set(relayReportStatus.enumValues);

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

  const [{ total }] = await db.select({ total: count() }).from(relayReports);
  const reportCount = Number(total);
  const pagination = {
    count: reportCount,
    per_page,
    offset,
    page_number,
    total_pages: reportCount > 0 ? Math.ceil(reportCount / per_page) : 1,
  };

  // Open reports first (so unresolved work floats up), then newest received.
  // Postgres sorts enum columns by their DECLARED order, not alphabetically;
  // relay_report_status is declared ('open','actioned','dismissed'), so asc
  // puts open at the top — which is exactly what we want here.
  const reportList = await db.query.relayReports.findMany({
    orderBy: (t, { asc, desc }) => [asc(t.status), desc(t.receivedAt)],
    limit: per_page,
    offset,
  });

  // Resolve reporter/target pubkeys to panamia screennames for display.
  const names = await lookupScreennames(
    reportList.flatMap((r) => [r.reporterPubkey, r.targetPubkey])
  );

  // Reported events whose content has already been removed from the relay (any
  // report on that event reached the terminal 'removed' state), mapped to when
  // that removal happened (the latest moderation action on a removed sibling).
  // Lets sibling reports of the same post reflect that the content is gone and
  // surface the same "recently removed" warning.
  const removedRows = await db
    .select({
      targetEventId: relayReports.targetEventId,
      lastModerationActionAt: relayReports.lastModerationActionAt,
    })
    .from(relayReports)
    .where(
      and(
        eq(relayReports.status, 'removed'),
        isNotNull(relayReports.targetEventId)
      )
    );
  const removedTargets = new Map<string, Date | null>();
  for (const r of removedRows) {
    if (!r.targetEventId) continue;
    const prev = removedTargets.get(r.targetEventId) ?? null;
    // Keep the most recent removal timestamp for the event.
    if (
      !prev ||
      (r.lastModerationActionAt && r.lastModerationActionAt > prev)
    ) {
      removedTargets.set(r.targetEventId, r.lastModerationActionAt ?? prev);
    }
  }

  const data = reportList.map((r) => {
    const contentRemoved =
      r.status === 'removed' ||
      (!!r.targetEventId && removedTargets.has(r.targetEventId));
    // When the content removal happened: this report's own moderation
    // timestamp if it was the one removed, otherwise the removing sibling's.
    const contentRemovedAt = !contentRemoved
      ? null
      : r.status === 'removed'
        ? r.lastModerationActionAt
        : (r.targetEventId && removedTargets.get(r.targetEventId)) || null;
    return {
      ...r,
      reporterName: names[r.reporterPubkey.toLowerCase()] ?? null,
      targetName: r.targetPubkey
        ? (names[r.targetPubkey.toLowerCase()] ?? null)
        : null,
      // True when this report's content is gone — either this report removed
      // it, or a sibling report on the same event did.
      contentRemoved,
      // ISO timestamp of when the content was removed, or null if not removed.
      contentRemovedAt,
    };
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

  // Load the current report so we can enforce the terminal-state rule and, for
  // removal, know which relay events to delete.
  const [current] = await db
    .select({
      id: relayReports.id,
      status: relayReports.status,
      eventId: relayReports.eventId,
      targetEventId: relayReports.targetEventId,
    })
    .from(relayReports)
    .where(eq(relayReports.id, id))
    .limit(1);

  if (!current) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // 'removed' is terminal and non-revocable — the relay copies are gone, so no
  // transition away from it is allowed.
  if (current.status === 'removed') {
    return NextResponse.json(
      { error: 'report is removed (non-revocable)' },
      { status: 409 }
    );
  }

  // Remove from relay: hard-delete the reported content + the report event,
  // then record the terminal status.
  if (status === 'removed') {
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    // Is the content already gone (a sibling report on the same event removed
    // it)? If so this is a stray-report cleanup ("Remove report from relay"),
    // which needs no moderation reason. Only the content-removing action does.
    let contentAlreadyRemoved = false;
    if (current.targetEventId) {
      const [sib] = await db
        .select({ id: relayReports.id })
        .from(relayReports)
        .where(
          and(
            eq(relayReports.targetEventId, current.targetEventId),
            eq(relayReports.status, 'removed')
          )
        )
        .limit(1);
      contentAlreadyRemoved = !!sib;
    }

    if (!contentAlreadyRemoved && !trimmedReason) {
      return NextResponse.json(
        { error: 'invalid: a moderation reason is required to remove content' },
        { status: 400 }
      );
    }

    const idsToRemove = [current.targetEventId, current.eventId].filter(
      (v): v is string => !!v
    );
    try {
      await removeRelayEvents(idsToRemove);
    } catch (err) {
      console.error('Relay removal failed:', err);
      return NextResponse.json(
        { error: 'relay removal failed; report left unchanged' },
        { status: 502 }
      );
    }

    const [updated] = await db
      .update(relayReports)
      .set({
        status: 'removed',
        moderationReason: trimmedReason ? trimmedReason.slice(0, 2000) : null,
        lastModerationActionAt: new Date(),
      })
      .where(eq(relayReports.id, id))
      .returning({ id: relayReports.id, status: relayReports.status });
    return NextResponse.json({ success: true, data: updated });
  }

  // Non-terminal status flips (open / actioned / dismissed).
  const [updated] = await db
    .update(relayReports)
    .set({
      status: status as (typeof relayReportStatus.enumValues)[number],
      lastModerationActionAt: new Date(),
    })
    .where(eq(relayReports.id, id))
    .returning({ id: relayReports.id, status: relayReports.status });

  return NextResponse.json({ success: true, data: updated });
}
