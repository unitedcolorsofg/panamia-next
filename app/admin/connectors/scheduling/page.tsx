import { CommitmentsTable } from '@/components/connectors/dashboard-parts';
import { SetTaskForm } from '@/components/connectors/admin-console';
import { LoadTable } from '@/components/connectors/load-table';
import { Panel, StatBand } from '@/components/Admin/parts';
import { AdminSubNav } from '@/components/Admin/subnav';
import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { connectorsTabs } from '@/lib/connectors/admin-tabs';
import { requireConnectorsAdmin } from '@/lib/connectors/admin-gate';
import { countConnectorApplications } from '@/lib/connectors/membership';
import { listRoster } from '@/lib/connectors/roster';
import { connectorLoads, listOpenCommitments } from '@/lib/connectors/commitments';
import { EMPTY_LOAD, formatMinutes } from '@/lib/connectors/hours';
import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * Handing work out, with some idea of who can take it.
 *
 * The assign form used to sit at the bottom of the dashboard under the open
 * commitments table, which meant the only thing visible while choosing a name
 * from the dropdown was a list of tasks sorted by nothing in particular. You
 * could see all the work and none of the workers. Picking fairly meant
 * reading the whole table and counting in your head, so in practice people
 * picked whoever they had just been talking to.
 *
 * This page puts the roster's load above the form. The question it answers is
 * the one actually being asked at the moment of assigning — who has room —
 * and it is answered before the dropdown is opened rather than after.
 *
 * ## Load is observed, not declared
 *
 * Nobody states a capacity, so none is shown. See `components/connectors/
 * load-table.tsx` for why the bars are relative and why unsized work is
 * counted separately instead of being treated as zero.
 *
 * The figure is hours **outstanding**, not hours per week. Commitments carry
 * `when` as free text — "before the next huddle", "Saturdays" — so there is no
 * date to bucket by and any per-week number would be invented. Outstanding is
 * what can be counted honestly from what exists.
 *
 * ## Why events are not here
 *
 * An event has `volunteersNeeded` but no sign-up table, and its `lead` is a
 * free-text name rather than a connector reference. So an event cannot be
 * attributed to anybody's load without guessing, and staffing one is a
 * different job from assigning a task to a named person. Events stay on the
 * overview with the rest of the programme's calendar.
 */

export const metadata = {
  title: 'Connector scheduling | Pana Admin',
  robots: { index: false, follow: false },
};

export default async function AdminConnectorSchedulingPage() {
  await requireConnectorsAdmin();

  const [pendingCount, roster, loads, openWork] = await Promise.all([
    countConnectorApplications(),
    listRoster(),
    connectorLoads(),
    listOpenCommitments(40),
  ]);

  /* Driven by the roster, not by the load map: a connector with nothing open
   * has no row in that map at all, and they are precisely the people this page
   * exists to surface. Defaulting to EMPTY_LOAD keeps them in the table. */
  const loadRows = roster.map((member) => ({
    profileId: member.profileId,
    displayName: member.displayName,
    houses: member.membership.houses,
    load: loads.get(member.profileId) ?? EMPTY_LOAD,
  }));

  const totalMinutes = loadRows.reduce(
    (sum, row) => sum + row.load.estimatedMinutes,
    0
  );
  const totalUnsized = loadRows.reduce(
    (sum, row) => sum + row.load.unestimated,
    0
  );
  const withRoom = loadRows.filter((row) => row.load.open === 0).length;

  const band = [
    {
      label: 'Hours outstanding',
      value: totalMinutes > 0 ? formatMinutes(totalMinutes) : '—',
      note:
        totalUnsized > 0
          ? `${totalUnsized} commitment${totalUnsized === 1 ? '' : 's'} not sized`
          : 'Everything open has an estimate',
    },
    {
      label: 'Nothing open',
      value: String(withRoom),
      note: `of ${loadRows.length} on the roster`,
    },
    {
      label: 'Open commitments',
      value: String(openWork.length >= 40 ? '40+' : openWork.length),
      note: 'Across the whole programme',
    },
  ];

  return (
    <>
      <header className="pb-6">
        <AdminEyebrow>Community</AdminEyebrow>
        <h1 className="mt-2 text-4xl leading-tight font-extrabold sm:text-5xl">
          Scheduling
        </h1>
        <p className="text-pana-ink/70 mt-3 max-w-2xl text-sm leading-relaxed">
          Who is carrying what, so a new task goes to somebody who can take it.
          Load is counted from open commitments — it is not a capacity, because
          the programme has never set one.
        </p>
      </header>

      <AdminSubNav
        tabs={connectorsTabs(pendingCount)}
        active="scheduling"
        label="Connectors pages"
      />

      <div className="flex flex-col gap-6">
        <StatBand stats={band} />

        <Panel title="Load by connector">
          <LoadTable rows={loadRows} />
        </Panel>

        <Panel title="Set a task">
          <p className="text-pana-ink/70 mb-4 text-sm leading-relaxed">
            This goes on their board marked as assigned. They can mark it done
            — you cannot, and they cannot delete it. Sizing it is optional, but
            an unsized task is invisible to the table above.
          </p>
          <SetTaskForm
            connectors={roster.map((m) => ({
              profileId: m.profileId,
              displayName: m.displayName,
              houses: m.membership.houses,
            }))}
          />
        </Panel>

        <Panel title="Open commitments">
          {openWork.length === 0 ? (
            <p className="text-pana-ink/60 text-sm leading-relaxed">
              Nothing outstanding. Either the programme is caught up or nobody
              has written anything down.
            </p>
          ) : (
            <CommitmentsTable rows={openWork} chrome={ADMIN_CHROME} />
          )}
        </Panel>
      </div>
    </>
  );
}
