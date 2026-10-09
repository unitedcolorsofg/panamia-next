import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  CommitmentsTable,
  TallyBars,
} from '@/components/connectors/dashboard-parts';
import {
  EventBoard,
  RosterEditor,
  SetTaskForm,
} from '@/components/connectors/admin-console';
import { Panel, StatBand } from '@/components/Admin/parts';
import { ApplicationQueue } from '@/components/connectors/application-queue';
import { listConnectorApplications } from '@/lib/connectors/membership';
import { listRoster, rosterTallies } from '@/lib/connectors/roster';
import { commitmentTotals, listOpenCommitments } from '@/lib/connectors/commitments';
import { listEventsForAdmin } from '@/lib/connectors/events';
import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import { PODS } from '@/lib/connectors/model';

/**
 * The programme admin view.
 *
 * This is a redraw of the Connector Dashboard the panas keep in Google Sheets:
 * same stat band, same pod and house breakdowns, same commitments table.
 * Somebody who has been reading the sheet should recognise it immediately and
 * not have to be retrained.
 *
 * What it changes is where the numbers come from. In the sheet every figure is
 * typed by hand and drifts — the header says twenty-six connectors over a list
 * of nineteen, and nobody can tell which is wrong. Here every number is
 * counted from the rows underneath it, so the band cannot disagree with the
 * table. `rosterTallies()` takes the roster as an argument for exactly that
 * reason: the band provably counts the same rows the editor renders.
 *
 * ## Why it lives here and not under /connectors
 *
 * It moved off the Connectors surface because of who it is for. Connectors is
 * a members' surface: a pana lands there to find their house, their pod and
 * what they said they would do. This page is nobody's own — it is a staff tool
 * that happens to be about connectors, and it belongs with the other staff
 * tools. `/connectors/admin` still answers and redirects here.
 *
 * The consequence is that the furniture changed colour. The panels, the stat
 * band and the table headers wear the admin blue rather than the Connectors
 * indigo, because an admin needs to be able to tell at a glance that they are
 * holding tools that change what other people see. House colours stay as they
 * are: those identify data, not the tool showing it.
 *
 * ## What the mock had that this does not
 *
 * Three panels are gone rather than ported, and the reason is the same in each
 * case: nothing could have filled them.
 *
 *   - **Birthdays.** There is no date of birth on a profile — not in the
 *     schema, not on the join form. Collecting one is a product decision with
 *     a privacy answer attached, not a gap to quietly fill.
 *   - **Open asks.** No table, and the fixture's "asked by" names were people
 *     who do not exist.
 *   - **Volunteer sign-up counts.** The mock read "3 more of 8". There is no
 *     sign-up table, so the 5 was invented. Events say how many are wanted
 *     and do not claim to know how many have come forward.
 *
 * The sheet's "Sync with Google Sheets" banner and "Add to the sheet" picker
 * are not here either: if this page exists, the sheet is no longer the system
 * of record and syncing back would just recreate the drift. The sheet's
 * read-only action log is worth having and is still missing — it wants an
 * audit trail behind it before it means anything.
 */

export const metadata = {
  title: 'Connectors | Pana Admin',
  robots: { index: false, follow: false },
};

