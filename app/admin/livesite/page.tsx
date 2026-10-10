import {
  AttentionStrip,
  Placeholder,
  type WaitingItem,
} from '@/components/Admin/livesite-parts';
import { Panel, StatBand } from '@/components/Admin/parts';
import { requireAdmin } from '@/lib/admin/gate';
import { communitySnapshot, trendNote } from '@/lib/admin/livesite';

/**
 * /admin/livesite -- is the site healthy, and is anything waiting on us?
 *
 * ## Boring when fine, loud when not
 *
 * A dashboard that always looks the same is a dashboard nobody reads, and one
 * nobody reads is worse than none at all because it is still *believed*. So
 * the attention strip renders a single quiet line when every queue is empty
 * and only grows rows when something is genuinely waiting. The page changes
 * shape when the site needs you, which is the one signal that survives being
 * seen every day.
 *
 * That is also why the queue counts are kept out of the stat band. A band of
 * five numbers that usually includes two zeroes trains you to skim all five.
 * The band carries things that are always worth a glance; the strip carries
 * things that are only ever there because they need doing.
 *
 * ## Why this does not contradict the overview
 *
 * `components/Admin/overview.tsx` deliberately shows no counts, on the
 * argument that a tool directory quoting numbers it does not own will drift
 * from the tools themselves. That still holds. The difference is ownership:
 * this page's whole job is those numbers, it reads them live per request, and
 * every one links to the tool that can clear it. The overview points at
 * doors; this one reads the building.
 *
 * ## Bands two and three
 *
 * Machinery (did the hourly job run?) and infrastructure (Cloudflare, the
 * database) are drawn as dashed placeholders rather than omitted. Band two
 * needs a `job_runs` table before it can say anything true -- nothing in the
 * app currently writes down what it did, so "we cannot tell" is the honest
 * answer today and showing it is the point. Same house pattern as
 * `UNBUILT_TOOLS` in lib/admin/views.ts: write the gap down so it does not
 * quietly become folklore.
 */

export const metadata = { title: 'Live site - Pana Admin' };

/** Always fresh. A cached health dashboard is a lie with a timestamp on it. */
export const dynamic = 'force-dynamic';

export default async function LiveSitePage() {
  await requireAdmin('/admin/livesite');

  const snap = await communitySnapshot();

  const waiting: WaitingItem[] = [
    {
      label: 'directory listing',
      plural: 'directory listings',
      count: snap.queues.listings,
      href: '/admin/listings',
      verb: 'waiting to be let in',
    },
    {
      label: 'contact message',
      plural: 'contact messages',
      count: snap.queues.contact,
      href: '/admin/contactus',
      verb: 'still open',
    },
    {
      label: 'abuse report',
      plural: 'abuse reports',
      count: snap.queues.reports,
      href: '/admin/reports',
      verb: 'needing triage',
    },
    {
      label: 'newsletter signup',
      plural: 'newsletter signups',
      count: snap.queues.newsletter,
      href: null,
      verb: 'not yet acknowledged',
    },
  ].filter((q) => q.count > 0);

  const totalWaiting = waiting.reduce((n, q) => n + q.count, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-pana-ink">Live site</h1>
        <p className="mt-1 max-w-2xl text-sm text-pana-ink/70">
          How the website is holding up, and what is waiting on a human.
        </p>
      </header>

      <AttentionStrip waiting={waiting} />

      <StatBand
        stats={[
          {
            label: 'New panas',
            value: String(snap.signups.current),
            note: trendNote(snap.signups, 'last 7 days'),
          },
          {
            label: 'New profiles',
            value: String(snap.profiles.current),
            note: trendNote(snap.profiles, 'last 7 days'),
          },
          {
            label: 'Upcoming events',
            value: String(snap.upcomingEvents),
            note: 'published, still ahead',
          },
          {
            label: 'Panas in total',
            value: snap.totalUsers.toLocaleString(),
            note: 'accounts, all time',
          },
          {
            label: 'Waiting on us',
            value: String(totalWaiting),
            note: waiting.length ? 'across every queue' : 'all queues clear',
          },
        ]}
      />

      <Panel title="What this page cannot tell you yet">
        <div className="grid gap-5 sm:grid-cols-2">
          <Placeholder
            title="Machinery"
            lead="Whether the hourly cleanup job is running, and whether it is quietly failing."
            needs="Needs a job_runs table. Today the purge writes its report to a console log nobody reads, so a run that deferred every media delete looks identical to one that had nothing to do."
          />
          <Placeholder
            title="Infrastructure"
            lead="Request volume, error rate, and how close the database is to its connection ceiling."
            needs="Needs a Cloudflare API token with Analytics read. Deep-links out rather than rebuilding a dashboard Cloudflare already draws better."
          />
        </div>
      </Panel>
    </div>
  );
}
