/**
 * Single Article API - Read, Update, Delete
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Individual article management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import type { Article } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { calculateReadingTime, generateExcerpt } from '@/lib/article';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
  invitationMessage?: string;
  invitedAt?: string;
  acceptedAt?: string;
}

interface ReviewedBy {
  userId: string;
  status: string;
  checklist?: any;
  comments?: any[];
  requestedAt?: string;
  approvedAt?: string;
}

/**
 * Check if user has edit access to an article
 */
function hasEditAccess(articleDoc: Article, userId: string): boolean {
  // Author always has access
  if (articleDoc.authorId === userId) {
    return true;
  }

  // Accepted co-authors have access
  const coAuthors = articleDoc.coAuthors as unknown as CoAuthor[] | null;
  const coAuthor = coAuthors?.find(
    (ca) => ca.userId === userId && ca.status === 'accepted'
  );

  return !!coAuthor;
}

/**
 * GET /api/articles/[slug] - Get article by slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const articleDoc = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const session = await auth();
    const currentUserId = session?.user?.id;

    const coAuthors = articleDoc.coAuthors as unknown as CoAuthor[] | null;
    const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;

    const isPublished = articleDoc.status === 'published';
    const isAuthor = currentUserId && articleDoc.authorId === currentUserId;
    const isCoAuthor =
      currentUserId &&
      coAuthors?.some(
        (ca) => ca.userId === currentUserId && ca.status === 'accepted'
      );
    const isReviewer = currentUserId && reviewedBy?.userId === currentUserId;

    // Only published articles are publicly accessible
    if (!isPublished && !isAuthor && !isCoAuthor && !isReviewer) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Prepare response
    const responseData: any = {
      ...articleDoc,
      id: articleDoc.id,
    };

    // Enrich co-authors with screennames (only for users with edit access)
    if ((isAuthor || isCoAuthor) && coAuthors?.length) {
      const coAuthorIds = coAuthors.map((ca) => ca.userId);
      const coAuthorUsers =
        coAuthorIds.length > 0
          ? await db
              .select({ id: users.id, screenname: users.screenname })
              .from(users)
              .where(inArray(users.id, coAuthorIds))
          : [];
      const userMap = new Map(coAuthorUsers.map((u) => [u.id, u.screenname]));

      responseData.coAuthors = coAuthors.map((ca) => ({
        userId: ca.userId,
        screenname: userMap.get(ca.userId),
        status: ca.status,
        invitationMessage: ca.invitationMessage,
        invitedAt: ca.invitedAt,
        acceptedAt: ca.acceptedAt,
      }));
    }

    // Enrich reviewer with screenname (only for users with edit access)
    if ((isAuthor || isCoAuthor) && reviewedBy?.userId) {
      const reviewerUser = await db.query.users.findFirst({
        where: eq(users.id, reviewedBy.userId),
        columns: { screenname: true },
      });
      responseData.reviewedBy = {
        userId: reviewedBy.userId,
        screenname: reviewerUser?.screenname,
        status: reviewedBy.status,
        checklist: reviewedBy.checklist,
        comments: reviewedBy.comments,
        requestedAt: reviewedBy.requestedAt,
        approvedAt: reviewedBy.approvedAt,
      };
    }

    // Enrich inReplyTo with parent article info (for editors)
    if ((isAuthor || isCoAuthor) && articleDoc.inReplyTo) {
      const parentArticle = await db.query.articles.findFirst({
        where: eq(articles.id, articleDoc.inReplyTo),
        columns: { id: true, slug: true, title: true },
      });
      if (parentArticle) {
        responseData.inReplyTo = {
          id: parentArticle.id,
          slug: parentArticle.slug,
          title: parentArticle.title,
        };
      }
    }

    // Include user's relationship to article if authenticated
    if (currentUserId) {
      responseData.userAccess = {
        isAuthor,
        isCoAuthor,
        isReviewer,
        canEdit: isAuthor || isCoAuthor,
      };
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[slug] - Update article
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

    const articleDoc = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check edit access
    if (!hasEditAccess(articleDoc, session.user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to edit this article',
        },
        { status: 403 }
      );
    }

    // Cannot edit published or removed articles (must unpublish first)
    if (articleDoc.status === 'published' || articleDoc.status === 'removed') {
      return NextResponse.json(
        { success: false, error: 'Cannot edit a published or removed article' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'title',
      'content',
      'articleType',
      'tags',
      'coverImage',
      'inReplyTo',
    ];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Recalculate derived fields if content changed
    if (updates.content) {
      updates.readingTime = calculateReadingTime(updates.content as string);
      updates.excerpt =
        body.excerpt || generateExcerpt(updates.content as string);
    } else if (body.excerpt) {
      updates.excerpt = body.excerpt;
    }

    // Validate article type
    if (
      updates.articleType &&
      !['business_update', 'community_commentary'].includes(
        updates.articleType as string
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid article type' },
        { status: 400 }
      );
    }

    // Validate inReplyTo if provided
    if (updates.inReplyTo) {
      const parentArticle = await db.query.articles.findFirst({
        where: eq(articles.id, updates.inReplyTo as string),
      });
      if (!parentArticle || parentArticle.status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid parent article' },
          { status: 400 }
        );
      }
    }

    // Apply updates
    const [updatedArticle] = await db
      .update(articles)
      .set(updates as any)
      .where(eq(articles.id, articleDoc.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: updatedArticle.id,
        slug: updatedArticle.slug,
        title: updatedArticle.title,
        status: updatedArticle.status,
        updatedAt: updatedArticle.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[slug] - Delete draft article
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const articleDoc = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only author can delete
    if (articleDoc.authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the author can delete this article' },
        { status: 403 }
      );
    }

    // Can only delete drafts
    if (articleDoc.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Can only delete draft articles' },
        { status: 400 }
      );
    }

    await db.delete(articles).where(eq(articles.id, articleDoc.id));

    return NextResponse.json({
      success: true,
      message: 'Article deleted',
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
