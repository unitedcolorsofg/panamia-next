import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * The bar that says "none of this is real yet".
 *
 * ## Why there is no "viewing as" switch here
 *
 * The Connectors mock has one, because that surface genuinely renders three
 * different things depending on who is looking — a visitor sees a pitch, a
 * connector sees their HQ, an admin sees the console — and all three are
 * screens somebody had to design.
 *
 * This surface renders one thing. You are staff or you are not, and "not" is
 * not a screen: it is `checkAdminAuth()` turning you away before any of this
 * is reached. Giving the mock a refusal state would have invented a page that
 * production should never serve, and put a button on every admin screen
 * inviting reviewers to go look at it.
 *
 * So the bar is a statement rather than a control. It stays because the data
 * below it is still fixtures and that needs saying on every screen; it stops
 * being needed on the day these views get real reads, at which point delete
 * this file and the import.
 */
export function AdminMockBar() {
  return (
    <div className="border-b-2 border-dashed border-pana-ink/30 bg-pana-butter-2">
      <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <span
          className={`rounded-full border-2 border-pana-ink px-3 py-1 text-xs font-bold ${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL}`}
        >
          Staff only
        </span>
        <p className="text-xs leading-snug text-pana-ink/60">
          <span className="font-extrabold uppercase tracking-wider">Mock</span>{' '}
          — every number below is a fixture. The real gate is{' '}
          <code>checkAdminAuth()</code> against <code>ADMIN_EMAILS</code>.
        </p>
      </div>
    </div>
  );
}
