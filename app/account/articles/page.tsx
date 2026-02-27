/**
 * My Articles Dashboard
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Author's article management dashboard
 */

'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PenLine,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';

interface Article {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  articleType: 'business_update' | 'community_commentary';
  status: string;
  userRole: 'author' | 'coauthor';
  coAuthorStatus?: string;
  publishedAt?: string;
  updatedAt: string;
  readingTime: number;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    icon: <PenLine className="h-3 w-3" />,
  },
  pending_review: {
    label: 'Pending Review',
    color:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: <Clock className="h-3 w-3" />,
  },
  revision_needed: {
    label: 'Revision Needed',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  published: {
    label: 'Published',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  removed: {
    label: 'Removed',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: <Trash2 className="h-3 w-3" />,
  },
};

function ArticleCard({ article }: { article: Article }) {
  const status = statusConfig[article.status] || statusConfig.draft;
  const canEdit =
    article.status === 'draft' ||
    article.status === 'pending_review' ||
    article.status === 'revision_needed';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
              <Badge variant="secondary">
                {article.articleType === 'business_update'
                  ? 'Business Update'
                  : 'Commentary'}
              </Badge>
              {article.userRole === 'coauthor' && (
                <Badge variant="outline">Co-Author</Badge>
              )}
            </div>
            <h3 className="mb-1 truncate text-lg font-semibold">
              {article.title || 'Untitled Article'}
            </h3>
            {article.excerpt && (
              <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                {article.excerpt}
              </p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span>{article.readingTime} min read</span>
              <span>
                Updated{' '}
                {new Date(article.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {article.publishedAt && (
                <span>
                  Published{' '}
                  {new Date(article.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/a/${article.slug}/edit`}>
                  <Edit3 className="mr-1 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {article.status === 'published' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/a/${article.slug}`}>
                  <FileText className="mr-1 h-4 w-4" />
                  View
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyArticlesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'drafts' | 'published'>('all');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/signin?callbackUrl=/account/articles');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch('/api/articles/my');
        const data = await response.json();

        if (data.success) {
          setArticles(data.data.articles);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchArticles();
    }
  }, [session]);

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
              You must be signed in to view your articles.
            </p>
            <Button asChild>
              <Link href="/signin?callbackUrl=/account/articles">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const filteredArticles = articles.filter((article) => {
    if (filter === 'drafts') {
      return ['draft', 'pending_review', 'revision_needed'].includes(
        article.status
      );
    }
    if (filter === 'published') {
      return article.status === 'published';
    }
    return true;
  });

  const draftCount = articles.filter((a) =>
    ['draft', 'pending_review', 'revision_needed'].includes(a.status)
  ).length;
  const publishedCount = articles.filter(
    (a) => a.status === 'published'
  ).length;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Articles
              </CardTitle>
              <Button asChild>
                <Link href="/a/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Article
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
            >
              <TabsList>
                <TabsTrigger value="all">All ({articles.length})</TabsTrigger>
                <TabsTrigger value="drafts">Drafts ({draftCount})</TabsTrigger>
                <TabsTrigger value="published">
                  Published ({publishedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                {filter === 'all'
                  ? 'No articles yet'
                  : filter === 'drafts'
                    ? 'No drafts'
                    : 'No published articles'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'all'
                  ? 'Create your first article to get started.'
                  : filter === 'drafts'
                    ? 'All your articles are published or you have none yet.'
                    : 'Publish an article to see it here.'}
              </p>
              {filter === 'all' && (
                <Button className="mt-4" asChild>
                  <Link href="/a/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Article
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredArticles.map((article) => (
              <ArticleCard key={article._id} article={article} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
