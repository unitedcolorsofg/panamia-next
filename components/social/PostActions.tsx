'use client';

import { Button } from '@/components/ui/button';
import { useLikePost, useUnlikePost } from '@/lib/query/social';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

  const handleLike = async () => {
    try {
      if (liked) {
        await unlikePost.mutateAsync(statusId);
      } else {
        await likePost.mutateAsync(statusId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update like. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/p/${actorUsername}/${statusId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied',
        description: 'Post link copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      {showReplyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-8 px-2"
          onClick={onReply}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          {repliesCount > 0 && <span className="text-xs">{repliesCount}</span>}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-2 ${
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
        className="text-muted-foreground hover:text-foreground h-8 px-2"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
