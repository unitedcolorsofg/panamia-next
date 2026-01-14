/**
 * Admin Article Remove API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to remove (soft delete) a published article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import Profile from '@/lib/model/profile';
import article from '@/lib/model/article';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/admin/articles/[slug]/remove
 * Remove a published article with reason (admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Check admin status from session (set in auth.ts session callback)
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get current user's profile for response
    const currentProfile = await Profile.findOne({ userId: session.user.id });

    const articleDoc = await article.findOne({ slug });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Can only remove published articles
    if (articleDoc.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Can only remove published articles' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'A removal reason of at least 10 characters is required',
        },
        { status: 400 }
      );
    }

    // Update article status
    articleDoc.status = 'removed';
    articleDoc.removedAt = new Date();
    articleDoc.removedBy = session.user.id;
    articleDoc.removalReason = reason.trim();
    await articleDoc.save();

    // Get author's userId from their profile
    const authorProfile = await Profile.findOne({
      email: articleDoc.authorEmail,
    }).select('userId');

    // Notify the author (if they have a userId)
    if (authorProfile?.userId) {
      await createNotification({
        actorId: session.user.id,
        targetId: authorProfile.userId,
        type: 'Delete',
        objectType: 'article',
        objectId: articleDoc._id.toString(),
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
        message: reason.trim(),
      });
    }

    // Notify co-authors (they now have PostgreSQL user IDs)
    const acceptedCoAuthors =
      articleDoc.coAuthors?.filter(
        (ca: any) => ca.status === 'accepted' && ca.userId
      ) || [];
    for (const coAuthor of acceptedCoAuthors) {
      await createNotification({
        actorId: session.user.id,
        targetId: coAuthor.userId,
        type: 'Delete',
        objectType: 'article',
        objectId: articleDoc._id.toString(),
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
        message: reason.trim(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: articleDoc.slug,
        status: articleDoc.status,
        removedAt: articleDoc.removedAt,
        removedBy: currentProfile?.slug || currentProfile?.name || 'Admin',
      },
    });
  } catch (error) {
    console.error('Error removing article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove article' },
      { status: 500 }
    );
  }
}
