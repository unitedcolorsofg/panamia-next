/**
 * Co-Author Invitation Page
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Accept or decline a co-author invitation
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, FileText, Loader2, User } from 'lucide-react';

interface ArticleData {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  articleType: 'business_update' | 'community_commentary';
  authorId: string;
  coAuthors: Array<{
    userId: string;
    invitationMessage?: string;
    status: string;
  }>;
}

interface AuthorInfo {
  screenname?: string;
  name?: string;
}

export default function InvitePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [invitation, setInvitation] = useState<{
    message?: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/signin?callbackUrl=/articles/${slug}/invite`);
    }
  }, [sessionStatus, router, slug]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch article
        const articleRes = await fetch(`/api/articles/${slug}`);
        const articleData = await articleRes.json();

        if (!articleData.success) {
          setError(articleData.error || 'Article not found');
          setLoading(false);
          return;
        }

        setArticle(articleData.data);

        // Find current user's invitation
        const userRes = await fetch('/api/user/me');
        const userData = await userRes.json();

        if (userData.success) {
          const invite = articleData.data.coAuthors?.find(
            (ca: any) => ca.userId === userData.data._id
          );
          if (invite) {
            setInvitation({
              message: invite.invitationMessage,
              status: invite.status,
            });
          } else {
            setError('No invitation found for you');
          }
        }

        // Fetch author info
        const authorRes = await fetch(
          `/api/user/author/${articleData.data.authorId}`
        );
        const authorData = await authorRes.json();
        if (!authorData.deleted) {
          setAuthor(authorData);
        }
      } catch (err) {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    }

    if (session && slug) {
      fetchData();
    }
  }, [session, slug]);

  const handleRespond = async (action: 'accept' | 'decline') => {
    setResponding(true);
    try {
      const response = await fetch(`/api/articles/${slug}/coauthors/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      if (action === 'accept') {
        router.push(`/articles/${slug}/edit`);
      } else {
        router.push('/account/articles');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to respond to invitation');
      setResponding(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to view this invitation.
            </p>
            <Button asChild>
              <Link href={`/signin?callbackUrl=/articles/${slug}/invite`}>
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
            <Button asChild variant="outline">
              <Link href="/account/notifications">Back to Notifications</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (invitation?.status !== 'pending') {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Invitation Already Responded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You have already {invitation?.status} this invitation.
            </p>
            {invitation?.status === 'accepted' ? (
              <Button asChild>
                <Link href={`/articles/${slug}/edit`}>Go to Article</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/account/articles">My Articles</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Co-Author Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Author info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="font-medium">
                {author?.screenname
                  ? `@${author.screenname}`
                  : author?.name || 'Someone'}
              </p>
              <p className="text-sm text-gray-500">invited you to co-author</p>
            </div>
          </div>

          {/* Article info */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">
                {article?.articleType === 'business_update'
                  ? 'Business Update'
                  : 'Commentary'}
              </Badge>
            </div>
            <h2 className="text-xl font-semibold">
              {article?.title || 'Untitled Article'}
            </h2>
            {article?.excerpt && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {article.excerpt}
              </p>
            )}
          </div>

          {/* Personal message */}
          {invitation?.message && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Personal message:
              </p>
              <p className="mt-1 text-blue-800 dark:text-blue-200">
                &ldquo;{invitation.message}&rdquo;
              </p>
            </div>
          )}

          {/* What co-authoring means */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <h3 className="font-medium">As a co-author, you will:</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Be able to edit the article content</li>
              <li>• Be credited as a co-author when published</li>
              <li>• Share responsibility for the content&apos;s accuracy</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleRespond('accept')}
              disabled={responding}
              className="flex-1"
            >
              {responding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Accept
            </Button>
            <Button
              onClick={() => handleRespond('decline')}
              disabled={responding}
              variant="outline"
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
