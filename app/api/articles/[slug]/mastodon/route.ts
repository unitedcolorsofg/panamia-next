/**
 * Article Mastodon Settings API
 *
 * Allows authors to link a Mastodon post to a published article
 * for comments integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { isValidMastodonUrl } from '@/lib/mastodon';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/articles/[slug]/mastodon
 * Get the linked Mastodon post URL
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const prisma = await getPrisma();

    const articleDoc = await prisma.article.findFirst({
      where: { slug, status: 'published' },
      select: { mastodonPostUrl: true },
    });

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        mastodonPostUrl: articleDoc.mastodonPostUrl || null,
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
 * Update the Mastodon post URL for a published article
 * Only the author can update this setting
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const prisma = await getPrisma();

    const articleDoc = await prisma.article.findUnique({ where: { slug } });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only the primary author can set the Mastodon post URL
    if (articleDoc.authorId !== session.user.id) {
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
    const { mastodonPostUrl } = body;

    // Allow clearing the URL
    if (mastodonPostUrl === null || mastodonPostUrl === '') {
      const updated = await prisma.article.update({
        where: { id: articleDoc.id },
        data: { mastodonPostUrl: null },
      });

      return NextResponse.json({
        success: true,
        data: { mastodonPostUrl: null },
      });
    }

    // Validate URL format
    if (!isValidMastodonUrl(mastodonPostUrl)) {
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
    const updated = await prisma.article.update({
      where: { id: articleDoc.id },
      data: { mastodonPostUrl },
    });

    return NextResponse.json({
      success: true,
      data: {
        mastodonPostUrl: updated.mastodonPostUrl,
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
