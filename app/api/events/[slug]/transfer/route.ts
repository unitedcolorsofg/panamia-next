/**
 * Hand an event to a different host.
 *
 * Transfer exists because account deletion already promises it. Deleting your
 * account is blocked while you host upcoming events, with the instruction
 * "Cancel or transfer them first" -- and until now there was no transfer, so
 * the only way out was to cancel events that other people were coming to.
 *
 * Scope is deliberately self-service: you may move an event between yourself
 * and the groups you run. Handing one to *another pana* is a different
 * feature, because an event carries obligations -- a venue booking, a roster
 * of people expecting you -- and none of that should land on someone who has
 * not agreed to it. That needs a pending offer they can decline, so it is not
 * folded in here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { canTransferEvent, listHostableGroups } from '@/lib/server/event-host';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface TransferBody {
  /**
   * The group to hand the event to, or null to take it into your own name.
   * Null rather than a separate `target: 'self'` so the field matches the
   * column it writes and the two hosts stay visibly mutually exclusive.
   */
  hostGroupId?: string | null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
      columns: {
        id: true,
        slug: true,
        hostProfileId: true,
        hostGroupId: true,
      },
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { id: true },
    });

    // Narrower than managing the event: a group's moderators can edit and
    // publish it without being able to give it away.
    if (!profile || !(await canTransferEvent(event, profile.id))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the host can transfer this event',
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as TransferBody;
    const requestedGroupId = body.hostGroupId ?? null;

    if (requestedGroupId) {
      // Recomputed rather than trusted. The UI filters the same set, but that
      // is presentation -- this is the check that matters.
      const hostable = await listHostableGroups(profile.id);
      if (!hostable.some((g) => g.id === requestedGroupId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'You cannot host events as that group',
          },
          { status: 403 }
        );
      }
    }

    const alreadyThere = requestedGroupId
      ? event.hostGroupId === requestedGroupId
      : event.hostProfileId === profile.id;
    if (alreadyThere) {
      return NextResponse.json(
        { success: false, error: 'That is already the host' },
        { status: 400 }
      );
    }

    // Exactly one host, or the events_single_host CHECK rejects the write.
    const [updated] = await db
      .update(events)
      .set({
        hostProfileId: requestedGroupId ? null : profile.id,
        hostGroupId: requestedGroupId,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning({
        slug: events.slug,
        hostProfileId: events.hostProfileId,
        hostGroupId: events.hostGroupId,
      });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('events:transfer:error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transfer event' },
      { status: 500 }
    );
  }
}
