/**
 * My Articles API - List user's articles
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Author dashboard article listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';

/**
 * GET /api/articles/my - List current user's articles (author or co-author)
 */
export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Find articles where user is author or co-author
    const query: Record<string, unknown> = {
      $or: [
        { authorId: currentUser._id },
        { 'coAuthors.userId': currentUser._id },
      ],
    };

    // Filter by status if provided
    if (status) {
      const statuses = status.split(',');
      query.status = { $in: statuses };
    }

    const articles = await article
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .select(
        'slug title excerpt articleType status authorId coAuthors publishedAt updatedAt readingTime'
      )
      .lean();

    const total = await article.countDocuments(query);

    // Determine user's role in each article
    const articlesWithRole = articles.map((a: any) => {
      const isAuthor = a.authorId.toString() === currentUser._id.toString();
      const coAuthorEntry = a.coAuthors?.find(
        (ca: any) => ca.userId.toString() === currentUser._id.toString()
      );

      return {
        ...a,
        _id: a._id.toString(),
        authorId: a.authorId.toString(),
        userRole: isAuthor ? 'author' : 'coauthor',
        coAuthorStatus: coAuthorEntry?.status,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: articlesWithRole,
        total,
        hasMore: offset + articles.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing user articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list articles' },
      { status: 500 }
    );
  }
}
