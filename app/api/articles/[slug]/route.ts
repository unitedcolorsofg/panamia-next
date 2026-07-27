/**
 * Single Article API - Read, Update, Delete
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Individual article management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { articlesConsentGate } from '@/lib/article/consent';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { calculateReadingTime, generateExcerpt } from '@/lib/article';
import {
  canView,
  canEdit,
  isAuthor as isArticleAuthor,
  isAcceptedCoAuthor,
  isReviewer as isArticleReviewer,
  type CoAuthorEntry as CoAuthor,
  type ReviewRecord as ReviewedBy,
} from '@/lib/article/permissions';

interface RouteParams {
  params: Promise<{ slug: string }>;
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

    const isAuthor = isArticleAuthor(articleDoc, currentUserId);
    const isCoAuthor = isAcceptedCoAuthor(articleDoc, currentUserId);
    const isReviewer = isArticleReviewer(articleDoc, currentUserId);

    // canView also admits a pending co-author invitee (so the invitation page
    // can load) and the reviewer; published articles are public. Read only —
    // edit stays gated on canEdit (accepted co-author) below.
    if (!canView(articleDoc, currentUserId)) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Prepare response
    const responseData: Record<string, unknown> = {
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
        canEdit: canEdit(articleDoc, currentUserId),
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

    // Require current Articles-terms consent (server parity with the client
    // gate; see lib/article/consent.ts).
    const consentBlock = await articlesConsentGate(session.user.id);
    if (consentBlock) return consentBlock;

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
    if (!canEdit(articleDoc, session.user.id)) {
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
      'coverImageAlt',
      'inReplyTo',
      'ccLicense',
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
      !['business_update', 'community_commentary', 'staff_update'].includes(
        updates.articleType as string
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid article type' },
        { status: 400 }
      );
    }

    // Only admins may set (or keep) the staff_update type.
    if (updates.articleType === 'staff_update' && !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only admins can set the staff update type' },
        { status: 403 }
      );
    }

    // Validate ccLicense
    if (
      updates.ccLicense &&
      !['cc-by-4', 'cc-by-sa-4', 'cc-0'].includes(updates.ccLicense as string)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid CC license' },
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
      .set(updates as Partial<typeof articles.$inferInsert>)
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

    // Require current Articles-terms consent (server parity with the client
    // gate; see lib/article/consent.ts).
    const consentBlock = await articlesConsentGate(session.user.id);
    if (consentBlock) return consentBlock;

    const articleDoc = await db.query.articles.findFirst({
      where: eq(articles.slug, slug),
    });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // The author or any accepted co-author can delete — co-authors share
    // ownership. Pending/declined invitees cannot.
    if (
      !isArticleAuthor(articleDoc, session.user.id) &&
      !isAcceptedCoAuthor(articleDoc, session.user.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the author or an accepted co-author can delete this',
        },
        { status: 403 }
      );
    }

    // A published article must be unpublished first — it's public and may have
    // been cross-posted to the relay. Everything pre-publication
    // (draft / pending_review / revision_needed) can be deleted by its author.
    if (articleDoc.status === 'published') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unpublish the article before deleting it',
        },
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
