/**
 * UserSearch Component
 *
 * UPSTREAM REFERENCE: external/activities.next/app/api/v1/accounts/search/
 * Search and select users by screenname for invitations
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserResult {
  _id: string;
  screenname: string;
  name?: string;
  verified?: boolean;
}

interface UserSearchProps {
  onSelect: (user: UserResult) => void;
  excludeIds?: string[];
  placeholder?: string;
  className?: string;
}

export default function UserSearch({
  onSelect,
  excludeIds = [],
  placeholder = 'Search by screenname...',
  className,
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/user/search?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        const data = await response.json();

        if (data.success) {
          // Filter out excluded users
          const filtered = data.data.users.filter(
            (u: UserResult) => !excludeIds.includes(u._id)
          );
          setResults(filtered);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeIds]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchUsers(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchUsers]);

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

  const handleSelect = (user: UserResult) => {
    onSelect(user);
    setQuery('');
    setResults([]);
    setShowResults(false);
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
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((user) => (
                <li key={user._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{user.screenname}</span>
                        {user.verified && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      {user.name && (
                        <span className="text-sm text-gray-500">
                          {user.name}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 && !loading ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No users found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
