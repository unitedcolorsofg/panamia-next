/**
 * Admin Article Restore API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to restore a removed article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
}

/**
 * POST /api/admin/articles/[slug]/restore
 * Restore a removed article back to published (admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin status from session (set in auth.ts session callback)
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const prisma = await getPrisma();

    // Get current user's profile for response
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });

    const articleDoc = await prisma.article.findUnique({ where: { slug } });
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
    const updatedArticle = await prisma.article.update({
      where: { id: articleDoc.id },
      data: {
        status: 'published',
        // Keep removedAt, removedBy, removalReason for audit trail
      },
    });

    // Notify the author
    await createNotification({
      actorId: session.user.id,
      targetId: articleDoc.authorId,
      type: 'Undo',
      objectType: 'article',
      objectId: articleDoc.id,
      objectTitle: articleDoc.title,
      objectUrl: `/articles/${articleDoc.slug}`,
      context: 'article',
    });

    // Notify co-authors
    const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
    const acceptedCoAuthors = coAuthors.filter(
      (ca) => ca.status === 'accepted' && ca.userId
    );
    for (const coAuthor of acceptedCoAuthors) {
      await createNotification({
        actorId: session.user.id,
        targetId: coAuthor.userId,
        type: 'Undo',
        objectType: 'article',
        objectId: articleDoc.id,
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}`,
        context: 'article',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: updatedArticle.slug,
        status: updatedArticle.status,
        restoredBy: currentProfile?.name || 'Admin',
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
