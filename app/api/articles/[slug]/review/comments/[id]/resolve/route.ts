/**
 * Resolve Review Comment API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Mark a review comment as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string; id: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
}

interface ReviewComment {
  id: string;
  text: string;
  contentRef?: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

interface ReviewedBy {
  userId: string;
  status: string;
  checklist: any;
  comments: ReviewComment[];
}

/**
 * POST /api/articles/[slug]/review/comments/[id]/resolve
 * Mark a comment as resolved
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: commentId } = await params;

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

    // Check if user is author or co-author (they can resolve comments)
    const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
    const isAuthor = articleDoc.authorId === session.user.id;
    const isCoAuthor = coAuthors.some(
      (ca) => ca.userId === session.user.id && ca.status === 'accepted'
    );

    if (!isAuthor && !isCoAuthor) {
      return NextResponse.json(
        { success: false, error: 'Only authors can resolve comments' },
        { status: 403 }
      );
    }

    // Find and update the comment
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;
    if (!reviewedBy?.comments) {
      return NextResponse.json(
        { success: false, error: 'No comments found' },
        { status: 404 }
      );
    }

    const commentIndex = reviewedBy.comments.findIndex(
      (c) => c.id === commentId
    );

    if (commentIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Update the comment
    const updatedComments = [...reviewedBy.comments];
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      resolved: true,
      resolvedAt: new Date().toISOString(),
    };

    const updatedReviewedBy = {
      ...reviewedBy,
      comments: updatedComments,
    };

    await prisma.article.update({
      where: { id: articleDoc.id },
      data: { reviewedBy: updatedReviewedBy as any },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment resolved',
    });
  } catch (error) {
    console.error('Error resolving comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve comment' },
      { status: 500 }
    );
  }
}