export default async function AdminConnectorsPage() {
  /* Nothing under /admin is guarded — there is no middleware matcher and the
   * layout has no check. That was survivable while every page here rendered
   * fixtures: a stranger who found the URL saw invented people. This one now
   * shows real names, real email addresses and real work, so it cannot be one
   * of the open ones.
   *
   * Two different failures get two different answers. Signed out is probably
   * a staff member whose session expired, so send them to sign in. Signed in
   * but not an admin is somebody who should not know this exists, so it does
   * not. */
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (!session.user.isAdmin) notFound();

  /* Five independent reads. None of them depends on another, so running them
   * in series would make the page as slow as their sum for no reason. */
  const [pending, roster, totals, openWork, events] = await Promise.all([
    listConnectorApplications(),
    listRoster(),
    commitmentTotals(),
    listOpenCommitments(40),
    listEventsForAdmin(),
  ]);

  const applications = pending.map((row) => ({
    profileId: row.profileId,
    displayName: row.displayName,
    email: row.email,
    pod: row.membership.pod,
    houses: row.membership.houses,
    bring: row.membership.bring,
    appliedAt: row.membership.appliedAt,
  }));

  const tallies = rosterTallies(roster);

  const rosterRows = roster.map((member) => ({
    profileId: member.profileId,
    displayName: member.displayName,
    pod: member.membership.pod,
    houses: member.membership.houses,
    tier: member.membership.tier,
  }));

  const band = [
    {
      label: 'Connectors',
      value: String(tallies.total),
      note: `${applications.length} waiting on a decision`,
    },
    {
      label: 'Open commitments',
      value: String(totals.open),
      note: `${totals.done} closed out`,
    },
    {
      label: 'Assigned by staff',
      value: String(totals.assigned),
      note: 'The rest people took on themselves',
    },
    {
      label: 'Upcoming events',
      value: String(events.upcoming.length),
      note:
        events.staleRecurring.length > 0
          ? `${events.staleRecurring.length} need a new date`
          : 'Calendar is current',
    },
  ];

  return (
    <>
      <header className="pb-6">
        <AdminEyebrow>Community</AdminEyebrow>
        <h1 className="mt-2 text-4xl leading-tight font-extrabold sm:text-5xl">
          Connector Dashboard
        </h1>
        <p className="text-pana-ink/70 mt-3 max-w-2xl text-sm leading-relaxed">
          Every number on this page is counted from the rows below it. If the
          band and a table ever disagree, the bug is here and not in your
          reading of it.
        </p>
        {/* The way back to the members' side. An admin is usually also a
         * connector, and the two views answer different questions. */}
        <p className="mt-4 text-sm">
          <SurfaceLink
            href="/connectors/hq"
            className={`font-extrabold underline underline-offset-4 ${ADMIN_CHROME.ACCENT}`}
          >
            Open Connector HQ
          </SurfaceLink>
          <span className="text-pana-ink/60">
            {' '}
            — the members&rsquo; view of the same programme.
          </span>
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Panel title="Applications">
          <ApplicationQueue applications={applications} />
        </Panel>

        <StatBand stats={band} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Connectors by pod">
            <TallyBars rows={tallies.pods} />
            <p className="text-pana-ink/60 mt-4 text-xs leading-relaxed">
              Pods are geographic. {PODS.map((p) => p.region).join(', ')}.
            </p>
          </Panel>

          <Panel title="Connectors by house">
            <TallyBars rows={tallies.houses} />
            <p className="text-pana-ink/60 mt-4 text-xs leading-relaxed">
              Houses describe the kind of work, not where somebody lives.
              Counts add up to more than {tallies.total} because a connector
              can be in more than one.
            </p>
          </Panel>
        </div>

        <Panel title="Roster">
          <RosterEditor rows={rosterRows} />
        </Panel>

        <section>
          <h2 className="text-pana-ink/60 pb-3 text-sm font-extrabold tracking-wide uppercase">
            Coming up
          </h2>
          <EventBoard
            upcoming={events.upcoming}
            staleRecurring={events.staleRecurring}
          />
        </section>

        <Panel title="Open commitments">
          {openWork.length === 0 ? (
            <p className="text-pana-ink/60 text-sm leading-relaxed">
              Nothing outstanding. Either the programme is caught up or nobody
              has written anything down.
            </p>
          ) : (
            <CommitmentsTable rows={openWork} chrome={ADMIN_CHROME} />
          )}

          <div className="border-pana-ink/25 mt-6 border-t-2 border-dashed pt-5">
            <h3 className="text-sm font-extrabold tracking-wide uppercase">
              Set a task
            </h3>
            <p className="text-pana-ink/70 mt-2 mb-3 text-sm leading-relaxed">
              This goes on their board marked as assigned. They can mark it
              done — you cannot, and they cannot delete it.
            </p>
            <SetTaskForm
              connectors={roster.map((m) => ({
                profileId: m.profileId,
                displayName: m.displayName,
                houses: m.membership.houses,
              }))}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
