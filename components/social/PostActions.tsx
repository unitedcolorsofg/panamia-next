'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLikePost, useMyActor, useUnlikePost } from '@/lib/query/social';
import {
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { ReportDialog } from './ReportDialog';

interface PostActionsProps {
  statusId: string;
  actorUsername: string;
  liked: boolean;
  likesCount: number;
  repliesCount: number;
  onReply?: () => void;
  showReplyButton?: boolean;
}

export function PostActions({
  statusId,
  actorUsername,
  liked,
  likesCount,
  repliesCount,
  onReply,
  showReplyButton = true,
}: PostActionsProps) {
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const { t } = useTranslation('toast');
  const [reportOpen, setReportOpen] = useState(false);

  // Reporting needs a social actor of your own, and reporting yourself is
  // rejected by the route, so the menu only appears when it can actually do
  // something. `useMyActor` is already cached by the surrounding timeline, so
  // this costs no extra request per post.
  const { data: me } = useMyActor();
  const canReport = !!me?.actor && me.actor.username !== actorUsername;

  const handleLike = async () => {
    try {
      if (liked) {
        await unlikePost.mutateAsync(statusId);
      } else {
        await likePost.mutateAsync(statusId);
      }
    } catch {
      toast({
        title: t('error'),
        description: t('likeFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/p/${actorUsername}/${statusId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('linkCopied'),
        description: t('linkCopiedDesc'),
      });
    } catch {
      toast({
        title: t('error'),
        description: t('linkCopyFailed'),
        variant: 'destructive',
      });
    }
  };

  // These buttons are icon-only when their count is zero, so without an
  // explicit name a screen reader announces them as just "button".
  const replyLabel =
    repliesCount > 0
      ? `Reply, ${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`
      : 'Reply';
  const likeLabel =
    likesCount > 0
      ? `Like, ${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`
      : 'Like';

  return (
    <div className="flex items-center gap-1">
      {showReplyButton && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={replyLabel}
          className="text-muted-foreground hover:text-foreground h-8 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11"
          onClick={onReply}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          {repliesCount > 0 && <span className="text-xs">{repliesCount}</span>}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-label={likeLabel}
        aria-pressed={liked}
        className={`h-8 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11 ${
          liked
            ? 'text-red-500 hover:text-red-600'
            : 'text-muted-foreground hover:text-red-500'
        }`}
        onClick={handleLike}
        disabled={likePost.isPending || unlikePost.isPending}
      >
        <Heart className={`mr-1 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
        {likesCount > 0 && <span className="text-xs">{likesCount}</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-label="Copy link to post"
        className="text-muted-foreground hover:text-foreground h-8 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
      </Button>

      {canReport && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="More options for this post"
                className="text-muted-foreground hover:text-foreground h-8 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="mr-2 h-4 w-4" />
                Report post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            username={actorUsername}
            statusId={statusId}
          />
        </>
      )}
    </div>
  );
}
