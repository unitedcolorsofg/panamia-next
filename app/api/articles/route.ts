/**
 * Articles API - Create and List
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Article management for community publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';
import {
  generateUniqueSlug,
  calculateReadingTime,
  generateExcerpt,
} from '@/lib/article';

/**
 * POST /api/articles - Create a new article
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Get user and verify they have a screenname
    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!currentUser.screenname) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must set a screenname before creating articles',
          code: 'SCREENNAME_REQUIRED',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, content, articleType, tags, coverImage, inReplyTo } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    if (
      !articleType ||
      !['business_update', 'community_commentary'].includes(articleType)
    ) {
      return NextResponse.json(
        { success: false, error: 'Valid article type is required' },
        { status: 400 }
      );
    }

    // Generate slug and calculate metadata
    const slug = await generateUniqueSlug(title);
    const readingTime = content ? calculateReadingTime(content) : 1;
    const excerpt = content ? generateExcerpt(content) : '';

    // Validate inReplyTo if provided
    if (inReplyTo) {
      const parentArticle = await article.findById(inReplyTo);
      if (!parentArticle || parentArticle.status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid parent article' },
          { status: 400 }
        );
      }
    }

    // Create article
    const newArticle = await article.create({
      slug,
      title: title.trim(),
      content: content || '',
      excerpt,
      articleType,
      tags: tags || [],
      coverImage,
      authorId: currentUser._id,
      coAuthors: [],
      status: 'draft',
      readingTime,
      inReplyTo: inReplyTo || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: newArticle._id.toString(),
        slug: newArticle.slug,
        title: newArticle.title,
        status: newArticle.status,
      },
    });
  } catch (error) {
    console.error('Error creating article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create article' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/articles - List published articles
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const articleType = searchParams.get('type') as
      | 'business_update'
      | 'community_commentary'
      | null;
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const query: Record<string, unknown> = { status: 'published' };

    if (articleType) {
      query.articleType = articleType;
    }

    if (tag) {
      query.tags = tag;
    }

    const articles = await article
      .find(query)
      .sort({ publishedAt: -1 })
      .skip(offset)
      .limit(limit)
      .select(
        'slug title excerpt articleType tags authorId publishedAt readingTime coverImage'
      )
      .lean();

    const total = await article.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        articles: articles.map((a: any) => ({
          ...a,
          _id: a._id.toString(),
          authorId: a.authorId.toString(),
        })),
        total,
        hasMore: offset + articles.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list articles' },
      { status: 500 }
    );
  }
}
