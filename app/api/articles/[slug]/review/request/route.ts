/**
 * Review Request API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Request a review for an article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import Profile from '@/lib/model/profile';
import article from '@/lib/model/article';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/articles/[slug]/review/request
 * Request a user to review the article
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const articleDoc = await article.findOne({ slug });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check if user is author or accepted co-author (using email or userId)
    const isAuthor =
      articleDoc.authorEmail === session.user.email ||
      articleDoc.authorUserId === session.user.id;
    const isCoAuthor = articleDoc.coAuthors?.some(
      (ca: any) => ca.userId === session.user.id && ca.status === 'accepted'
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
    if (articleDoc.reviewedBy?.status === 'pending') {
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
    const reviewerProfile = await Profile.findOne({ userId });
    if (!reviewerProfile) {
      return NextResponse.json(
        { success: false, error: 'Reviewer profile not found' },
        { status: 404 }
      );
    }

    if (!reviewerProfile.slug) {
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

    const isReviewerCoAuthor = articleDoc.coAuthors?.some(
      (ca: any) => ca.userId === userId && ca.status === 'accepted'
    );
    if (isReviewerCoAuthor) {
      return NextResponse.json(
        { success: false, error: 'Cannot request review from a co-author' },
        { status: 400 }
      );
    }

    // Set up review request (store PostgreSQL user ID)
    articleDoc.reviewedBy = {
      userId,
      requestedAt: new Date(),
      invitationMessage: message || undefined,
      status: 'pending',
      checklist: {
        factsVerified: false,
        sourcesChecked: false,
        communityStandards: false,
      },
      comments: [],
    };
    articleDoc.status = 'pending_review';
    await articleDoc.save();

    // Create notification for reviewer
    await createNotification({
      type: 'Invite',
      actorId: session.user.id,
      targetId: userId,
      context: 'review',
      objectId: articleDoc._id.toString(),
      objectType: 'article',
      objectTitle: articleDoc.title,
      objectUrl: `/articles/${articleDoc.slug}/review`,
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
