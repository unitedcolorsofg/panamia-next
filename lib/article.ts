/**
 * Article Helper Functions
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Utilities for article creation, slug generation, and validation
 */

import dbConnect from './connectdb';
import article from './model/article';
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
  await dbConnect();

  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    // Fallback for titles with no alphanumeric characters
    return `article-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (await article.exists({ slug })) {
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
  await dbConnect();

  return await article.findOne({ slug }).lean();
}

/**
 * Get articles by author
 */
export async function getArticlesByAuthor(
  authorId: string,
  options: {
    status?: ArticleStatus | ArticleStatus[];
    limit?: number;
    offset?: number;
  } = {}
) {
  await dbConnect();

  const { status, limit = 20, offset = 0 } = options;

  const query: Record<string, unknown> = {
    $or: [{ authorId }, { 'coAuthors.userId': authorId }],
  };

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  const articles = await article
    .find(query)
    .sort({ updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await article.countDocuments(query);

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
  await dbConnect();

  const { articleType, tag, limit = 20, offset = 0 } = options;

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
    .lean();

  const total = await article.countDocuments(query);

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
  await dbConnect();

  return await article
    .find({ inReplyTo: articleId, status: 'published' })
    .sort({ publishedAt: 1 })
    .lean();
}
