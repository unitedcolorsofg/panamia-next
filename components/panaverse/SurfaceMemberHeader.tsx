import Image from 'next/image';
import Link from 'next/link';
import {
  SURFACES,
  originForFrom,
  type PanaverseSurface,
} from '@/lib/panaverse/surfaces';
import {
  SURFACE_MARK,
  SURFACE_NAV,
  SURFACE_TONE,
} from '@/lib/panaverse/branding';
import {
  SurfaceSwitcher,
  type SurfaceLink,
} from '@/components/panaverse/SurfaceSwitcher';
import { SurfaceMemberAvatar } from '@/components/panaverse/SurfaceMemberAvatar';

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
 * Three things are constant across every surface masthead and one changes. The
 * constants are the mark's lettering family, the switcher, and the avatar —
 * enough to read as one organisation across an origin boundary. What changes is
 * which mark, which nav, and the accent rule. That split is the whole design:
 * constant enough to be one org, different enough that a timeline does not
 * carry a directory nav.
 *
 * Rendered server-side so the cross-surface origins are resolved where
 * PANAVERSE_ROOT_DOMAIN actually exists — see SurfaceLink. Only the two
 * controls that need session state are client components.
 */
export function SurfaceMemberHeader({
  surface,
  host,
  pathname,
}: {
  /** The surface being served — its mark flies here and its nav is rendered. */
  surface: PanaverseSurface;
  /** Raw Host header. Keeps cross-surface links on the scheme and port in hand
   *  rather than sending a developer out to the live site. */
  host: string | null | undefined;
  /** Path being served, used only to mark the active nav item. */
  pathname: string;
}) {
  const mark = SURFACE_MARK[surface.id];
  const nav = SURFACE_NAV[surface.id] ?? [];

  const links: SurfaceLink[] = SURFACES.map((s) => {
    const href = `${originForFrom(s, host)}${s.rootPath}`;
    return {
      id: s.id,
      name: s.name,
      /* The host actually being linked to, not `hostnameFor(s)`. The two are
       * the same string in production, but `hostnameFor` always names the
       * configured root domain, so in dev the panel read "social.pana.social"
       * under a link that went to social.localhost:3003 — a label describing
       * somewhere the click does not go. Reading it back off the href cannot
       * disagree with the destination. */
      hostname: new URL(href).host,
      href,
    };
  });

  return (
    <header
      className="panaverse-masthead"
      data-tone={SURFACE_TONE[surface.id]}
      data-sticky="true"
      data-contained="true"
    >
      <div className="panaverse-masthead-inner container mx-auto max-w-6xl px-4">
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

        {nav.length > 0 && (
          <nav className="panaverse-nav" aria-label={`${surface.name}`}>
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active || undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex flex-none items-center gap-2">
          <SurfaceSwitcher surfaces={links} currentId={surface.id} />
          <SurfaceMemberAvatar />
        </div>
      </div>
    </header>
  );
}
