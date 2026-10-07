import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  BirthdayList,
  CommitmentsTable,
  EventCard,
  HousePill,
  TallyBars,
} from '@/components/connectors/dashboard-parts';
import { Panel, StatBand } from '@/components/Admin/parts';
import {
  MockButton,
  MockInput,
  MockSelect,
  MockTag,
} from '@/components/Admin/mock-controls';
import { AdminMockBar } from '@/components/Admin/mock-bar';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import {
  ASKS,
  COMMITMENTS,
  CONNECTORS,
  headlineStats,
  houseTallies,
  podTallies,
  upcomingBirthdays,
  upcomingEvents,
} from '@/lib/connectors/fixtures';
import { HOUSES, PODS, TIERS, getPod } from '@/lib/connectors/model';

/**
 * The programme admin view.
 *
 * This is a redraw of the Connector Dashboard the panas keep in Google Sheets:
 * same stat band, same pod and house breakdowns, same birthday list, same
 * commitments table with the same six columns. Somebody who has been reading
 * the sheet should recognise it immediately and not have to be retrained.
 *
 * What it changes is where the numbers come from. In the sheet every figure is
 * typed by hand and drifts — the header says twenty-six connectors over a list
 * of nineteen, and nobody can tell which is wrong. Here every number is
 * counted from the rows underneath it, so the band cannot disagree with the
 * table.
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
 * ## What is deliberately not carried over
 *
 * The sheet has a "Sync with Google Sheets" banner, an "Add to the sheet"
 * picker and a read-only action log. The first two are scaffolding for the
 * spreadsheet itself — if this page exists, the sheet is no longer the system
 * of record and syncing back to it would just recreate the drift. The action
 * log is worth having and is not here yet; it wants real writes behind it
 * before it means anything.
 */

export const metadata = {
  title: 'Connectors | Pana Admin',
  robots: { index: false, follow: false },
};

export default function AdminConnectorsPage() {
  const unassigned = CONNECTORS.filter((c) => c.houseId === null);
  const openAsks = ASKS.filter((a) => !a.completed);

  /* `headlineStats()` is shaped for the Connectors stat band, which calls the
   * third line `detail`. Mapped rather than renamed at the source: HQ reads
   * the same function and does not need to know the admin surface exists. */
  const band = headlineStats().map((stat) => ({
    label: stat.label,
    value: String(stat.value),
    note: stat.detail,
  }));

  return (
    <>
      <AdminMockBar />

      <>
        <header className="pb-6">
          <p
            className={`text-xs font-extrabold uppercase tracking-[0.2em] ${ADMIN_CHROME.ACCENT}`}
          >
            Pana Admin
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            Connector Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pana-ink/70">
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
          <StatBand stats={band} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Connectors by pod">
              <TallyBars rows={podTallies()} />
              <p className="mt-4 text-xs leading-relaxed text-pana-ink/60">
                Pods are geographic. {PODS.map((p) => p.region).join(', ')}.
              </p>
            </Panel>

            <Panel title="Connectors by house">
              <TallyBars rows={houseTallies()} />
              <p className="mt-4 text-xs leading-relaxed text-pana-ink/60">
                {unassigned.length} of {CONNECTORS.length} have not picked a
                house. That is the number worth moving.
              </p>
            </Panel>

            <Panel title="Birthdays coming up">
              <BirthdayList rows={upcomingBirthdays(6)} />
            </Panel>
          </div>

          <Panel title="Assign a house" action={<MockTag />}>
            <p className="mb-4 text-sm leading-relaxed text-pana-ink/70">
              Everybody below joined without choosing a house. A house is not an
              assignment to hand down — have the conversation first, then record
              what they picked.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className={`${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL}`}>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
                    >
                      Connector
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
                    >
                      Pod
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
                    >
                      House
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
                    >
                      Tier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((connector) => (
                    <tr
                      key={connector.id}
                      className="border-b-2 border-pana-ink/15 last:border-b-0"
                    >
                      <td className="px-3 py-2 font-bold">{connector.name}</td>
                      <td className="px-3 py-2 text-pana-ink/70">
                        {getPod(connector.podId).name}
                      </td>
                      <td className="px-3 py-2">
                        <MockSelect
                          label={`House for ${connector.name}`}
                          placeholder="Not chosen yet"
                          options={HOUSES.map((h) => h.name)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MockSelect
                          label={`Tier for ${connector.name}`}
                          placeholder={`Tier ${connector.tier}`}
                          options={TIERS.map((t) => `Tier ${t.id} — ${t.name}`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
                Coming up
              </h2>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcomingEvents().map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
              <NewEventCard />
            </div>
          </section>

          <Panel title="Commitments" action={<MockTag />}>
            <CommitmentsTable rows={COMMITMENTS} chrome={ADMIN_CHROME} />

            <div className="mt-6 border-t-2 border-dashed border-pana-ink/25 pt-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                Set a task
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MockSelect
                  label="Who"
                  placeholder="Pick a connector"
                  options={CONNECTORS.map((c) => c.name)}
                />
                <MockInput
                  label="What"
                  placeholder="Distribute zines in Allapattah"
                />
                <MockInput
                  label="When"
                  placeholder="Before the end of the month"
                />
                <MockSelect
                  label="House"
                  placeholder="Pick a house"
                  options={HOUSES.map((h) => h.name)}
                />
              </div>
              <MockButton>Add commitment</MockButton>
            </div>
          </Panel>

          <Panel title="Open asks">
            <ul className="flex flex-col gap-4">
              {openAsks.map((ask) => (
                <li
                  key={ask.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
                >
                  <div>
                    <p className="font-bold leading-snug">{ask.what}</p>
                    <p className="mt-1 text-pana-ink/60">
                      Asked by {ask.askedBy}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1">
                    {ask.houseIds.map((id) => (
                      <HousePill key={id} houseId={id} />
                    ))}
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

/** The "add one" tile, sitting in the grid where the next event would go. */
function NewEventCard() {
  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-pana-ink/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold leading-tight text-pana-ink/70">
          Set an event
        </h3>
        <MockTag />
      </div>
      <div className="flex flex-col gap-2.5">
        <MockInput label="Event title" placeholder="Title" />
        <MockInput label="When" placeholder="Thursdays @ 5p" />
        <MockInput label="Where" placeholder="Bryant Park, north side" />
        <MockSelect
          label="Cadence"
          placeholder="One-time"
          options={[
            'Recurring · Weekly',
            'Recurring · Weekends',
            'Recurring · Monthly',
          ]}
        />
        <MockInput
          label="Volunteers needed"
          placeholder="8, or leave blank for no cap"
        />
      </div>
      <MockButton>Add event</MockButton>
    </article>
  );
}
