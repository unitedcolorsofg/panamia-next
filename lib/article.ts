/**
 * Article Helper Functions
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Utilities for article creation, slug generation, and validation
 */

import { getPrisma } from '@/lib/prisma';
import type { ArticleStatus } from './interfaces';

/**
 * Generate a URL-safe slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Trim hyphens from start/end
    .substring(0, 100); // Limit length
}

/**
 * Generate a unique slug for an article
 * Appends a number if the slug already exists
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const prisma = await getPrisma();

  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    // Fallback for titles with no alphanumeric characters
    return `article-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Calculate estimated reading time in minutes
 * Based on average reading speed of 200 words per minute
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;

  // Strip markdown syntax for more accurate word count
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~>`-]/g, '') // Remove markdown characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const wordCount = plainText
    .split(' ')
    .filter((word) => word.length > 0).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);

  return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Generate an excerpt from content
 * Takes first paragraph or first N characters
 */
export function generateExcerpt(
  content: string,
  maxLength: number = 300
): string {
  // Strip markdown for clean excerpt
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~>`]/g, '') // Remove markdown characters
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find last complete word within limit
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Check if an article is publishable
 * Requires: title, content, and at least one co-author OR approved reviewer
 */
export function isPublishable(articleDoc: {
  title?: string;
  content?: string;
  coAuthors?: Array<{ status: string }>;
  reviewedBy?: { status: string };
  status?: ArticleStatus;
}): { publishable: boolean; reason?: string } {
  if (!articleDoc.title?.trim()) {
    return { publishable: false, reason: 'Article must have a title' };
  }

  if (!articleDoc.content?.trim()) {
    return { publishable: false, reason: 'Article must have content' };
  }

  if (articleDoc.status === 'published') {
    return { publishable: false, reason: 'Article is already published' };
  }

  if (articleDoc.status === 'removed') {
    return { publishable: false, reason: 'Article has been removed' };
  }

  const hasAcceptedCoAuthor = articleDoc.coAuthors?.some(
    (ca) => ca.status === 'accepted'
  );
  const hasApprovedReview = articleDoc.reviewedBy?.status === 'approved';

  if (!hasAcceptedCoAuthor && !hasApprovedReview) {
    return {
      publishable: false,
      reason:
        'Article must have at least one accepted co-author or approved reviewer',
    };
  }

  return { publishable: true };
}

/**
 * Get article by slug
 */
export async function getArticleBySlug(slug: string) {
  const prisma = await getPrisma();

  return await prisma.article.findUnique({ where: { slug } });
}

/**
 * Get articles by author (includes co-authored articles)
 */
export async function getArticlesByAuthor(
  authorId: string,
  options: {
    status?: ArticleStatus | ArticleStatus[];
    limit?: number;
    offset?: number;
  } = {}
) {
  const prisma = await getPrisma();
  const { status, limit = 20, offset = 0 } = options;

  // Build status filter
  const statusFilter = status
    ? Array.isArray(status)
      ? { in: status as any[] }
      : status
    : undefined;

  // Query articles where user is author
  const authorArticles = await prisma.article.findMany({
    where: {
      authorId,
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Query all articles to check coAuthors (JSONB filtering)
  // Note: For large datasets, consider using raw SQL with JSONB operators
  const allArticles = await prisma.article.findMany({
    where: statusFilter ? { status: statusFilter as any } : undefined,
    orderBy: { updatedAt: 'desc' },
  });

  // Filter for co-authored articles
  const coAuthoredArticles = allArticles.filter((a) => {
    if (a.authorId === authorId) return false; // Already in authorArticles
    const coAuthors = a.coAuthors as Array<{ userId: string }> | null;
    return coAuthors?.some((ca) => ca.userId === authorId);
  });

  // Merge and sort by updatedAt
  const combined = [...authorArticles, ...coAuthoredArticles].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  // Apply pagination
  const total = combined.length;
  const articles = combined.slice(offset, offset + limit);

  return {
    articles,
    total,
    hasMore: offset + articles.length < total,
  };
}

/**
 * Get published articles (for public listing)
 */
export async function getPublishedArticles(
  options: {
    articleType?: 'business_update' | 'community_commentary';
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const prisma = await getPrisma();
  const { articleType, tag, limit = 20, offset = 0 } = options;

  const where: any = { status: 'published' };

  if (articleType) {
    where.articleType = articleType;
  }

  if (tag) {
    where.tags = { has: tag };
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return {
    articles,
    total,
    hasMore: offset + articles.length < total,
  };
}

/**
 * Get articles that are replies to a specific article
 */
export async function getArticleReplies(articleId: string) {
  const prisma = await getPrisma();

  return await prisma.article.findMany({
    where: { inReplyTo: articleId, status: 'published' },
    orderBy: { publishedAt: 'asc' },
  });
}
