/**
 * My Articles API - List user's articles
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Author dashboard article listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { articles } from '@/lib/schema';
import type { ArticleStatus } from '@/lib/schema';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

interface CoAuthor {
  userId: string;
  status: string;
}

/**
 * GET /api/articles/my - List current user's articles (author or co-author)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentUserId = session.user.id;

    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const statusValues = status ? (status.split(',') as ArticleStatus[]) : null;

    // Author OR co-author, in one indexed query. The co-author arm is a JSONB
    // containment match backed by articles_co_authors_gin_idx (migration 0029),
    // replacing the previous scan-all-articles-and-filter-in-JS approach.
    const authorship = or(
      eq(articles.authorId, currentUserId),
      sql`${articles.coAuthors} @> ${JSON.stringify([{ userId: currentUserId }])}::jsonb`
    );
    const whereClause = and(
      authorship,
      statusValues ? inArray(articles.status, statusValues) : undefined
    );

    const [rows, countResult] = await Promise.all([
      db.query.articles.findMany({
        where: whereClause,
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        limit,
        offset,
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          articleType: true,
          status: true,
          authorId: true,
          coAuthors: true,
          publishedAt: true,
          updatedAt: true,
          readingTime: true,
        },
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const total = Number(countResult[0].count);

    // Determine user's role in each article
    const articlesWithRole = rows.map((a) => {
      const isAuthor = a.authorId === currentUserId;
      const coAuthors = a.coAuthors as unknown as CoAuthor[] | null;
      const coAuthorEntry = coAuthors?.find(
        (ca) => ca.userId === currentUserId
      );

      return {
        ...a,
        userRole: isAuthor ? 'author' : 'coauthor',
        coAuthorStatus: coAuthorEntry?.status,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: articlesWithRole,
        total,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing user articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list articles' },
      { status: 500 }
    );
  }
}
