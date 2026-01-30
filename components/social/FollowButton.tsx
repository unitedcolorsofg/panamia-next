'use client';

import { Button } from '@/components/ui/button';
import { useFollowActor, useUnfollowActor } from '@/lib/query/social';
import { toast } from '@/hooks/use-toast';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  showIcon?: boolean;
}

export function FollowButton({
  username,
  isFollowing,
  size = 'sm',
  variant = 'default',
  showIcon = true,
}: FollowButtonProps) {
  const followActor = useFollowActor();
  const unfollowActor = useUnfollowActor();

  const isPending = followActor.isPending || unfollowActor.isPending;

  const handleClick = async () => {
    try {
      if (isFollowing) {
        await unfollowActor.mutateAsync(username);
        toast({
          title: 'Unfollowed',
          description: `You unfollowed @${username}`,
        });
      } else {
        await followActor.mutateAsync(username);
        toast({
          title: 'Following',
          description: `You are now following @${username}`,
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : variant}
      size={size}
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {showIcon &&
            (isFollowing ? (
              <UserMinus className="mr-1 h-4 w-4" />
            ) : (
              <UserPlus className="mr-1 h-4 w-4" />
            ))}
          {isFollowing ? 'Following' : 'Follow'}
        </>
      )}
    </Button>
  );
}
