/**
 * Article Comments API (Mastodon-powered)
 *
 * Fetches comments from Mastodon for articles that have a linked toot.
 * Uses the public Mastodon API - no authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
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

    await dbConnect();

    // Find the article
    const articleDoc = await article
      .findOne({ slug, status: 'published' })
      .lean();

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const mastodonTootUrl = (articleDoc as any).mastodonTootUrl;

    // If no Mastodon toot linked, return empty comments
    if (!mastodonTootUrl) {
      return NextResponse.json({
        success: true,
        data: {
          comments: [],
          tootUrl: null,
          hasComments: false,
        },
      });
    }

    // Fetch comments from Mastodon
    const result = await fetchArticleComments(mastodonTootUrl);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: {
          comments: [],
          tootUrl: mastodonTootUrl,
          hasComments: false,
          error: 'Failed to fetch comments from Mastodon',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        comments: result.comments,
        tootUrl: result.tootUrl,
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
