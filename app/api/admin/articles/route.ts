/**
 * Admin Articles API - List All Articles
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Admin-only endpoint to view all articles regardless of status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import article from '@/lib/model/article';

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

    await dbConnect();

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

    // Build query
    const query: Record<string, unknown> = {};

    if (status && ['draft', 'published', 'removed'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await article.countDocuments(query);

    // Fetch articles
    const articles = await article
      .find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get author info for all articles
    const authorIds = [
      ...new Set(articles.map((a: any) => a.authorId.toString())),
    ];
    const authors = await user.find({ _id: { $in: authorIds } }).lean();
    const authorMap = new Map(
      authors.map((a: any) => [
        a._id.toString(),
        { screenname: a.screenname, name: a.name, email: a.email },
      ])
    );

    // Get admin info for removed articles
    const removedByIds = articles
      .filter((a: any) => a.removedBy)
      .map((a: any) => a.removedBy.toString());
    const admins =
      removedByIds.length > 0
        ? await user.find({ _id: { $in: removedByIds } }).lean()
        : [];
    const adminMap = new Map(
      admins.map((a: any) => [a._id.toString(), a.screenname || a.name])
    );

    const enrichedArticles = articles.map((a: any) => ({
      _id: a._id.toString(),
      slug: a.slug,
      title: a.title,
      status: a.status,
      articleType: a.articleType,
      author: authorMap.get(a.authorId.toString()) || { screenname: null },
      coAuthorsCount:
        a.coAuthors?.filter((ca: any) => ca.status === 'accepted').length || 0,
      publishedAt: a.publishedAt,
      removedAt: a.removedAt,
      removedBy: a.removedBy ? adminMap.get(a.removedBy.toString()) : null,
      removalReason: a.removalReason,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

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
