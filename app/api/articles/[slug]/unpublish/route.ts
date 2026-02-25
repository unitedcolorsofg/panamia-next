/**
 * Unpublish Article API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Revert a published article to draft status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { articles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

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
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const articleDoc = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only author can unpublish
    if (articleDoc.authorId !== session.user.id) {
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
    const [updatedArticle] = await db
      .update(articles)
      .set({ status: 'draft', publishedAt: null })
      .where(eq(articles.id, articleDoc.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        slug: updatedArticle.slug,
        status: updatedArticle.status,
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
