/**
 * Public Article View Page
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Display a published article
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ArticleTypeBadge from '@/components/ArticleTypeBadge';
import MastodonComments from '@/components/MastodonComments';
import ArticleMastodonSettings from '@/components/ArticleMastodonSettings';
import { ArrowLeft, Clock, Reply } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getArticle(slug: string) {
  await dbConnect();

  const articleDoc = await article
    .findOne({ slug, status: 'published' })
    .lean();
  if (!articleDoc) {
    return null;
  }

  // Get author info
  const authorDoc = await user.findById((articleDoc as any).authorId).lean();
  const authorInfo = authorDoc
    ? {
        screenname: (authorDoc as any).screenname,
        name: (authorDoc as any).name,
        profileSlug: (authorDoc as any).profile?.slug,
      }
    : null;

  // Get accepted co-authors
  const acceptedCoAuthors =
    (articleDoc as any).coAuthors?.filter(
      (ca: any) => ca.status === 'accepted'
    ) || [];

  const coAuthorIds = acceptedCoAuthors.map((ca: any) => ca.userId);
  const coAuthorDocs = await user.find({ _id: { $in: coAuthorIds } }).lean();
  const coAuthorsInfo = coAuthorDocs.map((u: any) => ({
    screenname: u.screenname,
    name: u.name,
    profileSlug: u.profile?.slug,
  }));

  // Get reviewer if approved
  let reviewerInfo = null;
  if (
    (articleDoc as any).reviewedBy?.userId &&
    (articleDoc as any).reviewedBy?.status === 'approved'
  ) {
    const reviewerDoc = await user
      .findById((articleDoc as any).reviewedBy.userId)
      .lean();
    if (reviewerDoc) {
      reviewerInfo = {
        screenname: (reviewerDoc as any).screenname,
        name: (reviewerDoc as any).name,
        profileSlug: (reviewerDoc as any).profile?.slug,
      };
    }
  }

  // Get parent article if this is a reply
  let parentArticle = null;
  if ((articleDoc as any).inReplyTo) {
    const parentDoc = await article
      .findById((articleDoc as any).inReplyTo)
      .lean();
    if (parentDoc && (parentDoc as any).status === 'published') {
      parentArticle = {
        slug: (parentDoc as any).slug,
        title: (parentDoc as any).title,
      };
    }
  }

  // Get reply articles
  const replies = await article
    .find({
      inReplyTo: (articleDoc as any)._id,
      status: 'published',
    })
    .sort({ publishedAt: -1 })
    .limit(10)
    .lean();

  const replyAuthorIds = replies.map((r: any) => r.authorId);
  const replyAuthors = await user.find({ _id: { $in: replyAuthorIds } }).lean();
  const replyAuthorMap = new Map(
    replyAuthors.map((a: any) => [
      a._id.toString(),
      { screenname: a.screenname, name: a.name },
    ])
  );

  const repliesInfo = replies.map((r: any) => ({
    slug: r.slug,
    title: r.title,
    publishedAt: r.publishedAt,
    author: replyAuthorMap.get(r.authorId.toString()) || null,
  }));

  return {
    slug: (articleDoc as any).slug,
    title: (articleDoc as any).title,
    content: (articleDoc as any).content,
    excerpt: (articleDoc as any).excerpt,
    articleType: (articleDoc as any).articleType,
    tags: (articleDoc as any).tags || [],
    coverImage: (articleDoc as any).coverImage,
    readingTime: (articleDoc as any).readingTime,
    publishedAt: (articleDoc as any).publishedAt?.toISOString(),
    authorId: (articleDoc as any).authorId.toString(),
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
        href="/articles"
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
              <Link key={tag} href={`/articles?tag=${tag}`}>
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
                    : articleData.author.name || 'Anonymous'}
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
                      : ` ${coAuthor.name}` || ' Anonymous'}
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
                    : articleData.reviewer.name || 'Anonymous'}
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
          <Link href={`/articles/${articleData.parentArticle.slug}`}>
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
                  href={`/articles/${reply.slug}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="font-medium">{reply.title}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    by{' '}
                    {reply.author?.screenname
                      ? `@${reply.author.screenname}`
                      : reply.author?.name || 'Anonymous'}
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
