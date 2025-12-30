/**
 * Review Comments API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Add comments during article review
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/articles/[slug]/review/comments
 * Add a review comment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const articleDoc = await article.findOne({ slug });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Verify current user is the assigned reviewer
    if (
      !articleDoc.reviewedBy ||
      articleDoc.reviewedBy.userId.toString() !== currentUser._id.toString()
    ) {
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
    articleDoc.reviewedBy.comments.push({
      id: commentId,
      text: text.trim(),
      contentRef: contentRef || undefined,
      createdAt: new Date(),
      resolved: false,
    });

    await articleDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        id: commentId,
        text: text.trim(),
        contentRef,
        createdAt: new Date(),
        resolved: false,
      },
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
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const articleDoc = await article.findOne({ slug }).lean();
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check if user has access (author, co-author, or reviewer)
    const isAuthor =
      articleDoc.authorId.toString() === currentUser._id.toString();
    const isCoAuthor = articleDoc.coAuthors?.some(
      (ca: any) =>
        ca.userId.toString() === currentUser._id.toString() &&
        ca.status === 'accepted'
    );
    const isReviewer =
      articleDoc.reviewedBy?.userId?.toString() === currentUser._id.toString();

    if (!isAuthor && !isCoAuthor && !isReviewer) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        comments: articleDoc.reviewedBy?.comments || [],
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
