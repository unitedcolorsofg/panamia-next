import { Panel, StatBand } from '@/components/Admin/parts';
import {
  MockButton,
  MockInput,
  MockSelect,
  MockTag,
} from '@/components/Admin/mock-controls';
import { AdminMockBar } from '@/components/Admin/mock-bar';
import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import {
  CATEGORY_LABEL,
  COUNTY_LABEL,
  FLAG_LABEL,
  FLAG_NOTE,
  PENDING_LISTINGS,
  REVIEW_SLA_DAYS,
  RECENT_DECISIONS,
  type PendingListing,
  daysWaiting,
  listingStats,
  queueOrder,
  waitLabel,
} from '@/lib/admin/fixtures';

/**
 * The directory listing approval queue.
 *
 * ## What this replaces
 *
 * Nothing, which is the point. Today an application is approved or declined by
 * clicking a link in an email: `/admin/profile/action` reads `?email=`,
 * `?access=` and `?action=` off the URL and posts the decision. It works, and
 * it has one hole you cannot patch from inside it — there is no list. An
 * admin can only act on an application somebody still has the email for.
 * Delete the email and the business waits forever, and nobody can tell you how
 * many businesses that has happened to.
 *
 * So the first job of this screen is not the buttons. It is the count at the
 * top of the page.
 *
 * ## Oldest first, and no way to change that
 *
 * `queueOrder()` sorts by submission date and the column headers do not sort.
 * A queue you can re-sort is a list, and a list is where the easy applications
 * get done and the awkward one from five weeks ago stays at the bottom. If
 * something genuinely needs to jump the queue, that is a conversation, not a
 * column header.
 *
 * ## Flags are notes, not verdicts
 *
 * A flag says "look at this before you decide" and never "decline this". They
 * are computed from the application — no socials, a name close to something
 * already listed, an address outside the three counties — and every one of
 * them has a legitimate explanation. See `FLAG_NOTE` in the fixtures for what
 * each is actually claiming.
 *
 * ## Mock
 *
 * Approve and decline are inert. Wiring them before the shape is agreed means
 * building the wrong writes, and these particular writes send mail to a
 * business owner and flip a row the public directory reads.
 */

export const metadata = {
  title: 'Directory listings | Pana Admin',
  robots: { index: false, follow: false },
};

