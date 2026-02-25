'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { PostActions } from './PostActions';

const PostComposer = dynamic(
  () => import('./PostComposer').then((m) => ({ default: m.PostComposer })),
  { ssr: false }
);
import { AttachmentGrid } from './AttachmentGrid';
import { SocialStatusDisplay } from '@/lib/interfaces';
import { getVisibilityFromRecipients } from '@/lib/utils/getVisibility';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface PostCardProps {
  status: SocialStatusDisplay;
  showReplyComposer?: boolean;
  isDetail?: boolean;
}

export function PostCard({
  status,
  showReplyComposer = false,
  isDetail = false,
}: PostCardProps) {
  const [showCWContent, setShowCWContent] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);

  const publishedDate = status.published
    ? new Date(status.published)
    : new Date();

  const timeAgo = formatDistanceToNow(publishedDate, { addSuffix: true });

  const actorInitials = status.actor.name
    ? status.actor.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : status.actor.username.slice(0, 2).toUpperCase();

  const hasCW =
    status.contentWarning && status.contentWarning.trim().length > 0;

  return (
    <Card className={isDetail ? 'border-0 shadow-none' : ''}>
      <CardContent className={isDetail ? 'px-0 pt-0' : 'pt-4'}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/p/${status.actor.username}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={status.actor.iconUrl || undefined} />
              <AvatarFallback>{actorInitials}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/p/${status.actor.username}`}
                className="truncate font-semibold hover:underline"
              >
                {status.actor.name || status.actor.username}
              </Link>
              <Link
                href={`/p/${status.actor.username}`}
                className="text-muted-foreground truncate text-sm"
              >
                @{status.actor.username}
              </Link>
              <span className="text-muted-foreground text-sm">&middot;</span>
              <Link
                href={`/p/${status.actor.username}/${status.id}`}
                className="text-muted-foreground text-sm hover:underline"
              >
                {timeAgo}
              </Link>
            </div>

            {/* Reply indicator */}
            {status.inReplyTo && (
              <p className="text-muted-foreground mt-1 text-sm">
                Replying to{' '}
                <Link
                  href={`/p/${status.inReplyTo.actorUsername}`}
                  className="text-primary hover:underline"
                >
                  @{status.inReplyTo.actorUsername}
                </Link>
              </p>
            )}

            {/* Content Warning */}
            {hasCW && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setShowCWContent(!showCWContent)}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">{status.contentWarning}</span>
                  </span>
                  {showCWContent ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Content */}
            {(!hasCW || showCWContent) && (
              <div
                className="prose prose-sm dark:prose-invert mt-2 max-w-none break-words"
                dangerouslySetInnerHTML={{ __html: status.content }}
              />
            )}

            {/* Attachments */}
            {status.attachments && status.attachments.length > 0 && (
              <AttachmentGrid attachments={status.attachments} />
            )}

            {/* Location */}
            {status.location && (
              <a
                href={
                  status.location.latitude && status.location.longitude
                    ? `https://www.google.com/maps/search/?api=1&query=${status.location.latitude},${status.location.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(status.location.name || '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                <MapPin className="h-4 w-4" />
                <span>
                  {status.location.name ||
                    `${status.location.latitude?.toFixed(4)}, ${status.location.longitude?.toFixed(4)}`}
                  {status.location.precision === 'general' && ' (approx)'}
                </span>
              </a>
            )}

            {/* Actions */}
            <div className="mt-3">
              <PostActions
                statusId={status.id}
                actorUsername={status.actor.username}
                liked={status.liked}
                likesCount={status.likesCount}
                repliesCount={status.repliesCount}
                onReply={() => setShowReplyBox(!showReplyBox)}
                showReplyButton={!isDetail}
              />
            </div>

            {/* Reply composer */}
            {(showReplyBox || showReplyComposer) && (
              <div className="border-muted mt-3 border-l-2 pl-2">
                <PostComposer
                  inReplyTo={status.id}
                  replyVisibility={getVisibilityFromRecipients(
                    status.recipientTo,
                    status.recipientCc
                  )}
                  onSuccess={() => setShowReplyBox(false)}
                  placeholder={`Reply to @${status.actor.username}...`}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
