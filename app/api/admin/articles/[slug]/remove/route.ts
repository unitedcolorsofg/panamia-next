/**
 * Admin Article Remove API
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Admin-only endpoint to remove (soft delete) a published article
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
 * POST /api/admin/articles/[slug]/remove
 * Remove a published article with reason (admin only)
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
    const updatedArticle = await prisma.article.update({
      where: { id: articleDoc.id },
      data: {
        status: 'removed',
        removedAt: new Date(),
        removedBy: session.user.id,
        removalReason: reason.trim(),
      },
    });

    // Notify the author
    await createNotification({
      actorId: session.user.id,
      targetId: articleDoc.authorId,
      type: 'Delete',
      objectType: 'article',
      objectId: articleDoc.id,
      objectTitle: articleDoc.title,
      objectUrl: `/a/${articleDoc.slug}`,
      context: 'article',
      message: reason.trim(),
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
        type: 'Delete',
        objectType: 'article',
        objectId: articleDoc.id,
        objectTitle: articleDoc.title,
        objectUrl: `/a/${articleDoc.slug}`,
        context: 'article',
        message: reason.trim(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        slug: updatedArticle.slug,
        status: updatedArticle.status,
        removedAt: updatedArticle.removedAt,
        removedBy: currentProfile?.name || 'Admin',
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