export default function AdminListingsPage() {
  const queue = queueOrder(PENDING_LISTINGS);

  return (
    <>
      <AdminMockBar />

      <>
        <header className="pb-6">
          <AdminEyebrow>Directory</AdminEyebrow>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            Directory listings
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-pana-ink/70">
            Applications to the directory that have not been answered yet.
            Oldest first, because the oldest one is the one somebody has
            been waiting on.
          </p>
        </header>

        <div className="flex flex-col gap-6">
          <StatBand stats={listingStats(PENDING_LISTINGS)} />

          {/* The honest note about why this page exists. Sits under the band
            * rather than above it so the numbers land first — the numbers are
            * the argument and this is the explanation of it. */}
          <section
            className={`rounded-xl border-2 border-dashed ${ADMIN_CHROME.BORDER} bg-pana-cream p-5`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wide">
              Why some of these are a month old
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
              Until this screen, an application could only be answered by
              clicking a link in the email it generated. That link still works
              and still posts to{' '}
              <code className="text-pana-ink/60">/api/admin/profile/action</code>
              . What did not exist was any way to see what was waiting, so an
              application whose email got buried had nothing left pointing at
              it. Everything below was found by reading the table, not the
              inbox.
            </p>
          </section>

          <Panel
            title={`Waiting — ${queue.length}`}
            action={<MockTag />}
            className="overflow-visible"
          >
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MockInput label="Search" placeholder="Listing name" />
                <MockSelect
                  label="County"
                  placeholder="All counties"
                  options={Object.values(COUNTY_LABEL)}
                />
                <MockSelect
                  label="Category"
                  placeholder="All categories"
                  options={Object.values(CATEGORY_LABEL)}
                />
                <MockSelect
                  label="Flagged"
                  placeholder="Everything"
                  options={['Flagged only', 'Unflagged only', 'Unclaimed only']}
                />
              </div>
              <p className="text-xs leading-relaxed text-pana-ink/60">
                Filters narrow the queue. They do not reorder it — see the note
                in the source for why nothing here sorts.
              </p>
            </div>

            <ul className="mt-5 flex flex-col gap-4">
              {queue.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ul>
          </Panel>

          <Panel title="Recently decided">
            <p className="mb-4 text-sm leading-relaxed text-pana-ink/70">
              The last few answers, so somebody picking up the queue can see
              what has already been handled and roughly where the line is being
              drawn. Real rows do not record who decided — the endpoint stamps
              a timestamp and nothing else. Worth fixing before this ships.
            </p>

            <ul
              className={`divide-y-2 ${ADMIN_CHROME.DIVIDE} border-t-2 ${ADMIN_CHROME.RULE}`}
            >
              {RECENT_DECISIONS.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span
                    className={`w-24 shrink-0 text-xs font-extrabold uppercase tracking-wider ${
                      row.decision === 'approved'
                        ? ADMIN_CHROME.ACCENT
                        : 'text-pana-ink/50'
                    }`}
                  >
                    {row.decision}
                  </span>
                  <span className="min-w-[12rem] font-bold leading-snug">
                    {row.name}
                    <span className="font-normal text-pana-ink/60">
                      {' '}
                      · {row.locality}
                    </span>
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-pana-ink/70">
                    {row.reason ?? 'Published to the directory.'}
                  </span>
                  <span className="text-xs text-pana-ink/50">
                    {waitLabel(daysWaiting(row.decidedAt))} ago ·{' '}
                    {row.decidedBy}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </>
    </>
  );
}

/**
 * One application, expanded.
 *
 * Not a table row. The six columns that would fit cannot hold the thing a
 * reviewer actually needs — the description the business wrote about itself —
 * and a queue that makes you open each item to read it is a queue that gets
 * skimmed instead of read. So everything needed to decide is on the card, and
 * the decision buttons sit next to it rather than a screen away.
 */
function ListingRow({ listing }: { listing: PendingListing }) {
  const days = daysWaiting(listing.submittedAt);
  const overdue = days > REVIEW_SLA_DAYS;

  return (
    <li className="rounded-xl border-2 border-pana-ink p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-[16rem] flex-1">
          <h3 className="text-xl font-extrabold leading-tight">
            {listing.name}
          </h3>
          <p className="mt-1 text-sm text-pana-ink/70">
            {listing.locality} ·{' '}
            {listing.counties.map((c) => COUNTY_LABEL[c]).join(', ')}
          </p>
        </div>

        <div className="text-right">
          {/* Ink at 70% rather than red. Red would read as "this one is bad"
            * when all it means is "this one has been ignored longest", and the
            * business is not the party at fault. */}
          <p
            className={`text-sm font-extrabold ${
              overdue ? ADMIN_CHROME.ACCENT : 'text-pana-ink/70'
            }`}
          >
            Waiting {waitLabel(days)}
            {overdue ? ' · over the window' : ''}
          </p>
          <p className="mt-0.5 text-xs text-pana-ink/50">
            {listing.claimedBy
              ? `Claimed by ${listing.claimedBy}`
              : 'Nobody has claimed this listing'}
          </p>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pana-ink/80">
        {listing.details}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {listing.categories.map((category) => (
          <span
            key={category}
            className="rounded-full border-2 border-pana-ink/30 px-2.5 py-0.5 text-xs font-bold text-pana-ink/70"
          >
            {CATEGORY_LABEL[category]}
          </span>
        ))}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-pana-ink/60">
        <div className="flex gap-1.5">
          <dt className="font-bold">Contact</dt>
          <dd>{listing.email}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-bold">Instagram</dt>
          <dd>{listing.instagram ?? 'none given'}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-bold">Website</dt>
          <dd>{listing.website ?? 'none given'}</dd>
        </div>
      </dl>

      {listing.flags.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t-2 border-dashed border-pana-ink/20 pt-3">
          {listing.flags.map((flag) => (
            <li key={flag} className="flex flex-wrap gap-x-2 text-xs leading-relaxed">
              <span
                className={`font-extrabold uppercase tracking-wider ${ADMIN_CHROME.ACCENT}`}
              >
                {FLAG_LABEL[flag]}
              </span>
              <span className="text-pana-ink/60">{FLAG_NOTE[flag]}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MockButton>Approve and publish</MockButton>
        <MockButton tone="danger">Decline</MockButton>
        <MockButton tone="quiet">Open the full application</MockButton>
      </div>
    </li>
  );
}
