/**
 * Article Review Page
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Reviewer interface for article approval
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';

interface ArticleData {
  _id: string;
  slug: string;
  title: string;
  content: string;
  articleType: 'business_update' | 'community_commentary';
  tags: string[];
  authorId: string;
  reviewedBy?: {
    userId: string;
    status: string;
    checklist: {
      factsVerified: boolean;
      sourcesChecked: boolean;
      communityStandards: boolean;
    };
    comments: Array<{
      id: string;
      text: string;
      resolved: boolean;
    }>;
  };
}

export default function ReviewPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState({
    factsVerified: false,
    sourcesChecked: false,
    communityStandards: false,
  });
  const [newComment, setNewComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/signin?callbackUrl=/articles/${slug}/review`);
    }
  }, [sessionStatus, router, slug]);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const response = await fetch(`/api/articles/${slug}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Article not found');
          return;
        }

        // Check if user is the reviewer
        const userRes = await fetch('/api/user/me');
        const userData = await userRes.json();

        if (
          !data.data.reviewedBy ||
          data.data.reviewedBy.userId !== userData.data?._id
        ) {
          setError('You are not assigned as the reviewer for this article');
          return;
        }

        setArticle(data.data);
        if (data.data.reviewedBy?.checklist) {
          setChecklist(data.data.reviewedBy.checklist);
        }
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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/articles/${slug}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment }),
      });

      const data = await response.json();
      if (data.success && article) {
        setArticle({
          ...article,
          reviewedBy: {
            ...article.reviewedBy!,
            comments: [...(article.reviewedBy?.comments || []), data.data],
          },
        });
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleApprove = async () => {
    if (
      !checklist.factsVerified ||
      !checklist.sourcesChecked ||
      !checklist.communityStandards
    ) {
      setError('Please verify all checklist items before approving');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${slug}/review/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', checklist }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      router.push('/updates');
    } catch (err: any) {
      setError(err.message || 'Failed to approve article');
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${slug}/review/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revision_needed',
          checklist,
          comment: revisionComment || undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      router.push('/updates');
    } catch (err: any) {
      setError(err.message || 'Failed to request revision');
      setSubmitting(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
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
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to review articles.
            </p>
            <Button asChild>
              <Link href={`/signin?callbackUrl=/articles/${slug}/review`}>
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error && !article) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
            <Button asChild variant="outline">
              <Link href="/updates">Back to Updates</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (article?.reviewedBy?.status !== 'pending') {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Review Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              This review has been completed with status:{' '}
              <Badge>{article?.reviewedBy?.status}</Badge>
            </p>
            <Button asChild variant="outline">
              <Link href="/updates">Back to Updates</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {article?.articleType === 'business_update'
                    ? 'Business Update'
                    : 'Commentary'}
                </Badge>
                {article?.tags?.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <CardTitle className="text-2xl">{article?.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{article?.content || ''}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        </div>

        {/* Review panel */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="facts"
                  checked={checklist.factsVerified}
                  onCheckedChange={(checked) =>
                    setChecklist({ ...checklist, factsVerified: !!checked })
                  }
                />
                <Label htmlFor="facts" className="text-sm leading-tight">
                  Facts and claims have been verified
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="sources"
                  checked={checklist.sourcesChecked}
                  onCheckedChange={(checked) =>
                    setChecklist({ ...checklist, sourcesChecked: !!checked })
                  }
                />
                <Label htmlFor="sources" className="text-sm leading-tight">
                  Sources are credible and properly attributed
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="standards"
                  checked={checklist.communityStandards}
                  onCheckedChange={(checked) =>
                    setChecklist({
                      ...checklist,
                      communityStandards: !!checked,
                    })
                  }
                />
                <Label htmlFor="standards" className="text-sm leading-tight">
                  Meets community standards and guidelines
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {article?.reviewedBy?.comments?.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-md p-3 text-sm ${
                    comment.resolved
                      ? 'bg-green-50 dark:bg-green-950'
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  {comment.text}
                  {comment.resolved && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Resolved
                    </Badge>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[80px]"
                />
              </div>
              <Button
                onClick={handleAddComment}
                variant="outline"
                size="sm"
                disabled={!newComment.trim()}
              >
                <Send className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleApprove}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve Article
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-950">
                    or
                  </span>
                </div>
              </div>

              <Textarea
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                placeholder="Explain what needs to be revised..."
                className="min-h-[80px]"
              />

              <Button
                onClick={handleRequestRevision}
                disabled={submitting}
                variant="outline"
                className="w-full"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Request Revisions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
