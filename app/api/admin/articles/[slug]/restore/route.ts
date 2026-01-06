/**
 * Admin Article Restore API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to restore a removed article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
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
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Check admin status from ADMIN_EMAILS (consistent with auth.ts session callback)
    const adminEmails =
      process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ||
      [];
    const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const currentUser = await user.findOne({ email: session.user.email });

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

    // Notify the author
    const author = await user.findById(articleDoc.authorId);
    if (author) {
      await createNotification({
        actorId: currentUser._id.toString(),
        targetId: author._id.toString(),
        type: 'Undo',
        objectType: 'article',
        objectId: articleDoc._id.toString(),
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
      });
    }

    // Notify co-authors
    const acceptedCoAuthors =
      articleDoc.coAuthors?.filter((ca: any) => ca.status === 'accepted') || [];
    for (const coAuthor of acceptedCoAuthors) {
      await createNotification({
        actorId: currentUser._id.toString(),
        targetId: coAuthor.userId.toString(),
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
        restoredBy: currentUser.screenname || currentUser.name,
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
