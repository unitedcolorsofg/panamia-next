import { Handshake, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* What the viewer's relationship to this person currently is.
 *
 * A Pana is a mutual follow, which is derived rather than stored -- and derived
 * state has a well-known failure mode: it is invisible. Nothing otherwise tells
 * you why a surface unlocked, and on Pana Social the mutual is load-bearing for
 * permissions rather than decorative. See docs/SOCIAL-GRAPH.md.
 *
 * The row that earns this component is "Follows you". It turns a hidden
 * mechanic into a prompt by telling somebody they are one tap from a Pana,
 * which does more for connection than any counter because it is actionable.
 *
 * Deliberately silent in the other two states. "You follow them" is already
 * carried by the button next to it reading Following, and a badge for "no
 * relationship" would put a label on every stranger in the directory.
 */
export type RelationshipBadgeProps = {
  /** Viewer -> this person, accepted. */
  isFollowing: boolean;
  /** This person -> viewer, accepted. */
  isFollowedBy: boolean;
  className?: string;
};

export function RelationshipBadge({
  isFollowing,
  isFollowedBy,
  className,
}: RelationshipBadgeProps) {
  if (!isFollowedBy) return null;

  const isPana = isFollowing;
  const Icon = isPana ? Handshake : UserCheck;

  return (
    <span
      className={cn('identity-pill', className)}
      data-tone={isPana ? 'pana' : 'follows-you'}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {isPana ? 'Pana' : 'Follows you'}
    </span>
  );
}
