/**
 * Article Replies API
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Get articles that are replies to this article
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/articles/[slug]/replies
 * Get articles replying to this one
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    await dbConnect();

    // Find the parent article
    const parentArticle = await article.findOne({ slug }).lean();
    if (!parentArticle) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only show replies to published articles
    if ((parentArticle as any).status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Find reply articles
    const replies = await article
      .find({
        inReplyTo: (parentArticle as any)._id,
        status: 'published',
      })
      .sort({ publishedAt: -1 })
      .lean();

    // Enrich with author info
    const authorIds = [
      ...new Set(replies.map((a: any) => a.authorId.toString())),
    ];
    const authors = await user.find({ _id: { $in: authorIds } }).lean();
    const authorMap = new Map(
      authors.map((a: any) => [
        a._id.toString(),
        { screenname: a.screenname, name: a.name },
      ])
    );

    const enrichedReplies = replies.map((a: any) => ({
      _id: a._id.toString(),
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      publishedAt: a.publishedAt,
      author: authorMap.get(a.authorId.toString()) || { screenname: null },
    }));

    return NextResponse.json({
      success: true,
      data: {
        replies: enrichedReplies,
      },
    });
  } catch (error) {
    console.error('Error fetching article replies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}
