/**
 * Review Request API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Request a review for an article
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
  status: string;
}

interface ReviewedBy {
  userId: string;
  requestedAt: string;
  invitationMessage?: string;
  status: string;
  checklist: {
    factsVerified: boolean;
    sourcesChecked: boolean;
    communityStandards: boolean;
  };
  comments: any[];
}

/**
 * POST /api/articles/[slug]/review/request
 * Request a user to review the article
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

    // Check if user is author or accepted co-author
    const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
    const isAuthor = articleDoc.authorId === session.user.id;
    const isCoAuthor = coAuthors.some(
      (ca) => ca.userId === session.user.id && ca.status === 'accepted'
    );

    if (!isAuthor && !isCoAuthor) {
      return NextResponse.json(
        { success: false, error: 'Only authors can request reviews' },
        { status: 403 }
      );
    }

    // Can only request review for draft or revision_needed articles
    if (
      articleDoc.status !== 'draft' &&
      articleDoc.status !== 'revision_needed'
    ) {
      return NextResponse.json(
        { success: false, error: 'Can only request review for draft articles' },
        { status: 400 }
      );
    }

    // Check if there's already a pending review
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;
    if (reviewedBy?.status === 'pending') {
      return NextResponse.json(
        { success: false, error: 'A review is already pending' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId, message } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Reviewer user ID is required' },
        { status: 400 }
      );
    }

    // Verify reviewer has a profile with screenname
    const reviewerProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { screenname: true } } },
    });
    if (!reviewerProfile) {
      return NextResponse.json(
        { success: false, error: 'Reviewer profile not found' },
        { status: 404 }
      );
    }

    if (!reviewerProfile.user?.screenname) {
      return NextResponse.json(
        { success: false, error: 'Reviewer must have a screenname' },
        { status: 400 }
      );
    }

    // Cannot request review from author or co-authors
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot request review from yourself' },
        { status: 400 }
      );
    }

    const isReviewerCoAuthor = coAuthors.some(
      (ca) => ca.userId === userId && ca.status === 'accepted'
    );
    if (isReviewerCoAuthor) {
      return NextResponse.json(
        { success: false, error: 'Cannot request review from a co-author' },
        { status: 400 }
      );
    }

    // Set up review request
    const newReviewedBy: ReviewedBy = {
      userId,
      requestedAt: new Date().toISOString(),
      invitationMessage: message || undefined,
      status: 'pending',
      checklist: {
        factsVerified: false,
        sourcesChecked: false,
        communityStandards: false,
      },
      comments: [],
    };

    await prisma.article.update({
      where: { id: articleDoc.id },
      data: {
        reviewedBy: newReviewedBy as any,
        status: 'pending_review',
      },
    });

    // Create notification for reviewer
    await createNotification({
      type: 'Invite',
      actorId: session.user.id,
      targetId: userId,
      context: 'review',
      objectId: articleDoc.id,
      objectType: 'article',
      objectTitle: articleDoc.title,
      objectUrl: `/a/${articleDoc.slug}/review`,
      message: message || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Review request sent',
    });
  } catch (error) {
    console.error('Error requesting review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request review' },
      { status: 500 }
    );
  }
}
