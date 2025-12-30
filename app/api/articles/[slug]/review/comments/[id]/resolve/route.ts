/**
 * Resolve Review Comment API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Mark a review comment as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';

interface RouteParams {
  params: Promise<{ slug: string; id: string }>;
}

/**
 * POST /api/articles/[slug]/review/comments/[id]/resolve
 * Mark a comment as resolved
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: commentId } = await params;

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

    // Check if user is author or co-author (they can resolve comments)
    const isAuthor =
      articleDoc.authorId.toString() === currentUser._id.toString();
    const isCoAuthor = articleDoc.coAuthors?.some(
      (ca: any) =>
        ca.userId.toString() === currentUser._id.toString() &&
        ca.status === 'accepted'
    );

    if (!isAuthor && !isCoAuthor) {
      return NextResponse.json(
        { success: false, error: 'Only authors can resolve comments' },
        { status: 403 }
      );
    }

    // Find and update the comment
    if (!articleDoc.reviewedBy?.comments) {
      return NextResponse.json(
        { success: false, error: 'No comments found' },
        { status: 404 }
      );
    }

    const commentIndex = articleDoc.reviewedBy.comments.findIndex(
      (c: any) => c.id === commentId
    );

    if (commentIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    articleDoc.reviewedBy.comments[commentIndex].resolved = true;
    articleDoc.reviewedBy.comments[commentIndex].resolvedAt = new Date();

    await articleDoc.save();

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
