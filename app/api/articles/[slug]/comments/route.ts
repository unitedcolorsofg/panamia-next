/**
 * Article Comments API (Mastodon-powered)
 *
 * Fetches comments from Mastodon for articles that have a linked post.
 * Uses the public Mastodon API - no authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { fetchArticleComments } from '@/lib/mastodon';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/articles/[slug]/comments
 * Fetch Mastodon comments for an article
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Find the article
    const articleDoc = await db.query.articles.findFirst({
      where: and(eq(articles.slug, slug), eq(articles.status, 'published')),
      columns: { mastodonPostUrl: true },
    });

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const mastodonPostUrl = articleDoc.mastodonPostUrl;

    // If no Mastodon post linked, return empty comments
    if (!mastodonPostUrl) {
      return NextResponse.json({
        success: true,
        data: {
          comments: [],
          postUrl: null,
          hasComments: false,
        },
      });
    }

    // Fetch comments from Mastodon
    const result = await fetchArticleComments(mastodonPostUrl);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: {
          comments: [],
          postUrl: mastodonPostUrl,
          hasComments: false,
          error: 'Failed to fetch comments from Mastodon',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        comments: result.comments,
        postUrl: result.postUrl,
        hasComments: result.comments.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching article comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
