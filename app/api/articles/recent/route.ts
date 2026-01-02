/**
 * Recent Articles API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Get recently published articles
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

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

    await dbConnect();

    // Build query
    const query: Record<string, unknown> = { status: 'published' };

    if (type && ['business_update', 'community_commentary'].includes(type)) {
      query.articleType = type;
    }

    if (tag) {
      query.tags = tag.toLowerCase();
    }

    // Fetch articles
    const articles = await article
      .find(query)
      .sort({ publishedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await article.countDocuments(query);

    // Enrich with author info
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
      articleType: a.articleType,
      tags: a.tags,
      coverImage: a.coverImage,
      readingTime: a.readingTime,
      publishedAt: a.publishedAt,
      author: authorMap.get(a.authorId.toString()) || { screenname: null },
      coAuthorCount:
        a.coAuthors?.filter((ca: any) => ca.status === 'accepted').length || 0,
    }));

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
