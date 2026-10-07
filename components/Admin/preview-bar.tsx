import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  ADMIN_ROLE_LABEL,
  ADMIN_VIEWER_ROLES,
  type AdminViewerRole,
} from '@/lib/admin/preview';
import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * The bar that says "none of this is real yet".
 *
 * Same shape as the Connectors viewer switch and deliberately just as loud. It
 * carries `?as=` in a link rather than holding client state so a reviewer can
 * paste a URL that reproduces what they saw, and so the whole surface stays
 * server-rendered.
 *
 * It keeps the path it is on, because unlike Connectors — where each role
 * implies a different home — here both roles are answers to the same question
 * about the same page: what does a non-admin get if they find this URL.
 */
export function AdminPreviewBar({
  current,
  path,
}: {
  current: AdminViewerRole;
  /** The route to stay on while switching. */
  path: string;
}) {
  return (
    <div className="border-b-2 border-dashed border-pana-ink/30 bg-pana-butter-2">
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-pana-ink/60">
          Mock · viewing as
        </span>
        <nav className="flex flex-wrap gap-2" aria-label="Preview as">
          {ADMIN_VIEWER_ROLES.map((role) => {
            const active = role === current;
            return (
              <SurfaceLink
                key={role}
                href={`${path}?as=${role}`}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full border-2 border-pana-ink px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? `${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL}`
                    : 'bg-transparent text-pana-ink hover:bg-pana-ink/10'
                }`}
              >
                {ADMIN_ROLE_LABEL[role]}
              </SurfaceLink>
            );
          })}
        </nav>
        <p className="text-xs leading-snug text-pana-ink/60">
          Real gate is <code>checkAdminAuth()</code> against{' '}
          <code>ADMIN_EMAILS</code>.
        </p>
      </div>
    </div>
  );
}

/**
 * What a signed-in pana who is not staff gets.
 *
 * Says no without explaining the shape of what it is refusing — an admin tool
 * should not teach its own map to somebody who cannot open it. The way back is
 * the main site rather than the previous page, because a non-admin following a
 * link here most likely arrived from outside.
 */
export function NotStaff() {
  return (
    <main className="bg-pana-cream py-24 text-pana-ink">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          Staff only.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pana-ink/70">
          These are the tools the panas use to run Pana Mia. If you think you
          should have them, ask whoever set up your account.
        </p>
        <div className="mt-8">
          <SurfaceLink
            href="/"
            className={`rounded-full border-2 ${ADMIN_CHROME.BORDER} ${ADMIN_CHROME.FILL} px-5 py-2.5 text-sm font-extrabold ${ADMIN_CHROME.ON_FILL}`}
          >
            Back to Pana Mia
          </SurfaceLink>
        </div>
      </div>
    </main>
  );
}
