/**
 * Publish Article API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Publish an article that meets all requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import { createNotification } from '@/lib/notifications';
import { isPublishable } from '@/lib/article';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/articles/[slug]/publish
 * Publish an article
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

    // Only author can publish (check by email or userId)
    if (
      articleDoc.authorEmail !== session.user.email &&
      articleDoc.authorUserId !== session.user.id
    ) {
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
    const publishCheck = isPublishable(articleDoc);
    if (!publishCheck.publishable) {
      return NextResponse.json(
        { success: false, error: publishCheck.reason },
        { status: 400 }
      );
    }

    // Publish the article
    articleDoc.status = 'published';
    articleDoc.publishedAt = new Date();
    await articleDoc.save();

    // Notify co-authors that article is published (they now have PostgreSQL user IDs)
    const acceptedCoAuthors = articleDoc.coAuthors?.filter(
      (ca: any) => ca.status === 'accepted' && ca.userId
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

    // Notify reviewer if there was one (they now have PostgreSQL user ID)
    if (
      articleDoc.reviewedBy?.userId &&
      articleDoc.reviewedBy.status === 'approved'
    ) {
      await createNotification({
        type: 'Create',
        context: 'article',
        actorId: session.user.id,
        targetId: articleDoc.reviewedBy.userId,
        objectUrl: `/articles/${articleDoc.slug}`,
        objectTitle: articleDoc.title,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: articleDoc.slug,
        status: articleDoc.status,
        publishedAt: articleDoc.publishedAt,
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
