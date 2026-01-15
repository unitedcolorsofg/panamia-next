/**
 * Unpublish Article API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Revert a published article to draft status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

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

    const prisma = await getPrisma();

    const articleDoc = await prisma.article.findUnique({ where: { slug } });
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
    const updatedArticle = await prisma.article.update({
      where: { id: articleDoc.id },
      data: {
        status: 'draft',
        publishedAt: null,
      },
    });

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
