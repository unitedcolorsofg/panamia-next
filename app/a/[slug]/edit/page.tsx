/**
 * Edit Article Page
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Edit existing article
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ArticleEditor from '@/components/ArticleEditor';
import Link from 'next/link';

interface CoAuthorInfo {
  userId: string;
  screenname?: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface ReviewerInfo {
  userId: string;
  screenname?: string;
  status: 'pending' | 'approved' | 'revision_needed';
}

interface ReplyToArticle {
  _id: string;
  slug: string;
  title: string;
}

interface ArticleData {
  slug: string;
  title: string;
  content: string;
  articleType: 'business_update' | 'community_commentary';
  tags: string[];
  coverImage?: string;
  status: string;
  coAuthors?: CoAuthorInfo[];
  reviewedBy?: ReviewerInfo;
  inReplyTo?: ReplyToArticle;
  userAccess?: {
    isAuthor: boolean;
    isCoAuthor: boolean;
    canEdit: boolean;
  };
}

export default function EditArticlePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/signin?callbackUrl=/a/${slug}/edit`);
    }
  }, [sessionStatus, router, slug]);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const response = await fetch(`/api/a/${slug}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Article not found');
          return;
        }

        if (!data.data.userAccess?.canEdit) {
          setError('You do not have permission to edit this article');
          return;
        }

        if (
          data.data.status === 'published' ||
          data.data.status === 'removed'
        ) {
          setError('Cannot edit a published or removed article');
          return;
        }

        setArticle(data.data);
      } catch (err) {
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }

    if (session && slug) {
      fetchArticle();
    }
  }, [session, slug]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to edit articles.
            </p>
            <Button asChild>
              <Link href={`/signin?callbackUrl=/a/${slug}/edit`}>Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
            <Button asChild variant="outline">
              <Link href="/account/articles">Back to My Articles</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Article Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              The article you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have access to it.
            </p>
            <Button asChild variant="outline">
              <Link href="/account/articles">Back to My Articles</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <ArticleEditor
        mode="edit"
        initialData={{
          slug: article.slug,
          title: article.title,
          content: article.content,
          articleType: article.articleType,
          tags: article.tags,
          coverImage: article.coverImage,
          coAuthors: article.coAuthors,
          reviewedBy: article.reviewedBy,
          status: article.status,
          inReplyTo: article.inReplyTo,
        }}
      />
    </main>
  );
}
