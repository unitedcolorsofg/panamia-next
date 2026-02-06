/**
 * Article Search API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Search published articles by title for reply selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * GET /api/articles/search
 * Search published articles by title
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const excludeSlug = searchParams.get('exclude'); // Exclude current article when editing

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { articles: [] },
      });
    }

    const prisma = await getPrisma();

    // Build search query
    const where: any = {
      status: 'published',
      title: { contains: query, mode: 'insensitive' },
    };

    if (excludeSlug) {
      where.slug = { not: excludeSlug };
    }

    // Search articles
    const articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        authorId: true,
      },
    });

    // Get author info
    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, screenname: true },
    });
    const authorMap = new Map(
      authors.map((a) => [a.id, { screenname: a.screenname }])
    );

    const enrichedArticles = articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      publishedAt: a.publishedAt,
      author: authorMap.get(a.authorId) || { screenname: null },
    }));

    return NextResponse.json({
      success: true,
      data: { articles: enrichedArticles },
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search articles' },
      { status: 500 }
    );
  }
}
