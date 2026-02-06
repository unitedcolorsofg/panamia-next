/**
 * Review Comments API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Add comments during article review
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
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
}

interface ReviewedBy {
  userId: string;
  status: string;
  checklist: any;
  comments: ReviewComment[];
}

/**
 * POST /api/articles/[slug]/review/comments
 * Add a review comment
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

    // Verify current user is the assigned reviewer
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;
    if (!reviewedBy || reviewedBy.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You are not the assigned reviewer' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { text, contentRef } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Add comment
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newComment: ReviewComment = {
      id: commentId,
      text: text.trim(),
      contentRef: contentRef || undefined,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    const updatedReviewedBy = {
      ...reviewedBy,
      comments: [...reviewedBy.comments, newComment],
    };

    await prisma.article.update({
      where: { id: articleDoc.id },
      data: { reviewedBy: updatedReviewedBy as any },
    });

    return NextResponse.json({
      success: true,
      data: newComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/articles/[slug]/review/comments
 * Get all review comments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Check if user has access (author, co-author, or reviewer)
    const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;

    const isAuthor = articleDoc.authorId === session.user.id;
    const isCoAuthor = coAuthors.some(
      (ca) => ca.userId === session.user.id && ca.status === 'accepted'
    );
    const isReviewer = reviewedBy?.userId === session.user.id;

    if (!isAuthor && !isCoAuthor && !isReviewer) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        comments: reviewedBy?.comments || [],
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
