import { Panel } from '@/components/Admin/parts';
import { ApplicationQueue } from '@/components/connectors/application-queue';
import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { requireConnectorsAdmin } from '@/lib/connectors/admin-gate';
import { listConnectorApplications } from '@/lib/connectors/membership';

/**
 * Deciding who gets into the programme.
 *
 * This was the first panel on the dashboard, above the stat band, because it
 * is the one thing on that page with a person waiting at the other end of it.
 * That placement worked right up until the queue had more than a few rows in
 * it, at which point everything else on the page sat below a list that grows
 * without limit — and the queue itself was being read in a column sized for
 * the charts beside it.
 *
 * On its own page it gets the full width, which matters: a decision here is
 * made by reading what somebody wrote in "what I can bring", and that is free
 * text that was being wrapped into a narrow column.
 *
 * ## Why the queue is oldest-first and not newest-first
 *
 * `listConnectorApplications()` sorts by `appliedAt` ascending. A queue of
 * people is not a feed — the useful order is the one that empties it fairly,
 * and the person who has been waiting longest is the one most likely to have
 * concluded nobody read it.
 *
 * ## No filters, deliberately
 *
 * There is exactly one status here: pending. Decided applications leave the
 * queue entirely rather than moving to a "decided" tab, because the record of
 * the decision lives on the profile, and a second list of them would be a
 * second place to read a connector's status from. If a decision needs undoing,
 * that is the roster's job on the overview page, not this page's.
 */

export const metadata = {
  title: 'Connector applications | Pana Admin',
  robots: { index: false, follow: false },
};

export default async function AdminConnectorApplicationsPage() {
  await requireConnectorsAdmin();

  const pending = await listConnectorApplications();

  const applications = pending.map((row) => ({
    profileId: row.profileId,
    displayName: row.displayName,
    email: row.email,
    pod: row.membership.pod,
    houses: row.membership.houses,
    bring: row.membership.bring,
    appliedAt: row.membership.appliedAt,
  }));

  return (
    <>
      <header className="pb-6">
        <AdminEyebrow>Community</AdminEyebrow>
        <h1 className="mt-2 text-4xl leading-tight font-extrabold sm:text-5xl">
          Applications
        </h1>
        <p className="text-pana-ink/70 mt-3 max-w-2xl text-sm leading-relaxed">
          {applications.length === 0
            ? 'Nobody is waiting. New applications land here as they come in.'
            : `${applications.length} ${
                applications.length === 1 ? 'person is' : 'people are'
              } waiting on an answer, longest wait first.`}
        </p>
      </header>

      <Panel title="Waiting on a decision">
        <ApplicationQueue applications={applications} />
      </Panel>
    </>
  );
}
