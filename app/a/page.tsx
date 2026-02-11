/**
 * Articles Exploration Page
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Browse and filter published articles
 */

'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, PenLine, X } from 'lucide-react';

interface Article {
  _id: string;
  slug: string;
  title: string;
  excerpt?: string;
  articleType: 'business_update' | 'community_commentary';
  tags: string[];
  coverImage?: string;
  readingTime?: number;
  publishedAt: string;
  author: {
    screenname?: string;
    name?: string;
  };
  coAuthorCount: number;
}

function ArticlesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const typeFilter = searchParams?.get('type') || '';
  const tagFilter = searchParams?.get('tag') || '';

  const fetchArticles = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();
        params.set('limit', '12');
        params.set('offset', currentOffset.toString());
        if (typeFilter) params.set('type', typeFilter);
        if (tagFilter) params.set('tag', tagFilter);

        const response = await fetch(`/api/articles/recent?${params}`);
        const data = await response.json();

        if (data.success) {
          if (reset) {
            setArticles(data.data.articles);
          } else {
            setArticles((prev) => [...prev, ...data.data.articles]);
          }
          setHasMore(data.data.pagination.hasMore);
          setOffset(currentOffset + data.data.articles.length);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, typeFilter, tagFilter]
  );

  useEffect(() => {
    setOffset(0);
    fetchArticles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, tagFilter]);

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value && value !== 'all') {
      params.set('type', value);
    } else {
      params.delete('type');
    }
    router.push(`/a?${params.toString()}`);
  };

  const clearTagFilter = () => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('tag');
    router.push(`/a?${params.toString()}`);
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Community Articles</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Stories, updates, and perspectives from the Pana MIA community
          </p>
        </div>
        <Button asChild>
          <Link href="/a/new">
            <PenLine className="mr-2 h-4 w-4" />
            Write Article
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={typeFilter || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="business_update">Business Updates</SelectItem>
            <SelectItem value="community_commentary">Commentary</SelectItem>
          </SelectContent>
        </Select>

        {tagFilter && (
          <Badge variant="secondary" className="flex items-center gap-1 py-1">
            #{tagFilter}
            <button onClick={clearTagFilter} className="ml-1">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty State */}
      {!loading && articles.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            No articles yet
          </h3>
          <p className="mt-1 text-gray-500">
            {tagFilter
              ? `No articles found with tag "${tagFilter}"`
              : 'Be the first to publish an article!'}
          </p>
          <Button asChild className="mt-4">
            <Link href="/a/new">
              <PenLine className="mr-2 h-4 w-4" />
              Write Article
            </Link>
          </Button>
        </div>
      )}

      {/* Article Grid */}
      {!loading && articles.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article._id}
                slug={article.slug}
                title={article.title}
                excerpt={article.excerpt}
                articleType={article.articleType}
                tags={article.tags}
                coverImage={article.coverImage}
                readingTime={article.readingTime}
                publishedAt={article.publishedAt}
                author={article.author}
                coAuthorCount={article.coAuthorCount}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={() => fetchArticles()}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense
      fallback={
        <main className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </main>
      }
    >
      <ArticlesContent />
    </Suspense>
  );
}
