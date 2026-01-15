/**
 * My Articles API - List user's articles
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Author dashboard article listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

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

    const prisma = await getPrisma();
    const currentUserId = session.user.id;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build status filter
    const statusFilter = status
      ? { in: status.split(',') as any[] }
      : undefined;

    // Query articles where user is author
    const authorArticles = await prisma.article.findMany({
      where: {
        authorId: currentUserId,
        ...(statusFilter ? { status: statusFilter as any } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
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
    const allArticles = await prisma.article.findMany({
      where: statusFilter ? { status: statusFilter as any } : undefined,
      orderBy: { updatedAt: 'desc' },
      select: {
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
    const articles = combined.slice(offset, offset + limit);

    // Determine user's role in each article
    const articlesWithRole = articles.map((a) => {
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
        hasMore: offset + articles.length < total,
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
