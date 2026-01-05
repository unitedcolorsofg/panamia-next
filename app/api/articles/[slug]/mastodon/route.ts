/**
 * Article Mastodon Settings API
 *
 * Allows authors to link a Mastodon toot to a published article
 * for comments integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';
import { isValidMastodonUrl, parseMastodonUrl } from '@/lib/mastodon';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/articles/[slug]/mastodon
 * Get the linked Mastodon toot URL
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    await dbConnect();

    const articleDoc = await article
      .findOne({ slug, status: 'published' })
      .select('mastodonTootUrl')
      .lean();

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        mastodonTootUrl: (articleDoc as any).mastodonTootUrl || null,
      },
    });
  } catch (error) {
    console.error('Error fetching Mastodon settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[slug]/mastodon
 * Update the Mastodon toot URL for a published article
 * Only the author can update this setting
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const articleDoc = await article.findOne({ slug });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only the primary author can set the Mastodon toot URL
    if (articleDoc.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the primary author can update this setting',
        },
        { status: 403 }
      );
    }

    // Article must be published
    if (articleDoc.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Article must be published first' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { mastodonTootUrl } = body;

    // Allow clearing the URL
    if (mastodonTootUrl === null || mastodonTootUrl === '') {
      articleDoc.mastodonTootUrl = undefined;
      await articleDoc.save();

      return NextResponse.json({
        success: true,
        data: { mastodonTootUrl: null },
      });
    }

    // Validate URL format
    if (!isValidMastodonUrl(mastodonTootUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid Mastodon URL. Expected format: https://instance.tld/@user/123456789',
        },
        { status: 400 }
      );
    }

    // Save the URL
    articleDoc.mastodonTootUrl = mastodonTootUrl;
    await articleDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        mastodonTootUrl: articleDoc.mastodonTootUrl,
      },
    });
  } catch (error) {
    console.error('Error updating Mastodon settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
