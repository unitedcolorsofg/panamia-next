/**
 * POST /api/social/reports — report a post or an account for abuse.
 *
 * The in-app counterpart to the NIP-56 pipeline in
 * app/api/internal/relay/report. That route can only describe Nostr events
 * signed by a Nostr key; this one covers ordinary app content, which has
 * neither. See the docblock on `socialReports` in lib/schema.
 *
 * Takes EITHER `statusId` (reporting one post) or `username` (reporting the
 * account itself). One route rather than two because the decision, the reason
 * list and the moderation queue are identical — only the target differs.
 *
 * Deliberately returns the same success envelope for a brand-new report and
 * for one the dedup index swallowed. A reporter who taps twice should not be
 * told "you already reported this": it reads as an error, and the second tap
 * is usually distress rather than a mistake.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { socialActors, socialReports, socialStatuses } from '@/lib/schema';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getActorByScreenname } from '@/lib/federation';
import { notifyAdminsOfSocialReport } from '@/lib/server/social-reports';
import { isSocialReportReason } from '@/lib/social-report-reasons';

const DETAILS_MAX = 2000;
// Reported posts can be long-form. Snapshot enough for a moderator to judge
// the report without storing a second full copy of the content; HARD_CAP
// backstops pathological whitespace-free input before the word split.
const REPORTED_CONTENT_MAX_WORDS = 100;
const REPORTED_CONTENT_HARD_CAP = 20000;

function truncateWords(s: string, maxWords: number): string {
  const trimmed = s.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(' ')} …`;
}

interface ReportBody {
  statusId?: string;
  username?: string;
  reason?: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Malformed JSON' },
      { status: 400 }
    );
  }

  const { statusId, username, reason, details } = body;

  if (!isSocialReportReason(reason)) {
    return NextResponse.json(
      { success: false, error: 'A valid reason is required' },
      { status: 400 }
    );
  }
  if (!statusId && !username) {
    return NextResponse.json(
      { success: false, error: 'Either statusId or username is required' },
      { status: 400 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);
  if (!profile?.socialActor) {
    return NextResponse.json(
      { success: false, error: 'You must enable social features first' },
      { status: 403 }
    );
  }
  const reporterActor = profile.socialActor;
  const trimmedDetails =
    typeof details === 'string' ? details.slice(0, DETAILS_MAX) : '';

  // Resolve the target. Reporting a post also records the post's author, so
  // "everything ever reported about this account" stays one indexed lookup.
  let targetActorId: string;
  let targetHandle: string | null;
  let targetStatusId: string | null = null;
  let reportedContent: string | null = null;

  if (statusId) {
    const [row] = await db
      .select({
        id: socialStatuses.id,
        content: socialStatuses.content,
        actorId: socialActors.id,
        actorUsername: socialActors.username,
      })
      .from(socialStatuses)
      .innerJoin(socialActors, eq(socialActors.id, socialStatuses.actorId))
      .where(eq(socialStatuses.id, statusId))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    targetStatusId = row.id;
    targetActorId = row.actorId;
    targetHandle = row.actorUsername;
    reportedContent = row.content
      ? truncateWords(
          row.content.slice(0, REPORTED_CONTENT_HARD_CAP),
          REPORTED_CONTENT_MAX_WORDS
        )
      : null;
  } else {
    const targetActor = await getActorByScreenname(username as string);
    if (!targetActor) {
      return NextResponse.json(
        { success: false, error: 'Actor not found' },
        { status: 404 }
      );
    }
    targetActorId = targetActor.id;
    targetHandle = targetActor.username;
  }

  // Reporting yourself is always a mis-tap or a test, and letting it through
  // would put noise in a queue whose whole value is signal.
  if (targetActorId === reporterActor.id) {
    return NextResponse.json(
      { success: false, error: 'You cannot report yourself' },
      { status: 400 }
    );
  }

  const inserted = await db
    .insert(socialReports)
    .values({
      reporterActorId: reporterActor.id,
      reporterHandle: reporterActor.username,
      targetActorId,
      targetHandle,
      targetStatusId,
      reason,
      details: trimmedDetails,
      reportedContent,
    })
    // Bare ON CONFLICT DO NOTHING: the dedup index is an expression index
    // (COALESCE over target_status_id), which cannot be named as a conflict
    // target here. There is only one unique constraint on the table, so the
    // untargeted form means exactly the same thing.
    .onConflictDoNothing()
    .returning({ id: socialReports.id });

  // Only a genuinely new report is worth an email — a deduped repeat returns
  // an empty array, which keeps the inbox quiet. Best-effort; never throws.
  if (inserted.length > 0) {
    await notifyAdminsOfSocialReport({
      reporterHandle: reporterActor.username,
      targetHandle,
      targetStatusId,
      reason,
      details: trimmedDetails,
      reportedContent,
    });
  }

  return NextResponse.json({ success: true, data: { reported: true } });
}
