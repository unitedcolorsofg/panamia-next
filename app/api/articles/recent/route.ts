/**
 * Recent Articles API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Get recently published articles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

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

    const prisma = await getPrisma();

    // Build query
    const where: any = { status: 'published' };

    if (type && ['business_update', 'community_commentary'].includes(type)) {
      where.articleType = type;
    }

    if (tag) {
      where.tags = { has: tag.toLowerCase() };
    }

    // Fetch articles and count
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    // Enrich with author info
    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, screenname: true },
    });
    const authorMap = new Map(
      authors.map((a) => [a.id, { screenname: a.screenname }])
    );

    const enrichedArticles = articles.map((a) => {
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
          hasMore: offset + articles.length < total,
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
