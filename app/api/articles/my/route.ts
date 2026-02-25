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
import { eq, inArray, desc } from 'drizzle-orm';

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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build status filter
    const statusValues = status ? status.split(',') : null;

    // Query articles where user is author
    const authorArticles = await db.query.articles.findMany({
      where: (t, { eq, and, inArray }) =>
        statusValues
          ? and(
              eq(t.authorId, currentUserId),
              inArray(t.status, statusValues as any[])
            )
          : eq(t.authorId, currentUserId),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
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
    });

    // Query all articles to check coAuthors (JSONB filtering)
    const allArticles = await db.query.articles.findMany({
      where: statusValues
        ? (t, { inArray }) => inArray(t.status, statusValues as any[])
        : undefined,
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
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
    });

    // Filter for co-authored articles
    const coAuthoredArticles = allArticles.filter((a) => {
      if (a.authorId === currentUserId) return false;
      const coAuthors = a.coAuthors as unknown as CoAuthor[] | null;
      return coAuthors?.some((ca) => ca.userId === currentUserId);
    });

    // Merge and sort by updatedAt
    const combined = [...authorArticles, ...coAuthoredArticles].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    // Apply pagination
    const total = combined.length;
    const paginatedArticles = combined.slice(offset, offset + limit);

    // Determine user's role in each article
    const articlesWithRole = paginatedArticles.map((a) => {
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
        hasMore: offset + paginatedArticles.length < total,
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
