/**
 * Article Search API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Search published articles by title for reply selection
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

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

    await dbConnect();

    // Build search query
    const searchQuery: Record<string, unknown> = {
      status: 'published',
      title: { $regex: query, $options: 'i' },
    };

    if (excludeSlug) {
      searchQuery.slug = { $ne: excludeSlug };
    }

    // Search articles
    const articles = await article
      .find(searchQuery)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('_id slug title excerpt publishedAt authorId')
      .lean();

    // Get author info
    const authorIds = [
      ...new Set(articles.map((a: any) => a.authorId.toString())),
    ];
    const authors = await user.find({ _id: { $in: authorIds } }).lean();
    const authorMap = new Map(
      authors.map((a: any) => [
        a._id.toString(),
        { screenname: a.screenname, name: a.name },
      ])
    );

    const enrichedArticles = articles.map((a: any) => ({
      _id: a._id.toString(),
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      publishedAt: a.publishedAt,
      author: authorMap.get(a.authorId.toString()) || { screenname: null },
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
