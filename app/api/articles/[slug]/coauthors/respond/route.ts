/**
 * Co-Author Response API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Accept or decline a co-author invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface CoAuthor {
  userId: string;
  invitedAt?: string;
  invitationMessage?: string;
  status: string;
  acceptedAt?: string;
}

/**
 * POST /api/articles/[slug]/coauthors/respond
 * Accept or decline a co-author invitation
 */
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

    const prisma = await getPrisma();

    const articleDoc = await prisma.article.findUnique({ where: { slug } });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "accept" or "decline"',
        },
        { status: 400 }
      );
    }

    // Find the invitation for this user
    const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
    const inviteIndex = coAuthors.findIndex(
      (ca) => ca.userId === session.user.id && ca.status === 'pending'
    );

    if (inviteIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'No pending invitation found' },
        { status: 404 }
      );
    }

    // Update invitation status
    const updatedCoAuthors = [...coAuthors];
    if (action === 'accept') {
      updatedCoAuthors[inviteIndex] = {
        ...updatedCoAuthors[inviteIndex],
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      };
    } else {
      updatedCoAuthors[inviteIndex] = {
        ...updatedCoAuthors[inviteIndex],
        status: 'declined',
      };
    }

    await prisma.article.update({
      where: { id: articleDoc.id },
      data: { coAuthors: updatedCoAuthors as any },
    });

    // Notify the author
    await createNotification({
      type: action === 'accept' ? 'Accept' : 'Reject',
      actorId: session.user.id,
      targetId: articleDoc.authorId,
      context: 'coauthor',
      objectId: articleDoc.id,
      objectType: 'article',
      objectTitle: articleDoc.title,
      objectUrl: `/articles/${articleDoc.slug}/edit`,
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'accept' ? 'Invitation accepted' : 'Invitation declined',
    });
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to respond to invitation' },
      { status: 500 }
    );
  }
}
