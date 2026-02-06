/**
 * Article Replies API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Get articles that are replies to this article
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/articles/[slug]/replies
 * Get articles replying to this one
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const prisma = await getPrisma();

    // Find the parent article
    const parentArticle = await prisma.article.findUnique({ where: { slug } });
    if (!parentArticle) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only show replies to published articles
    if (parentArticle.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Find reply articles
    const replies = await prisma.article.findMany({
      where: {
        inReplyTo: parentArticle.id,
        status: 'published',
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Enrich with author info
    const authorIds = [...new Set(replies.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, screenname: true },
    });
    const authorMap = new Map(
      authors.map((a) => [a.id, { screenname: a.screenname }])
    );

    const enrichedReplies = replies.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      publishedAt: a.publishedAt,
      author: authorMap.get(a.authorId) || { screenname: null },
    }));

    return NextResponse.json({
      success: true,
      data: {
        replies: enrichedReplies,
      },
    });
  } catch (error) {
    console.error('Error fetching article replies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}
