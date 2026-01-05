/**
 * MastodonComments Component
 *
 * Displays comments fetched from a Mastodon post thread.
 * Comments are read-only - users reply via Mastodon.
 */

'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, ExternalLink, RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface MastodonComment {
  id: string;
  author: {
    username: string;
    displayName: string;
    avatar: string;
    url: string;
    instance: string;
  };
  content: string;
  createdAt: string;
  url: string;
  repliesCount: number;
  inReplyToId: string | null;
}

interface MastodonCommentsProps {
  slug: string;
}

export default function MastodonComments({ slug }: MastodonCommentsProps) {
  const [comments, setComments] = useState<MastodonComment[]>([]);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchComments() {
    try {
      const res = await fetch(`/api/articles/${slug}/comments`);
      const data = await res.json();

      if (data.success) {
        setComments(data.data.comments || []);
        setPostUrl(data.data.postUrl);
        setError(data.data.error || null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchComments();
  }, [slug]);

  function handleRefresh() {
    setRefreshing(true);
    fetchComments();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // If no post URL is linked, don't show the comments section
  if (!loading && !postUrl) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-500">
          <MessageCircle className="h-5 w-5 animate-pulse" />
          <span>Loading comments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MessageCircle className="h-5 w-5" />
          Comments
          {comments.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              ({comments.length})
            </span>
          )}
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Refresh comments"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
            >
              <span>Reply on Mastodon</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}

      {comments.length === 0 ? (
        <div className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-800/50">
          <p className="text-gray-600 dark:text-gray-400">
            No comments yet. Be the first to reply on Mastodon!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-gray-500">
        Comments are powered by{' '}
        <a
          href="https://joinmastodon.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:underline dark:text-purple-400"
        >
          Mastodon
        </a>
        . Reply to the linked post to join the conversation.
      </p>
    </div>
  );
}

function CommentCard({ comment }: { comment: MastodonComment }) {
  const authorHandle = `@${comment.author.username}@${comment.author.instance}`;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3 flex items-start justify-between">
        <a
          href={comment.author.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:opacity-80"
        >
          <Image
            src={comment.author.avatar}
            alt={comment.author.displayName}
            width={40}
            height={40}
            className="rounded-full"
            unoptimized
          />
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {comment.author.displayName}
            </div>
            <div className="text-sm text-gray-500">{authorHandle}</div>
          </div>
        </a>

        <a
          href={comment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          title="View on Mastodon"
        >
          {new Date(comment.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      </div>

      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-purple-600 dark:[&_a]:text-purple-400"
        dangerouslySetInnerHTML={{ __html: comment.content }}
      />

      {comment.repliesCount > 0 && (
        <a
          href={comment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {comment.repliesCount}{' '}
          {comment.repliesCount === 1 ? 'reply' : 'replies'}
        </a>
      )}
    </article>
  );
}
