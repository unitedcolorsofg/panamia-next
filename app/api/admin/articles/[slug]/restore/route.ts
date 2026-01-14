/**
 * Admin Article Restore API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to restore a removed article
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
 * POST /api/admin/articles/[slug]/restore
 * Restore a removed article back to published (admin only)
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

    // Can only restore removed articles
    if (articleDoc.status !== 'removed') {
      return NextResponse.json(
        { success: false, error: 'Can only restore removed articles' },
        { status: 400 }
      );
    }

    // Store previous removal info for audit trail
    const previousRemovalReason = articleDoc.removalReason;

    // Restore article to published
    articleDoc.status = 'published';
    // Keep removedAt, removedBy, removalReason for audit trail
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
        type: 'Undo',
        objectType: 'article',
        objectId: articleDoc._id.toString(),
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
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
        type: 'Undo',
        objectType: 'article',
        objectId: articleDoc._id.toString(),
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: articleDoc.slug,
        status: articleDoc.status,
        restoredBy: currentProfile?.slug || currentProfile?.name || 'Admin',
        previousRemovalReason,
      },
    });
  } catch (error) {
    console.error('Error restoring article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to restore article' },
      { status: 500 }
    );
  }
}
