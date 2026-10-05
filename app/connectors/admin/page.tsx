import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  BirthdayList,
  CommitmentsTable,
  EventCard,
  HousePill,
  Panel,
  StatBand,
  TallyBars,
} from '@/components/connectors/dashboard-parts';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';
import {
  ASKS,
  COMMITMENTS,
  CONNECTORS,
  headlineStats,
  houseTallies,
  podTallies,
  resolveViewerRole,
  upcomingBirthdays,
  upcomingEvents,
} from '@/lib/connectors/fixtures';
import { HOUSES, PODS, TIERS, getPod } from '@/lib/connectors/model';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

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
  title: 'Connector admin | Pana MIA Club',
  robots: { index: false, follow: false },
};

export default async function ConnectorAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const role = resolveViewerRole((await searchParams).as);

  if (role !== 'admin') {
    return (
      <>
        <ViewerSwitch current={role} />
        <NotAnAdmin />
      </>
    );
  }

  const unassigned = CONNECTORS.filter((c) => c.houseId === null);
  const openAsks = ASKS.filter((a) => !a.completed);

  return (
    <>
      <ViewerSwitch current={role} />

      <main className="bg-pana-cream pb-20 text-pana-ink">
        <header className="container mx-auto px-4 pb-6 pt-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pana-burnt">
            Pana Connectors
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            Connector Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pana-ink/70">
            Every number on this page is counted from the rows below it. If the
            band and a table ever disagree, the bug is here and not in your
            reading of it.
          </p>
        </header>

        <div className="container mx-auto flex flex-col gap-6 px-4">
          <StatBand stats={headlineStats()} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Connectors by pod">
              <TallyBars rows={podTallies()} />
              <p className="mt-4 text-xs leading-relaxed text-pana-ink/60">
                Pods are geographic.{' '}
                {PODS.map((p) => p.region).join(', ')}.
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

          <Panel
            title="Assign a house"
            action={<MockTag />}
          >
            <p className="mb-4 text-sm leading-relaxed text-pana-ink/70">
              Everybody below joined without choosing a house. A house is not an
              assignment to hand down — have the conversation first, then record
              what they picked.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr
                    className={`${CONNECTORS_CHROME.FILL} ${CONNECTORS_CHROME.ON_FILL}`}
                  >
                    <th scope="col" className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide">
                      Connector
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide">
                      Pod
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide">
                      House
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide">
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
            <CommitmentsTable rows={COMMITMENTS} />

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
                <MockInput label="What" placeholder="Distribute zines in Allapattah" />
                <MockInput label="When" placeholder="Before the end of the month" />
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
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mock controls
//
// Real-looking and deliberately inert. The point of the mock is to settle what
// an admin should be able to do and what they need in front of them while they
// do it; wiring writes before that is agreed means building the wrong writes.
//
// Every one of these is `disabled`, which is doing two jobs: it keeps the
// controls out of the tab order so a keyboard user is not sent through thirty
// dead selects, and it makes the state visible rather than letting somebody
// type into a box that silently drops what they wrote.
// ---------------------------------------------------------------------------

function MockTag() {
  return (
    /* Orange on cream measures 2.37 at this size, which is a fail however
     * loudly it shouts. Filling the pill instead puts ink on orange at 7.47
     * and makes the tag louder, not quieter — which is the point of it. */
    <span className="rounded-full border-2 border-pana-orange bg-pana-orange px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
      Mock
    </span>
  );
}

function MockSelect({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        disabled
        aria-label={label}
        defaultValue=""
        className="w-full rounded-lg border-2 border-pana-ink/40 bg-pana-cream px-2.5 py-1.5 text-sm text-pana-ink/60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function MockInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        disabled
        aria-label={label}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-pana-ink/40 bg-pana-cream px-2.5 py-1.5 text-sm text-pana-ink/60 placeholder:text-pana-ink/40"
      />
    </label>
  );
}

function MockButton({ children }: { children: string }) {
  return (
    <button
      disabled
      className="mt-3 rounded-full border-2 border-pana-ink/40 px-4 py-1.5 text-sm font-extrabold text-pana-ink/40"
    >
      {children}
    </button>
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
          options={['Recurring · Weekly', 'Recurring · Weekends', 'Recurring · Monthly']}
        />
        <MockInput label="Volunteers needed" placeholder="8, or leave blank for no cap" />
      </div>
      <MockButton>Add event</MockButton>
    </article>
  );
}

function NotAnAdmin() {
  return (
    <main className="bg-pana-cream py-24 text-pana-ink">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          Admins only.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pana-ink/70">
          The connector dashboard is for the panas running the programme. Your
          own events and commitments live in the HQ.
        </p>
        <div className="mt-8">
          <SurfaceLink
            href="/connectors/hq"
            className={`rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-5 py-2.5 text-sm font-extrabold ${CONNECTORS_CHROME.ON_FILL}`}
          >
            Go to Connector HQ
          </SurfaceLink>
        </div>
      </div>
    </main>
  );
}
