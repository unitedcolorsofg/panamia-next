/**
 * Co-Author Invitation API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Invite a user to co-author an article
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
 * POST /api/articles/[slug]/coauthors/invite
 * Invite a user to be a co-author
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

    // Get current user's profile
    const currentProfile = await Profile.findOne({
      userId: session.user.id,
    });
    if (!currentProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
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

    // Only author can invite co-authors (check by email or userId)
    if (
      articleDoc.authorEmail !== session.user.email &&
      articleDoc.authorUserId !== session.user.id
    ) {
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

    // Verify invitee has a profile with screenname
    const inviteeProfile = await Profile.findOne({ userId });
    if (!inviteeProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!inviteeProfile.slug) {
      return NextResponse.json(
        { success: false, error: 'User must have a screenname to be invited' },
        { status: 400 }
      );
    }

    // Check if already invited or is author
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot invite yourself' },
        { status: 400 }
      );
    }

    const existingInvite = articleDoc.coAuthors?.find(
      (ca: any) => ca.userId === userId
    );
    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'User has already been invited' },
        { status: 400 }
      );
    }

    // Add co-author invitation (store PostgreSQL user ID)
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
      actorId: session.user.id,
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
