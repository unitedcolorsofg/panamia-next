/**
 * Public Article View Page
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Display a published article
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { db } from '@/lib/db';
import { articles, users } from '@/lib/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ArticleTypeBadge from '@/components/ArticleTypeBadge';
import MastodonComments from '@/components/MastodonComments';
import ArticleMastodonSettings from '@/components/ArticleMastodonSettings';
import { ArrowLeft, Clock, Reply } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
}

interface ReviewedBy {
  userId: string;
  status: string;
}

async function getArticle(slug: string) {
  const articleDoc = await db.query.articles.findFirst({
    where: and(eq(articles.slug, slug), eq(articles.status, 'published')),
  });
  if (!articleDoc) {
    return null;
  }

  // Get author info
  const authorDoc = await db.query.users.findFirst({
    where: eq(users.id, articleDoc.authorId),
    columns: { id: true, screenname: true },
  });
  const authorInfo = authorDoc
    ? {
        screenname: authorDoc.screenname,
      }
    : null;

  // Get accepted co-authors
  const coAuthors = (articleDoc.coAuthors as unknown as CoAuthor[]) || [];
  const acceptedCoAuthors = coAuthors.filter((ca) => ca.status === 'accepted');

  const coAuthorIds = acceptedCoAuthors.map((ca) => ca.userId);
  const coAuthorDocs =
    coAuthorIds.length > 0
      ? await db
          .select({ id: users.id, screenname: users.screenname })
          .from(users)
          .where(inArray(users.id, coAuthorIds))
      : [];
  const coAuthorsInfo = coAuthorDocs.map((u) => ({
    screenname: u.screenname,
  }));

  // Get reviewer if approved
  let reviewerInfo = null;
  const reviewedBy = articleDoc.reviewedBy as unknown as ReviewedBy | null;
  if (reviewedBy?.userId && reviewedBy.status === 'approved') {
    const reviewerDoc = await db.query.users.findFirst({
      where: eq(users.id, reviewedBy.userId),
      columns: { screenname: true },
    });
    if (reviewerDoc) {
      reviewerInfo = {
        screenname: reviewerDoc.screenname,
      };
    }
  }

  // Get parent article if this is a reply
  let parentArticle = null;
  if (articleDoc.inReplyTo) {
    const parentDoc = await db.query.articles.findFirst({
      where: eq(articles.id, articleDoc.inReplyTo),
      columns: { slug: true, title: true, status: true },
    });
    if (parentDoc && parentDoc.status === 'published') {
      parentArticle = {
        slug: parentDoc.slug,
        title: parentDoc.title,
      };
    }
  }

  // Get reply articles
  const replies = await db.query.articles.findMany({
    where: and(
      eq(articles.inReplyTo, articleDoc.id),
      eq(articles.status, 'published')
    ),
    orderBy: (t, { desc }) => [desc(t.publishedAt)],
    limit: 10,
  });

  const replyAuthorIds = replies.map((r) => r.authorId);
  const replyAuthors =
    replyAuthorIds.length > 0
      ? await db
          .select({ id: users.id, screenname: users.screenname })
          .from(users)
          .where(inArray(users.id, replyAuthorIds))
      : [];
  const replyAuthorMap = new Map(
    replyAuthors.map((a) => [a.id, { screenname: a.screenname }])
  );

  const repliesInfo = replies.map((r) => ({
    slug: r.slug,
    title: r.title,
    publishedAt: r.publishedAt,
    author: replyAuthorMap.get(r.authorId) || null,
  }));

  return {
    slug: articleDoc.slug,
    title: articleDoc.title,
    content: articleDoc.content,
    excerpt: articleDoc.excerpt,
    articleType: articleDoc.articleType,
    tags: articleDoc.tags || [],
    coverImage: articleDoc.coverImage,
    readingTime: articleDoc.readingTime,
    publishedAt: articleDoc.publishedAt?.toISOString(),
    authorId: articleDoc.authorId,
    author: authorInfo,
    coAuthors: coAuthorsInfo,
    reviewer: reviewerInfo,
    parentArticle,
    replies: repliesInfo,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const articleData = await getArticle(slug);

  if (!articleData) {
    notFound();
  }

  const formattedDate = articleData.publishedAt
    ? new Date(articleData.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/a"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Articles
      </Link>

      <article>
        {/* Cover Image */}
        {articleData.coverImage && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-lg">
            <Image
              src={articleData.coverImage}
              alt={articleData.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ArticleTypeBadge type={articleData.articleType} />
            {articleData.tags.map((tag: string) => (
              <Link key={tag} href={`/a?tag=${tag}`}>
                <Badge variant="outline" className="hover:bg-gray-100">
                  #{tag}
                </Badge>
              </Link>
            ))}
          </div>

          <h1 className="mb-4 text-3xl font-bold md:text-4xl">
            {articleData.title}
          </h1>

          {/* Byline */}
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-1">
              <span>By</span>
              {articleData.author ? (
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {articleData.author.screenname
                    ? `@${articleData.author.screenname}`
                    : 'Anonymous'}
                </span>
              ) : (
                <span>Former Member</span>
              )}
              {articleData.coAuthors.map((coAuthor: any, index: number) => (
                <span key={index}>
                  <span>&amp;</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {coAuthor.screenname
                      ? ` @${coAuthor.screenname}`
                      : ' Anonymous'}
                  </span>
                </span>
              ))}
            </div>

            {articleData.reviewer && (
              <div>
                Reviewed by{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {articleData.reviewer.screenname
                    ? `@${articleData.reviewer.screenname}`
                    : 'Anonymous'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              {formattedDate && <span>{formattedDate}</span>}
              {articleData.readingTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {articleData.readingTime} min read
                </span>
              )}
            </div>
          </div>
        </header>

        {/* In Reply To */}
        {articleData.parentArticle && (
          <Link href={`/a/${articleData.parentArticle.slug}`}>
            <Card className="mb-8 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
              <CardContent className="flex items-center gap-3 py-4">
                <Reply className="h-5 w-5 text-gray-400" />
                <div>
                  <span className="text-sm text-gray-500">In reply to:</span>
                  <span className="ml-2 font-medium">
                    {articleData.parentArticle.title}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown>{articleData.content}</ReactMarkdown>
        </div>

        {/* Follow-up Articles */}
        {articleData.replies.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="mb-4 text-xl font-semibold">Follow-up Articles</h2>
            <div className="space-y-3">
              {articleData.replies.map((reply: any) => (
                <Link
                  key={reply.slug}
                  href={`/a/${reply.slug}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="font-medium">{reply.title}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    by{' '}
                    {reply.author?.screenname
                      ? `@${reply.author.screenname}`
                      : 'Anonymous'}
                    {' · '}
                    {new Date(reply.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Mastodon Comments */}
        <MastodonComments slug={articleData.slug} />

        {/* Author Settings (only visible to author) */}
        <ArticleMastodonSettings
          slug={articleData.slug}
          authorId={articleData.authorId}
        />
      </article>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const articleData = await getArticle(slug);

  if (!articleData) {
    return {
      title: 'Article Not Found',
    };
  }

  return {
    title: articleData.title,
    description: articleData.excerpt,
    openGraph: {
      title: articleData.title,
      description: articleData.excerpt,
      type: 'article',
      publishedTime: articleData.publishedAt,
      images: articleData.coverImage ? [articleData.coverImage] : [],
    },
  };
}
