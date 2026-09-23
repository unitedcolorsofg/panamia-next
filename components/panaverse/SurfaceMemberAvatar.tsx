'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/lib/auth-client';
import { useMyActor } from '@/lib/query/social';

/**
 * The member's own face in the surface masthead.
 *
 * Split out from SurfaceSwitcher rather than folded into it because the two
 * answer different questions — "where else can I go" and "who am I / take me
 * to my own page" — and the switcher is already the busier control. Both read
 * the actor through `useMyActor`, which react-query dedupes to a single
 * request per page.
 *
 * The identity deliberately does not come from the session. `useSession`
 * returns `name: ''` and `image: ''` — the enriched fields it carries are
 * permissions, not profile — so the display name and avatar have to come from
 * the social actor, which is also the record that owns the fediverse handle.
 */
export function SurfaceMemberAvatar() {
  const { status } = useSession();
  const { data: me } = useMyActor();
  const actor = me?.actor ?? null;

  /* Hold the slot while auth resolves. The masthead is the first thing painted
     on the page, so letting this collapse and reappear moves the switcher
     sideways under the cursor. */
  if (status === 'loading') {
    return (
      <div
        className="bg-pana-ink/10 h-8 w-8 flex-none rounded-full"
        aria-hidden="true"
      />
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Link href="/signin" className="panaverse-guest-link">
        Sign in
      </Link>
    );
  }

  /* Signed in, but no actor yet: the member has an account and has not been
     given a social identity — SocialEligibilityGate explains why on the page
     itself. Sending them to a profile that does not exist would be the one
     control in the masthead that 404s, so it points at the account page,
     which is where the answer lives. */
  const href = actor ? `/p/${actor.username}` : '/account';
  const label = actor?.name || actor?.username || 'Your account';

  return (
    <Link href={href} aria-label={label} className="flex-none">
      <Avatar className="chrome-avatar h-8 w-8">
        <AvatarImage src={actor?.iconUrl || undefined} alt="" />
        <AvatarFallback className="text-[11px]">
          {label.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
}
