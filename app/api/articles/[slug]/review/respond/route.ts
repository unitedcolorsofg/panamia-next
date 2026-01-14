/**
 * Review Response API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Approve article or request revisions
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
 * POST /api/articles/[slug]/review/respond
 * Approve the article or request revisions
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

    // Verify current user is the assigned reviewer (using PostgreSQL user ID)
    if (
      !articleDoc.reviewedBy ||
      articleDoc.reviewedBy.userId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'You are not the assigned reviewer' },
        { status: 403 }
      );
    }

    // Can only respond to pending reviews
    if (articleDoc.reviewedBy.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Review has already been completed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, checklist, comment } = body;

    if (!action || !['approve', 'revision_needed'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "approve" or "revision_needed"',
        },
        { status: 400 }
      );
    }

    // Update checklist if provided
    if (checklist) {
      articleDoc.reviewedBy.checklist = {
        factsVerified: checklist.factsVerified || false,
        sourcesChecked: checklist.sourcesChecked || false,
        communityStandards: checklist.communityStandards || false,
      };
    }

    // For approval, verify checklist is complete
    if (action === 'approve') {
      const { factsVerified, sourcesChecked, communityStandards } =
        articleDoc.reviewedBy.checklist;

      if (!factsVerified || !sourcesChecked || !communityStandards) {
        return NextResponse.json(
          {
            success: false,
            error: 'All checklist items must be verified before approval',
          },
          { status: 400 }
        );
      }

      articleDoc.reviewedBy.status = 'approved';
      articleDoc.reviewedBy.approvedAt = new Date();
      articleDoc.status = 'draft'; // Back to draft, now publishable
    } else {
      // Add revision comment if provided
      if (comment) {
        articleDoc.reviewedBy.comments.push({
          id: `comment-${Date.now()}`,
          text: comment,
          createdAt: new Date(),
          resolved: false,
        });
      }

      articleDoc.reviewedBy.status = 'revision_needed';
      articleDoc.status = 'revision_needed';
    }

    await articleDoc.save();

    // Get author's userId from their profile
    const authorProfile = await Profile.findOne({
      email: articleDoc.authorEmail,
    }).select('userId');

    // Notify the author (if they have a userId)
    if (authorProfile?.userId) {
      await createNotification({
        type: action === 'approve' ? 'Accept' : 'Update',
        actorId: session.user.id,
        targetId: authorProfile.userId,
        context: 'review',
        objectId: articleDoc._id.toString(),
        objectType: 'article',
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}/edit`,
        message:
          action === 'approve'
            ? 'Your article has been approved and is ready to publish!'
            : comment || 'Revisions have been requested',
      });
    }

    // Also notify co-authors (they now have PostgreSQL user IDs)
    for (const coAuthor of articleDoc.coAuthors || []) {
      if (coAuthor.status === 'accepted' && coAuthor.userId) {
        await createNotification({
          type: action === 'approve' ? 'Accept' : 'Update',
          actorId: session.user.id,
          targetId: coAuthor.userId,
          context: 'review',
          objectId: articleDoc._id.toString(),
          objectType: 'article',
          objectTitle: articleDoc.title,
          objectUrl: `/articles/${articleDoc.slug}/edit`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message:
        action === 'approve'
          ? 'Article approved'
          : 'Revision request sent to authors',
    });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit review response' },
      { status: 500 }
    );
  }
}
