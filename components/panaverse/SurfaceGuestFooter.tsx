import Link from 'next/link';
import {
  DEFAULT_SURFACE,
  type PanaverseSurface,
} from '@/lib/panaverse/surfaces';
import { SURFACE_TONE } from '@/lib/panaverse/branding';

/**
 * The closing rule under a page a surface is borrowing.
 *
 * The guest header alone would have left a gap that matters more than it
 * looks: a borrowed page on a surface host is a public, indexable page, and
 * with no footer it offered no route to the terms or the privacy policy at
 * all. On the main site those links live in MainFooter, which a surface does
 * not render. That is a compliance gap rather than a missing flourish, which
 * is why this exists even though the header already solves the navigation
 * dead end.
 *
 * `/signin` established the pattern: a standalone page that carries only the
 * legal links a signed-out visitor needs, rather than reproducing the site
 * footer. This follows it.
 *
 * The links are deliberately relative, so they open on the surface the member
 * is already in and arrive wearing this same guest treatment. Sending them to
 * the main site to read the terms would undo the decision this whole feature
 * implements — that a member can browse Pana Mia content without being
 * ejected from Pana Social. The header's "Open on ..." link is there for
 * anyone who does want the page on its own surface.
 *
 * It carries no way home and no switcher: the guest header, which is always
 * rendered with this, already has both.
 */
export function SurfaceGuestFooter({
  surface,
  owner = DEFAULT_SURFACE,
}: {
  /** The surface being served — sets the tone of the top rule. */
  surface: PanaverseSurface;
  /** The surface this page belongs to, named in the attribution line. */
  owner?: PanaverseSurface;
}) {
  return (
    <footer
      className="panaverse-guest-footer"
      data-tone={SURFACE_TONE[surface.id]}
    >
      <div className="panaverse-guest-footer-inner container mx-auto max-w-6xl px-4">
        <span className="panaverse-guest-footer-note">
          {owner.name} content, shown on {surface.name}
        </span>
        <nav aria-label="Legal" className="panaverse-guest-footer-nav">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
