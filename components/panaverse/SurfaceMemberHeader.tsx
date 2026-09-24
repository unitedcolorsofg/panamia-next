import Image from 'next/image';
import Link from 'next/link';
import {
  SURFACES,
  originForFrom,
  type PanaverseSurface,
} from '@/lib/panaverse/surfaces';
import {
  SHARED_ROOMS,
  SURFACE_MARK,
  SURFACE_NAV,
  SURFACE_TONE,
} from '@/lib/panaverse/branding';
import { type NavDrawerItem } from '@/components/NavDrawer';
import { SurfaceIdentity } from '@/components/panaverse/SurfaceIdentity';
import { SurfaceMenu } from '@/components/panaverse/SurfaceMenu';

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
 * Wears the main site's shape — MENU on the left, mark centred, account on the
 * right, cream bar under a hairline rule. Two sites that share an account and
 * differ in chrome read as two products; the thing that makes them one is that
 * the furniture sits where you last left it. What still changes per surface is
 * which mark flies and where the links go, which is as much difference as a
 * timeline and a directory need.
 *
 * The cross-surface links and the shared rooms live in the drawer rather than
 * in a switcher beside the avatar. That follows the main masthead, which moved
 * its own cross-site menu into the drawer for the same reason: a bar carrying
 * four controls on a phone has no room left for the mark.
 *
 * They stay in the drawer even though the account menu now lists the Pana
 * sites too, because the two lists cross different boundaries. `PANA_SITES`
 * is deliberately relative — it keeps a member on the hostname they already
 * chose — so it cannot carry anyone from social.pana.social back to the main
 * site. Only these `originForFrom` links do, and that route home was the
 * reason the drawer grew them.
 *
 * Rendered server-side so the cross-surface origins are resolved where
 * PANAVERSE_ROOT_DOMAIN actually exists. Only the controls that need session
 * state are client components.
 */
export function SurfaceMemberHeader({
  surface,
  host,
}: {
  /** The surface being served — its mark flies here and its nav leads the drawer. */
  surface: PanaverseSurface;
  /** Raw Host header. Keeps cross-surface links on the scheme and port in hand
   *  rather than sending a developer out to the live site. */
  host: string | null | undefined;
}) {
  const mark = SURFACE_MARK[surface.id];

  /* Everything the switcher used to hold, in the order a member reads it:
     where they already are, the rooms they can reach without crossing an
     origin, then the other surface. Built on the server because that is where
     PANAVERSE_ROOT_DOMAIN is — the same reason the switcher took resolved
     hrefs rather than building them in the browser. */
  const menuItems: NavDrawerItem[] = [
    ...(SURFACE_NAV[surface.id] ?? []).map((item) => ({
      href: item.href,
      label: item.label,
    })),
    ...SHARED_ROOMS.map((room) => ({ href: room.path, label: room.name })),
    ...SURFACES.filter((s) => s.id !== surface.id).map((s) => ({
      href: `${originForFrom(s, host)}${s.rootPath}`,
      label: s.name,
    })),
  ];

  return (
    <header
      className="panaverse-masthead"
      data-tone={SURFACE_TONE[surface.id]}
      data-sticky="true"
      data-contained="true"
    >
      <div
        className="panaverse-masthead-inner container mx-auto max-w-6xl px-4"
        data-layout="centered"
      >
        <div className="panaverse-masthead-left">
          <SurfaceMenu items={menuItems} mark={mark} />
        </div>

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

        <div className="panaverse-masthead-right">
          <SurfaceIdentity />
        </div>
      </div>
    </header>
  );
}
