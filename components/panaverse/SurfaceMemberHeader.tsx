import Image from 'next/image';
import Link from 'next/link';
import { type PanaverseSurface } from '@/lib/panaverse/surfaces';
import { SURFACE_MARK, SURFACE_TONE } from '@/lib/panaverse/branding';
import { SurfaceIdentity } from '@/components/panaverse/SurfaceIdentity';
import { SurfaceSearch } from '@/components/panaverse/SurfaceSearch';

/**
 * The masthead a surface wears over its own rooms.
 *
 * Pana Social had none. The root layout withholds the Pana Mia masthead on
 * surface hostnames — correctly, because that masthead over a timeline is what
 * made Pana Social read as a section of the main site — and `SurfaceGuestHeader`
 * only covers pages a surface has *borrowed*. The surface's own front door fell
 * between the two, so a signed-in member at social.pana.social/s got a bare
 * page: no mark, no nav, no account, and no route back to Pana Mia.
 *
 * Mark on the left, search in the middle, account on the right: the shape a
 * timeline wears, rather than the main site's centred mark. The two surfaces
 * share an account and a palette, and diverge here because finding a Pana is
 * the first thing done on a social feed and never the first thing done on a
 * directory landing page.
 *
 * NAV IS DELIBERATELY ABSENT. The MENU drawer that used to sit on the left
 * carried the surface nav, the shared rooms, and — via `originForFrom` — the
 * only link that can cross from social.pana.social back to the main site.
 * `PANA_SITES` in the account menu cannot stand in for that last one: it is
 * relative on purpose, so it keeps a member on the hostname they already
 * chose. While PANAVERSE_SUBDOMAINS is off and Pana Social is served from
 * `/s`, the account menu's relative links do reach Pana Mia and nothing is
 * stranded. Before that flag is turned on, this surface needs a route home
 * again. See `SurfaceMenu` in the history of this directory for what was here.
 *
 * Rendered server-side. Only the controls that need session state are client
 * components.
 */
export function SurfaceMemberHeader({
  surface,
}: {
  /** The surface being served — its mark flies here. */
  surface: PanaverseSurface;
}) {
  const mark = SURFACE_MARK[surface.id];

  return (
    <header
      className="panaverse-masthead"
      data-tone={SURFACE_TONE[surface.id]}
      data-sticky="true"
      data-contained="true"
    >
      <div
        className="panaverse-masthead-inner container mx-auto max-w-6xl px-4"
        data-layout="search"
      >
        <Link
          href={surface.rootPath}
          className="panaverse-guest-home"
          aria-label={`${surface.name} home`}
        >
          {/* No `priority`. The mark is 22px tall and the timeline below it
              carries avatars and attachments that are the real largest paint;
              preloading this would be a warning for no gain. */}
          <Image
            src={mark.src}
            alt={mark.alt}
            width={mark.width}
            height={mark.height}
            sizes="160px"
            className="panaverse-logo"
          />
        </Link>

        <SurfaceSearch surfaceName={surface.name} />

        <div className="panaverse-masthead-right">
          <SurfaceIdentity />
        </div>
      </div>
    </header>
  );
}
