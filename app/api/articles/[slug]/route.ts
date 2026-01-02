/**
 * Single Article API - Read, Update, Delete
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Individual article management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';
import { calculateReadingTime, generateExcerpt } from '@/lib/article';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Check if user has edit access to an article
 */
async function hasEditAccess(
  articleDoc: any,
  userId: string
): Promise<boolean> {
  // Author always has access
  if (articleDoc.authorId.toString() === userId) {
    return true;
  }

  // Accepted co-authors have access
  const coAuthor = articleDoc.coAuthors?.find(
    (ca: any) => ca.userId.toString() === userId && ca.status === 'accepted'
  );

  return !!coAuthor;
}

/**
 * GET /api/articles/[slug] - Get article by slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    await dbConnect();

    const articleDoc = await article.findOne({ slug }).lean();

    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const session = await auth();
    const currentUser = session?.user?.email
      ? await user.findOne({ email: session.user.email })
      : null;

    const isPublished = articleDoc.status === 'published';
    const isAuthor =
      currentUser &&
      articleDoc.authorId.toString() === currentUser._id.toString();
    const isCoAuthor =
      currentUser &&
      articleDoc.coAuthors?.some(
        (ca: any) =>
          ca.userId.toString() === currentUser._id.toString() &&
          ca.status === 'accepted'
      );
    const isReviewer =
      currentUser &&
      articleDoc.reviewedBy?.userId?.toString() === currentUser._id.toString();

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
      _id: (articleDoc as any)._id.toString(),
      authorId: articleDoc.authorId.toString(),
    };

    // Enrich co-authors with screennames (only for users with edit access)
    if ((isAuthor || isCoAuthor) && articleDoc.coAuthors?.length) {
      const coAuthorIds = articleDoc.coAuthors.map((ca: any) => ca.userId);
      const coAuthorUsers = await user
        .find({ _id: { $in: coAuthorIds } })
        .lean();
      const userMap = new Map(
        coAuthorUsers.map((u: any) => [u._id.toString(), u.screenname])
      );

      responseData.coAuthors = articleDoc.coAuthors.map((ca: any) => ({
        userId: ca.userId.toString(),
        screenname: userMap.get(ca.userId.toString()),
        status: ca.status,
        invitationMessage: ca.invitationMessage,
        invitedAt: ca.invitedAt,
        respondedAt: ca.respondedAt,
      }));
    }

    // Enrich reviewer with screenname (only for users with edit access)
    if ((isAuthor || isCoAuthor) && articleDoc.reviewedBy?.userId) {
      const reviewerUser = await user
        .findById(articleDoc.reviewedBy.userId)
        .lean();
      responseData.reviewedBy = {
        userId: articleDoc.reviewedBy.userId.toString(),
        screenname: (reviewerUser as any)?.screenname,
        status: articleDoc.reviewedBy.status,
        checklist: articleDoc.reviewedBy.checklist,
        comments: articleDoc.reviewedBy.comments,
        requestedAt: articleDoc.reviewedBy.requestedAt,
        respondedAt: articleDoc.reviewedBy.respondedAt,
      };
    }

    // Enrich inReplyTo with parent article info (for editors)
    if ((isAuthor || isCoAuthor) && articleDoc.inReplyTo) {
      const parentArticle = await article
        .findById(articleDoc.inReplyTo)
        .select('_id slug title')
        .lean();
      if (parentArticle) {
        responseData.inReplyTo = {
          _id: (parentArticle as any)._id.toString(),
          slug: (parentArticle as any).slug,
          title: (parentArticle as any).title,
        };
      }
    }

    // Include user's relationship to article if authenticated
    if (currentUser) {
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

    // Check edit access
    if (!(await hasEditAccess(articleDoc, currentUser._id.toString()))) {
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
      const parentArticle = await article.findById(updates.inReplyTo);
      if (!parentArticle || parentArticle.status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid parent article' },
          { status: 400 }
        );
      }
    }

    // Apply updates
    Object.assign(articleDoc, updates);
    await articleDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: articleDoc._id.toString(),
        slug: articleDoc.slug,
        title: articleDoc.title,
        status: articleDoc.status,
        updatedAt: articleDoc.updatedAt,
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

    // Only author can delete
    if (articleDoc.authorId.toString() !== currentUser._id.toString()) {
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

    await article.deleteOne({ _id: articleDoc._id });

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
