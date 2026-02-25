/**
 * Articles API - Create and List
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Article management for community publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
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
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and verify they have a screenname
    const currentUser = await db.query.users.findFirst({
      where: (t, { eq }) => eq(t.id, session.user.id),
    });
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
      const parentArticle = await db.query.articles.findFirst({
        where: (t, { eq }) => eq(t.id, inReplyTo),
      });
      if (!parentArticle || parentArticle.status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid parent article' },
          { status: 400 }
        );
      }
    }

    // Create article
    const [newArticle] = await db
      .insert(articles)
      .values({
        slug,
        title: title.trim(),
        content: content || '',
        excerpt,
        articleType,
        tags: tags || [],
        coverImage,
        authorId: currentUser.id,
        coAuthors: [],
        status: 'draft',
        readingTime,
        inReplyTo: inReplyTo || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: newArticle.id,
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
    const searchParams = request.nextUrl.searchParams;
    const articleType = searchParams.get('type') as
      | 'business_update'
      | 'community_commentary'
      | null;
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conditions: any[] = [eq(articles.status, 'published')];

    if (articleType) {
      conditions.push(eq(articles.articleType, articleType));
    }

    if (tag) {
      conditions.push(sql`${articles.tags} @> ARRAY[${tag}]::text[]`);
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const [articleRows, countResult] = await Promise.all([
      db.query.articles.findMany({
        where: () => whereClause,
        orderBy: (t, { desc }) => [desc(t.publishedAt)],
        offset,
        limit,
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          articleType: true,
          tags: true,
          authorId: true,
          publishedAt: true,
          readingTime: true,
          coverImage: true,
        },
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const total = Number(countResult[0].count);

    return NextResponse.json({
      success: true,
      data: {
        articles: articleRows,
        total,
        hasMore: offset + articleRows.length < total,
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
