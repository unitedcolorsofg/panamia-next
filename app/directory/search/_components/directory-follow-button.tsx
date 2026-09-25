'use client';

import { FollowButton } from '@/components/social';
import { useMyActor, useActor } from '@/lib/query/social';

interface DirectoryFollowButtonProps {
  screenname: string;
}

/**
 * Follow button for directory search results.
 * Only renders if both the viewer and the profile have social actors enabled.
 *
 * The viewer is resolved first and the target fetch waits on it. A signed-out
 * visitor can't follow anyone, so asking the server about each business on the
 * page only to render nothing costs a request per card — seventeen of them on
 * a full page of results.
 */
export function DirectoryFollowButton({
  screenname,
}: DirectoryFollowButtonProps) {
  const { data: myActorData, isLoading: myActorLoading } = useMyActor();
  const viewerHasActor = Boolean(myActorData?.actor);

  const { data: targetActorData, isLoading: targetActorLoading } = useActor(
    screenname,
    viewerHasActor
  );

  // Don't render if the viewer doesn't have an actor, or we don't know yet
  if (myActorLoading || !viewerHasActor) {
    return null;
  }

  // Don't render while the target is still loading
  if (targetActorLoading) {
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
      username={screenname}
      isFollowing={targetActorData.isFollowing || false}
      variant="outline"
    />
  );
}
