'use client';

import { PostCard } from './PostCard';
import { Button } from '@/components/ui/button';
import { SocialStatusDisplay } from '@/lib/interfaces';
import { Loader2 } from 'lucide-react';

interface PostListProps {
  statuses: SocialStatusDisplay[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
}

export function PostList({
  statuses,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  emptyMessage = 'No posts yet',
}: PostListProps) {
  if (isLoading && statuses.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map((status) => (
        <PostCard key={status.id} status={status} />
      ))}

      {hasMore && onLoadMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
