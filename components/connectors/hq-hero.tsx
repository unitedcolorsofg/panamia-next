import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { TierLabel } from '@/components/connectors/dashboard-parts';
import { getHouse, getPod, getTier } from '@/lib/connectors/model';
import type { ProfileConnector } from '@/lib/connectors/membership';

/**
 * The member's own face, next to their own name.
 *
 * Draws `primaryImageCdn` — the same picture the account bubble in the
 * masthead uses — so HQ greets you with the photo you set in settings rather
 * than with a second avatar that could drift from it.
 *
 * A plain `<img>` rather than `next/image`, matching what the identity menu
 * does with these: the CDN host is not in the remote-pattern allowlist, and
 * adding it for one 56px disc is more configuration than the picture is worth.
 *
 * Falls back to initials. A profile photo is optional and always has been, so
 * the empty case is ordinary rather than exceptional — an avatar that collapsed
 * to nothing would leave the greeting hanging off a ragged left edge.
 *
 * `aria-hidden` because the name it sits beside is already in the heading.
 * Announcing the picture too would read the member their own name twice before
 * saying anything they did not already know.
 */
function MemberAvatar({ name, src }: { name: string; src: string | null }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <span
      aria-hidden="true"
      className="border-pana-ink/15 bg-pana-indigo text-pana-cream flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-lg font-extrabold select-none"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/**
 * The top of Connector HQ: who you are, and what you signed up for.
 *
 * Deliberately *not* a filled colour band. The masthead above it is cream, and
 * a solid indigo block butted straight against it drew a hard horizontal seam
 * across the top of the page — the surface read as two unrelated headers
 * stacked rather than one page. Running the same cream through from the
 * masthead lets the page start with the member's name instead of with a
 * rectangle.
 *
 * The surface keeps its indigo identity in the panel headers below, where a
 * filled bar separates content rather than fighting the chrome above it.
 *
 * Colour rule from `lib/connectors/theme.ts` applies: on a cream ground the
 * text has to be ink, and the butter accent that worked on indigo does not
 * survive here — so the eyebrow and the edit link carry indigo instead.
 */
export function HqHero({
  displayName,
  imageUrl,
  membership,
  podSize,
}: {
  displayName: string;
  imageUrl: string | null;
  membership: ProfileConnector;
  podSize: number;
}) {
  const houses = membership.houses.map(getHouse);
  const tier = getTier(membership.tier);
  const pod = getPod(membership.pod);

  return (
    <header className="border-pana-ink/10 border-b">
      <div className="container mx-auto px-4 pt-10 pb-8">
        <div className="flex items-center gap-4">
          <MemberAvatar name={displayName} src={imageUrl} />
          <div className="min-w-0">
            <p className="text-pana-indigo text-xs font-extrabold tracking-[0.2em] uppercase">
              Connector HQ
            </p>
            <h1 className="mt-1 text-4xl leading-tight font-extrabold sm:text-5xl">
              Hey, {displayName.split(' ')[0]}.
            </h1>
          </div>
        </div>

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-pana-ink/60 text-xs font-bold tracking-wide uppercase">
              {houses.length === 1 ? 'House' : 'Houses'}
            </dt>
            <dd className="mt-0.5 font-bold">
              {houses.map((h) => h.name).join(' · ')}
            </dd>
          </div>
          <div>
            <dt className="text-pana-ink/60 text-xs font-bold tracking-wide uppercase">
              Tier
            </dt>
            <dd className="mt-0.5 font-bold">
              <TierLabel tier={membership.tier} />
            </dd>
          </div>
          <div>
            <dt className="text-pana-ink/60 text-xs font-bold tracking-wide uppercase">
              Pod
            </dt>
            <dd className="mt-0.5 font-bold">
              {pod.name} ·{' '}
              {podSize === 1 ? 'just you so far' : `${podSize} connectors`}
            </dd>
          </div>
        </dl>

        <p className="text-pana-ink/70 mt-4 max-w-2xl text-sm leading-relaxed">
          {tier.blurb}
        </p>

        <p className="mt-4 text-sm">
          <SurfaceLink
            href="/connectors/join"
            className="text-pana-indigo font-bold underline underline-offset-4"
          >
            Change your houses or pod
          </SurfaceLink>
        </p>
      </div>
    </header>
  );
}
