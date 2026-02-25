/**
 * Article Replies API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Get articles that are replies to this article
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { and, eq, inArray } from 'drizzle-orm';

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

    // Find the parent article
    const parentArticle = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });
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
    const replies = await db.query.articles.findMany({
      where: and(
        eq(articles.inReplyTo, parentArticle.id),
        eq(articles.status, 'published')
      ),
      orderBy: (a, { desc }) => [desc(a.publishedAt)],
    });

    // Enrich with author info
    const authorIds = [...new Set(replies.map((a) => a.authorId))];
    const authors = await db
      .select({ id: users.id, screenname: users.screenname })
      .from(users)
      .where(inArray(users.id, authorIds));
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
