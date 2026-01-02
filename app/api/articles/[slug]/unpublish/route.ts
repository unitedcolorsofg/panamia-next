/**
 * Unpublish Article API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Revert a published article to draft status
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
 * POST /api/articles/[slug]/unpublish
 * Unpublish an article (revert to draft)
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

    // Only author can unpublish
    if (articleDoc.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'Only the author can unpublish this article' },
        { status: 403 }
      );
    }

    if (articleDoc.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Article is not published' },
        { status: 400 }
      );
    }

    // Unpublish - revert to draft
    articleDoc.status = 'draft';
    articleDoc.publishedAt = undefined;
    await articleDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        slug: articleDoc.slug,
        status: articleDoc.status,
      },
    });
  } catch (error) {
    console.error('Error unpublishing article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unpublish article' },
      { status: 500 }
    );
  }
}
