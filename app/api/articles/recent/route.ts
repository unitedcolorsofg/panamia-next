/**
 * Recent Articles API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Get recently published articles
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

interface CoAuthor {
  userId: string;
  status: string;
}

/**
 * GET /api/articles/recent
 * Get recently published articles (public)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // 'business_update' or 'community_commentary'
    const tag = searchParams.get('tag');

    // Build query conditions
    const conditions: any[] = [eq(articles.status, 'published')];

    if (type && ['business_update', 'community_commentary'].includes(type)) {
      conditions.push(eq(articles.articleType, type as any));
    }

    if (tag) {
      conditions.push(
        sql`${articles.tags} @> ARRAY[${tag.toLowerCase()}]::text[]`
      );
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    // Fetch articles and count
    const [articleRows, countResult] = await Promise.all([
      db.query.articles.findMany({
        where: () => whereClause,
        orderBy: (t, { desc }) => [desc(t.publishedAt)],
        offset,
        limit,
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const total = Number(countResult[0].count);

    // Enrich with author info
    const authorIds = [...new Set(articleRows.map((a) => a.authorId))];
    const authorRows =
      authorIds.length > 0
        ? await db.query.users.findMany({
            where: (t, { inArray }) => inArray(t.id, authorIds),
            columns: { id: true, screenname: true },
          })
        : [];
    const authorMap = new Map(
      authorRows.map((a) => [a.id, { screenname: a.screenname }])
    );

    const enrichedArticles = articleRows.map((a) => {
      const coAuthors = a.coAuthors as unknown as CoAuthor[] | null;
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        articleType: a.articleType,
        tags: a.tags,
        coverImage: a.coverImage,
        readingTime: a.readingTime,
        publishedAt: a.publishedAt,
        author: authorMap.get(a.authorId) || { screenname: null },
        coAuthorCount:
          coAuthors?.filter((ca) => ca.status === 'accepted').length || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: enrichedArticles,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + articleRows.length < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching recent articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
