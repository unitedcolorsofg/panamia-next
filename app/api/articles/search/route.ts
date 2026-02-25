/**
 * Article Search API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Search published articles by title for reply selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { eq, and, ne, ilike } from 'drizzle-orm';

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

    // Build search conditions
    const conditions: any[] = [
      eq(articles.status, 'published'),
      ilike(articles.title, `%${query}%`),
    ];

    if (excludeSlug) {
      conditions.push(ne(articles.slug, excludeSlug));
    }

    // Search articles
    const articleRows = await db.query.articles.findMany({
      where: (t, { eq, and, ne, ilike }) => {
        const conds: any[] = [
          eq(t.status, 'published'),
          ilike(t.title, `%${query}%`),
        ];
        if (excludeSlug) {
          conds.push(ne(t.slug, excludeSlug));
        }
        return and(...conds);
      },
      orderBy: (t, { desc }) => [desc(t.publishedAt)],
      limit,
      columns: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        authorId: true,
      },
    });

    // Get author info
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

    const enrichedArticles = articleRows.map((a) => ({
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
