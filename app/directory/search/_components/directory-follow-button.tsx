'use client';

import { FollowButton } from '@/components/social';
import { useMyActor, useActor } from '@/lib/query/social';

interface DirectoryFollowButtonProps {
  profileSlug: string;
}

/**
 * Follow button for directory search results.
 * Only renders if both the viewer and the profile have social actors enabled.
 */
export function DirectoryFollowButton({
  profileSlug,
}: DirectoryFollowButtonProps) {
  const { data: myActorData, isLoading: myActorLoading } = useMyActor();
  const { data: targetActorData, isLoading: targetActorLoading } =
    useActor(profileSlug);

  // Don't render while loading
  if (myActorLoading || targetActorLoading) {
    return null;
  }

  // Don't render if viewer doesn't have an actor
  if (!myActorData?.actor) {
    return null;
  }

  // Don't render if target profile doesn't have an actor
  if (!targetActorData?.actor) {
    return null;
  }

  // Don't render if viewing own profile
  if (targetActorData.isSelf) {
    return null;
  }

  return (
    <FollowButton
      username={profileSlug}
      isFollowing={targetActorData.isFollowing || false}
      variant="outline"
    />
  );
}
