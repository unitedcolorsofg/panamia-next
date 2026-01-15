/**
 * Publish Article API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Publish an article that meets all requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { isPublishable } from '@/lib/article';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
}

interface ReviewedBy {
  userId: string;
  status: string;
}

/**
 * POST /api/articles/[slug]/publish
 * Publish an article
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

    // Only author can publish
    if (articleDoc.authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the author can publish this article' },
        { status: 403 }
      );
    }

    // Check if article can be published
    if (articleDoc.status === 'published') {
      return NextResponse.json(
        { success: false, error: 'Article is already published' },
        { status: 400 }
      );
    }

    if (articleDoc.status === 'removed') {
      return NextResponse.json(
        { success: false, error: 'Cannot publish a removed article' },
        { status: 400 }
      );
    }

    // Check publishability requirements
    const coAuthors = articleDoc.coAuthors as unknown as CoAuthor[] | null;
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;

    const publishCheck = isPublishable({
      title: articleDoc.title,
      content: articleDoc.content,
      coAuthors: coAuthors || [],
      reviewedBy: reviewedBy || undefined,
      status: articleDoc.status as any,
    });
    if (!publishCheck.publishable) {
      return NextResponse.json(
        { success: false, error: publishCheck.reason },
        { status: 400 }
      );
    }

    // Publish the article
    const updatedArticle = await prisma.article.update({
      where: { id: articleDoc.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    // Notify co-authors that article is published
    const acceptedCoAuthors = coAuthors?.filter(
      (ca) => ca.status === 'accepted' && ca.userId
    );

    for (const coAuthor of acceptedCoAuthors || []) {
      await createNotification({
        type: 'Create',
        context: 'article',
        actorId: session.user.id,
        targetId: coAuthor.userId,
        objectUrl: `/articles/${articleDoc.slug}`,
        objectTitle: articleDoc.title,
      });
    }

    // Notify reviewer if there was one
    if (reviewedBy?.userId && reviewedBy.status === 'approved') {
      await createNotification({
        type: 'Create',
        context: 'article',
        actorId: session.user.id,
        targetId: reviewedBy.userId,
        objectUrl: `/articles/${articleDoc.slug}`,
        objectTitle: articleDoc.title,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: updatedArticle.slug,
        status: updatedArticle.status,
        publishedAt: updatedArticle.publishedAt,
      },
    });
  } catch (error) {
    console.error('Error publishing article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to publish article' },
      { status: 500 }
    );
  }
}
