/**
 * Co-Author Response API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Accept or decline a co-author invitation
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
 * POST /api/articles/[slug]/coauthors/respond
 * Accept or decline a co-author invitation
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

    const articleDoc = await article.findOne({ slug });
    if (!articleDoc) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "accept" or "decline"',
        },
        { status: 400 }
      );
    }

    // Find the invitation for this user (using PostgreSQL user ID)
    const inviteIndex = articleDoc.coAuthors?.findIndex(
      (ca: any) => ca.userId === session.user.id && ca.status === 'pending'
    );

    if (inviteIndex === undefined || inviteIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'No pending invitation found' },
        { status: 404 }
      );
    }

    // Update invitation status
    if (action === 'accept') {
      articleDoc.coAuthors[inviteIndex].status = 'accepted';
      articleDoc.coAuthors[inviteIndex].acceptedAt = new Date();
    } else {
      articleDoc.coAuthors[inviteIndex].status = 'declined';
    }

    await articleDoc.save();

    // Get author's userId from their profile
    const authorProfile = await Profile.findOne({
      email: articleDoc.authorEmail,
    }).select('userId');

    // Notify the author (if they have a userId)
    if (authorProfile?.userId) {
      await createNotification({
        type: action === 'accept' ? 'Accept' : 'Reject',
        actorId: session.user.id,
        targetId: authorProfile.userId,
        context: 'coauthor',
        objectId: articleDoc._id.toString(),
        objectType: 'article',
        objectTitle: articleDoc.title,
        objectUrl: `/articles/${articleDoc.slug}/edit`,
      });
    }

    return NextResponse.json({
      success: true,
      message:
        action === 'accept' ? 'Invitation accepted' : 'Invitation declined',
    });
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to respond to invitation' },
      { status: 500 }
    );
  }
}
