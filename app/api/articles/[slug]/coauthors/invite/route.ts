/**
 * Co-Author Invitation API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Invite a user to co-author an article
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
 * POST /api/articles/[slug]/coauthors/invite
 * Invite a user to be a co-author
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

    // Only author can invite co-authors
    if (articleDoc.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'Only the author can invite co-authors' },
        { status: 403 }
      );
    }

    // Can only invite for draft articles
    if (
      articleDoc.status !== 'draft' &&
      articleDoc.status !== 'revision_needed'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only invite co-authors for draft articles',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId, message } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify invitee exists and has a screenname
    const invitee = await user.findById(userId);
    if (!invitee) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!invitee.screenname) {
      return NextResponse.json(
        { success: false, error: 'User must have a screenname to be invited' },
        { status: 400 }
      );
    }

    // Check if already invited or is author
    if (articleDoc.authorId.toString() === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot invite yourself' },
        { status: 400 }
      );
    }

    const existingInvite = articleDoc.coAuthors?.find(
      (ca: any) => ca.userId.toString() === userId
    );
    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'User has already been invited' },
        { status: 400 }
      );
    }

    // Add co-author invitation
    articleDoc.coAuthors = articleDoc.coAuthors || [];
    articleDoc.coAuthors.push({
      userId,
      invitedAt: new Date(),
      invitationMessage: message || undefined,
      status: 'pending',
    });
    await articleDoc.save();

    // Create notification for invitee
    await createNotification({
      type: 'Invite',
      actorId: currentUser._id.toString(),
      targetId: userId,
      context: 'coauthor',
      objectId: articleDoc._id.toString(),
      objectType: 'article',
      objectTitle: articleDoc.title,
      objectUrl: `/articles/${articleDoc.slug}/invite`,
      message: message || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation sent',
    });
  } catch (error) {
    console.error('Error inviting co-author:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
