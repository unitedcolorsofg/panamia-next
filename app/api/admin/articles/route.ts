/**
 * Admin Articles API - List All Articles
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Admin-only endpoint to view all articles regardless of status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { eq, and, or, desc, ilike, inArray, sql } from 'drizzle-orm';
import type { ArticleStatus } from '@/lib/schema';

interface CoAuthor {
  userId: string;
  status: string;
}

/**
 * GET /api/admin/articles
 * List all articles with filtering and pagination (admin only)
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

    // Check admin status from ADMIN_EMAILS (consistent with auth.ts session callback)
    const adminEmails =
      process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ||
      [];
    const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const search = searchParams.get('search')?.trim();

    // Build where conditions
    const statusCondition =
      status && ['draft', 'published', 'removed'].includes(status)
        ? eq(articles.status, status as ArticleStatus)
        : undefined;

    const searchCondition = search
      ? or(
          ilike(articles.title, `%${search}%`),
          ilike(articles.slug, `%${search}%`)
        )
      : undefined;

    const whereClause = and(statusCondition, searchCondition);

    // Get total count and articles
    const [countResult, articleRows] = await Promise.all([
      db
        .select({ count: sql<string>`count(*)` })
        .from(articles)
        .where(whereClause),
      db
        .select()
        .from(articles)
        .where(whereClause)
        .orderBy(desc(articles.updatedAt))
        .offset((page - 1) * limit)
        .limit(limit),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    // Get author info for all articles
    const authorIds = [...new Set(articleRows.map((a) => a.authorId))];
    const authorRows =
      authorIds.length > 0
        ? await db
            .select({
              id: users.id,
              screenname: users.screenname,
              email: users.email,
            })
            .from(users)
            .where(inArray(users.id, authorIds))
        : [];
    const authorMap = new Map(
      authorRows.map((a) => [
        a.id,
        { screenname: a.screenname, email: a.email },
      ])
    );

    // Get admin info for removed articles
    const removedByIds = articleRows
      .filter((a) => a.removedBy)
      .map((a) => a.removedBy as string);
    const adminRows =
      removedByIds.length > 0
        ? await db
            .select({ id: users.id, screenname: users.screenname })
            .from(users)
            .where(inArray(users.id, removedByIds))
        : [];
    const adminMap = new Map(adminRows.map((a) => [a.id, a.screenname]));

    const enrichedArticles = articleRows.map((a) => {
      const coAuthors = (a.coAuthors as unknown as CoAuthor[]) || [];
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        status: a.status,
        articleType: a.articleType,
        author: authorMap.get(a.authorId) || { screenname: null },
        coAuthorsCount: coAuthors.filter((ca) => ca.status === 'accepted')
          .length,
        publishedAt: a.publishedAt,
        removedAt: a.removedAt,
        removedBy: a.removedBy ? adminMap.get(a.removedBy) : null,
        removalReason: a.removalReason,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: enrichedArticles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error listing admin articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list articles' },
      { status: 500 }
    );
  }
}
