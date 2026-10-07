import type { ReactNode } from 'react';

import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * The label above an admin page's title.
 *
 * Shared because all three pages that have one were drawing it by hand and had
 * already drifted — the overview grew a leading rule and the two views did
 * not.
 *
 * ## Why it names the group, not the surface
 *
 * Every page used to open with "PANA ADMIN", which the masthead wordmark and
 * the sidebar's own heading already say. Three statements of the same fact is
 * two too many, and it spent the one line above the title on nothing.
 *
 * On a tool page it now names the shelf the tool sits on — "Directory" above
 * Business listings — so the line answers *where am I* instead of *what site
 * is this*, and matches the grouping the sidebar is already sorted by. The
 * overview keeps "Pana Admin", because there it is true and it is the front
 * door of the surface rather than a tool within it.
 *
 * Deliberately not the `.section-eyebrow` class from globals.css. That hard-
 * codes indigo and lives unlayered, so an unlayered rule beats any Tailwind
 * colour utility trying to correct it — a cascade trap that class already
 * documents for the indigo surface. Rebuilt in the admin accent rather than
 * fought with.
 *
 * The rule is `bg-current` so it follows the text colour rather than needing
 * to be re-set alongside it.
 */
export function AdminEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className={`flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] ${ADMIN_CHROME.ACCENT}`}
    >
      <span aria-hidden="true" className="h-0.5 w-6 shrink-0 bg-current" />
      {children}
    </p>
  );
}
