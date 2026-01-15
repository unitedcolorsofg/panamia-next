/**
 * Admin Articles API - List All Articles
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to view all articles regardless of status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

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

    const prisma = await getPrisma();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const search = searchParams.get('search')?.trim();

    // Build query
    const where: any = {};

    if (status && ['draft', 'published', 'removed'].includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count and articles
    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Get author info for all articles
    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, screenname: true, email: true },
    });
    const authorMap = new Map(
      authors.map((a) => [a.id, { screenname: a.screenname, email: a.email }])
    );

    // Get admin info for removed articles
    const removedByIds = articles
      .filter((a) => a.removedBy)
      .map((a) => a.removedBy as string);
    const admins =
      removedByIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: removedByIds } },
            select: { id: true, screenname: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.screenname]));

    const enrichedArticles = articles.map((a) => {
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
