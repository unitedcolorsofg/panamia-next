/**
 * ArticleSearch Component
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Search and select articles for "in reply to" functionality
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArticleResult {
  _id: string;
  slug: string;
  title: string;
  excerpt?: string;
  publishedAt: string;
  author: {
    screenname?: string;
    name?: string;
  };
}

interface ArticleSearchProps {
  onSelect: (article: ArticleResult) => void;
  excludeSlug?: string;
  placeholder?: string;
  className?: string;
}

export default function ArticleSearch({
  onSelect,
  excludeSlug,
  placeholder = 'Search articles by title...',
  className,
}: ArticleSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchArticles = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('q', searchQuery);
        params.set('limit', '10');
        if (excludeSlug) {
          params.set('exclude', excludeSlug);
        }

        const response = await fetch(`/api/articles/search?${params}`);
        const data = await response.json();

        if (data.success) {
          setResults(data.data.articles);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeSlug]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchArticles(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchArticles]);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (article: ArticleResult) => {
    onSelect(article);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pl-10"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {showResults && (query.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg dark:bg-gray-950">
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-auto py-1">
              {results.map((article) => (
                <li key={article._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(article)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 font-medium">
                        {article.title}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        by{' '}
                        {article.author.screenname
                          ? `@${article.author.screenname}`
                          : article.author.name || 'Anonymous'}
                        {' · '}
                        {formatDate(article.publishedAt)}
                      </div>
                      {article.excerpt && (
                        <div className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-400">
                          {article.excerpt}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 && !loading ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No articles found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
